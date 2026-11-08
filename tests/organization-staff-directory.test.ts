import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const migration = readFileSync('supabase/migrations/202611050030_organization_staff_directory.sql', 'utf8')
const repository = readFileSync('src/cloud/staffRepository.ts', 'utf8')
const component = readFileSync('src/components/OrganizationStaffDirectory.tsx', 'utf8')
const page = readFileSync('src/pages/GroupHubPage.tsx', 'utf8')
const id = {
  admin: '00000000-0000-0000-0000-000000000001', outsider: '00000000-0000-0000-0000-000000000002',
  org: '10000000-0000-0000-0000-000000000001', otherOrg: '10000000-0000-0000-0000-000000000002',
}
let db: PGlite

beforeAll(async () => {
  db = new PGlite()
  await db.exec(`
    create role anon; create role authenticated; create schema auth; create schema private;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create table public.profiles(id uuid primary key references auth.users(id));
    create table public.organizations(id uuid primary key);
    create table public.organization_memberships(organization_id uuid, user_id uuid, active boolean default true);
    create table public.group_memberships(group_id uuid, user_id uuid);
    create function private.is_admin(org uuid) returns boolean language sql stable security definer set search_path='' as $$
      select exists(select 1 from public.organization_memberships where organization_id=org and user_id=auth.uid() and active)
    $$;
    grant usage on schema public, auth to authenticated;
    grant execute on function auth.uid(), private.is_admin(uuid) to authenticated;
    insert into auth.users values ('${id.admin}'),('${id.outsider}');
    insert into profiles values ('${id.admin}'),('${id.outsider}');
    insert into organizations values ('${id.org}'),('${id.otherOrg}');
    insert into organization_memberships values ('${id.org}','${id.admin}',true);
  `)
  await db.exec(migration)
})

afterAll(async () => { await db?.close() })
async function asUser<T = unknown>(user: string, sql: string, commit = false) {
  await db.exec(`begin; set local role authenticated; select set_config('request.jwt.claim.sub','${user}',true);`)
  try { const result = await db.query<T>(sql); await db.exec(commit ? 'commit' : 'rollback'); return result } catch (error) { await db.exec('rollback'); throw error }
}

describe('organization staff directory', () => {
  it('keeps person, authentication and operational memberships separate', () => {
    expect(migration).toContain('linked_user_id uuid references auth.users(id) on delete set null')
    expect(migration).toContain("intended_role in ('coach', 'collaborator')")
    expect(migration).not.toContain('insert into public.group_memberships')
    expect(migration).not.toContain('insert into public.organization_memberships')
    expect(repository).not.toContain('linked_user_id: auth.uid()')
    expect(migration).toContain('grant update (first_name, last_name, intended_role)')
    expect(migration).not.toContain('grant update (linked_user_id')
  })

  it('allows an organization admin to create and edit an unlinked person without email', async () => {
    const created = await asUser<{ id: string }>(id.admin, `insert into organization_staff_people(organization_id,first_name,last_name,intended_role) values ('${id.org}','Anna','Verdi','coach') returning id`, true)
    const personId = created.rows[0].id
    await asUser(id.admin, `update organization_staff_people set first_name='Anita',intended_role='collaborator' where id='${personId}'`, true)
    expect((await db.query(`select first_name,last_name,intended_role,linked_user_id from organization_staff_people where id='${personId}'`)).rows)
      .toEqual([{ first_name: 'Anita', last_name: 'Verdi', intended_role: 'collaborator', linked_user_id: null }])
    await expect(asUser(id.admin, `update organization_staff_people set linked_user_id='${id.outsider}' where id='${personId}'`)).rejects.toThrow('permission denied')
    expect((await db.query('select count(*)::int as count from group_memberships')).rows).toEqual([{ count: 0 }])
  })

  it('denies non-admin creation and cross-organization writes', async () => {
    await expect(asUser(id.outsider, `insert into organization_staff_people(organization_id,first_name,last_name,intended_role) values ('${id.org}','No','Access','coach')`)).rejects.toThrow('row-level security')
    await expect(asUser(id.admin, `insert into organization_staff_people(organization_id,first_name,last_name,intended_role) values ('${id.otherOrg}','Other','Club','coach')`)).rejects.toThrow('row-level security')
  })

  it('isolates list results by organization through RLS', async () => {
    expect((await asUser(id.admin, 'select first_name from organization_staff_people order by first_name')).rows).toEqual([{ first_name: 'Anita' }])
    expect((await asUser(id.outsider, 'select first_name from organization_staff_people')).rows).toEqual([])
  })

  it('uses scoped repository writes and renders the directory only for organization admins', () => {
    expect(repository).toContain("from('organization_staff_people').update(payload).eq('id', input.id).eq('organization_id', input.organizationId)")
    expect(component).toContain("'Non collegato'")
    expect(component).toContain('Non concedono accessi o permessi')
    expect(page).toContain('{admin && <OrganizationStaffDirectory')
  })
})
