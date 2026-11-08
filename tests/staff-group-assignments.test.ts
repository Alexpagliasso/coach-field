import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const directoryMigration = readFileSync('supabase/migrations/202611050030_organization_staff_directory.sql', 'utf8')
const assignmentMigration = readFileSync('supabase/migrations/202611080031_staff_group_assignments.sql', 'utf8')
const repository = readFileSync('src/cloud/staffRepository.ts', 'utf8')
const component = readFileSync('src/components/OrganizationStaffDirectory.tsx', 'utf8')
const id = {
  admin: '00000000-0000-0000-0000-000000000001', outsider: '00000000-0000-0000-0000-000000000002', linked: '00000000-0000-0000-0000-000000000003',
  org: '10000000-0000-0000-0000-000000000001', otherOrg: '10000000-0000-0000-0000-000000000002',
  groupA: '20000000-0000-0000-0000-000000000001', groupB: '20000000-0000-0000-0000-000000000002', foreignGroup: '20000000-0000-0000-0000-000000000003',
}
let db: PGlite
let personId = ''

beforeAll(async () => {
  db = new PGlite()
  await db.exec(`
    create role anon; create role authenticated; create schema auth; create schema private;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create table public.profiles(id uuid primary key references auth.users(id));
    create table public.organizations(id uuid primary key);
    create table public.organization_memberships(organization_id uuid, user_id uuid, active boolean default true);
    create table public.groups(id uuid primary key, organization_id uuid not null, name text, unique(id,organization_id));
    create table public.group_memberships(id uuid default gen_random_uuid(), organization_id uuid, group_id uuid, user_id uuid, role text);
    create function private.is_admin(org uuid) returns boolean language sql stable security definer set search_path='' as $$
      select exists(select 1 from public.organization_memberships where organization_id=org and user_id=auth.uid() and active)
    $$;
    grant usage on schema public, auth to authenticated;
    grant execute on function auth.uid(), private.is_admin(uuid) to authenticated;
    insert into auth.users values ('${id.admin}'),('${id.outsider}'),('${id.linked}');
    insert into profiles values ('${id.admin}'),('${id.outsider}'),('${id.linked}');
    insert into organizations values ('${id.org}'),('${id.otherOrg}');
    insert into organization_memberships values ('${id.org}','${id.admin}',true),('${id.otherOrg}','${id.admin}',true);
    insert into groups values ('${id.groupA}','${id.org}','A'),('${id.groupB}','${id.org}','B'),('${id.foreignGroup}','${id.otherOrg}','Foreign');
  `)
  await db.exec(directoryMigration)
  await db.exec(assignmentMigration)
  const created = await asUser<{ id: string }>(id.admin, `insert into organization_staff_people(organization_id,first_name,last_name,intended_role) values ('${id.org}','Anna','Verdi','coach') returning id`, true)
  personId = created.rows[0].id
})

afterAll(async () => { await db?.close() })
async function asUser<T = unknown>(user: string, sql: string, commit = false) {
  await db.exec(`begin; set local role authenticated; select set_config('request.jwt.claim.sub','${user}',true);`)
  try { const result = await db.query<T>(sql); await db.exec(commit ? 'commit' : 'rollback'); return result } catch (error) { await db.exec('rollback'); throw error }
}

describe('planned staff WorkGroup assignments', () => {
  it('stores multiple groups with independent roles, then edits and removes them', async () => {
    await asUser(id.admin, `insert into organization_staff_group_assignments(organization_id,staff_person_id,group_id,intended_role) values ('${id.org}','${personId}','${id.groupA}','coach'),('${id.org}','${personId}','${id.groupB}','collaborator')`, true)
    expect((await db.query(`select group_id,intended_role from organization_staff_group_assignments where staff_person_id='${personId}' order by group_id`)).rows).toEqual([
      { group_id: id.groupA, intended_role: 'coach' }, { group_id: id.groupB, intended_role: 'collaborator' },
    ])
    await asUser(id.admin, `update organization_staff_group_assignments set intended_role='coach' where staff_person_id='${personId}' and group_id='${id.groupB}'`, true)
    await asUser(id.admin, `delete from organization_staff_group_assignments where staff_person_id='${personId}' and group_id='${id.groupA}'`, true)
    expect((await db.query(`select group_id,intended_role from organization_staff_group_assignments where staff_person_id='${personId}'`)).rows).toEqual([{ group_id: id.groupB, intended_role: 'coach' }])
  })

  it('rejects a person and group from different organizations at the database boundary', async () => {
    await expect(asUser(id.admin, `insert into organization_staff_group_assignments(organization_id,staff_person_id,group_id,intended_role) values ('${id.org}','${personId}','${id.foreignGroup}','coach')`)).rejects.toThrow('foreign key')
  })

  it('denies non-admin writes and reads through RLS', async () => {
    await expect(asUser(id.outsider, `insert into organization_staff_group_assignments(organization_id,staff_person_id,group_id,intended_role) values ('${id.org}','${personId}','${id.groupA}','coach')`)).rejects.toThrow('row-level security')
    expect((await asUser(id.outsider, 'select id from organization_staff_group_assignments')).rows).toEqual([])
  })

  it('never creates operational membership or permissions, including for a linked person', async () => {
    await db.exec(`update organization_staff_people set linked_user_id='${id.linked}' where id='${personId}'`)
    expect((await db.query('select count(*)::int as count from group_memberships')).rows).toEqual([{ count: 0 }])
    expect(assignmentMigration).not.toContain('insert into public.group_memberships')
    expect(assignmentMigration).not.toContain('collaborator_permissions')
    expect(repository).not.toContain("from('group_memberships').insert")
  })

  it('scopes repository mutations and labels unlinked planned assignments in the UI', () => {
    expect(repository).toContain("rpc('delete_staff_group_assignment'")
    expect(repository).toContain("rpc('save_staff_group_assignment'")
    expect(component).toContain('Assegnazione prevista — account non collegato')
    expect(component).toContain('la membership non verrà sincronizzata automaticamente')
    expect(component).toContain('window.confirm')
  })
})
