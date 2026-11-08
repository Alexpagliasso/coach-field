import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const migration = readFileSync('supabase/migrations/202611050029_safe_group_management.sql', 'utf8')
const repository = readFileSync('src/cloud/staffRepository.ts', 'utf8')
const page = readFileSync('src/pages/GroupHubPage.tsx', 'utf8')
const id = {
  superadmin: '00000000-0000-0000-0000-000000000001', admin: '00000000-0000-0000-0000-000000000002',
  coach: '00000000-0000-0000-0000-000000000003', collaborator: '00000000-0000-0000-0000-000000000004', outsider: '00000000-0000-0000-0000-000000000005',
  org: '10000000-0000-0000-0000-000000000001', otherOrg: '10000000-0000-0000-0000-000000000002',
  empty: '20000000-0000-0000-0000-000000000001', busy: '20000000-0000-0000-0000-000000000002', foreign: '20000000-0000-0000-0000-000000000003',
}
let db: PGlite

beforeAll(async () => {
  db = new PGlite()
  await db.exec(`
    create role anon; create role authenticated; create schema auth; create schema private;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create table public.organizations(id uuid primary key);
    create table public.organization_memberships(organization_id uuid, user_id uuid, active boolean default true);
    create function private.is_admin(org uuid) returns boolean language sql stable security definer set search_path='' as $$
      select exists(select 1 from public.organization_memberships where organization_id=org and user_id=auth.uid() and active)
    $$;
    create table public.organization_seasons(id uuid primary key, organization_id uuid, name text);
    create table public.teams(id uuid primary key, organization_id uuid, season_id uuid, name text);
    create table public.groups(id uuid primary key, organization_id uuid, name text, season text, team_id uuid, active boolean default true);
    create table public.group_memberships(id uuid default gen_random_uuid(), organization_id uuid, group_id uuid, user_id uuid, role text);
    create table public.group_player_memberships(group_id uuid);
    create table public.group_player_assignments(group_id uuid);
    create table public.training_sessions(group_id uuid);
    create table public.matches(group_id uuid);
    create table public.family_publications(group_id uuid);
    create table public.match_callups(source_group_id uuid);
    grant usage on schema public, auth to authenticated;
    grant execute on function auth.uid(), private.is_admin(uuid) to authenticated;
    insert into auth.users values ('${id.superadmin}'),('${id.admin}'),('${id.coach}'),('${id.collaborator}'),('${id.outsider}');
  `)
  await db.exec(migration)
  await db.exec(`
    insert into private.superadmins(user_id) values ('${id.superadmin}');
    insert into organizations values ('${id.org}'),('${id.otherOrg}');
    insert into organization_memberships values ('${id.org}','${id.admin}',true);
    insert into groups(id,organization_id,name) values
      ('${id.empty}','${id.org}','Empty'),('${id.busy}','${id.org}','Busy'),('${id.foreign}','${id.otherOrg}','Foreign');
    insert into group_memberships(organization_id,group_id,user_id,role) values
      ('${id.org}','${id.empty}','${id.coach}','coach'),('${id.org}','${id.empty}','${id.collaborator}','collaborator');
    insert into training_sessions values ('${id.busy}');
  `)
})

afterAll(async () => { await db?.close() })

async function asUser(user: string, sql: string) {
  await db.exec(`begin; set local role authenticated; select set_config('request.jwt.claim.sub','${user}',true);`)
  try { return await db.query(sql) } finally { await db.exec('rollback') }
}
async function asUserCommit(user: string, sql: string) {
  await db.exec(`begin; set local role authenticated; select set_config('request.jwt.claim.sub','${user}',true);`)
  try { const result = await db.query(sql); await db.exec('commit'); return result } catch (error) { await db.exec('rollback'); throw error }
}
async function asAnon(sql: string) {
  await db.exec('begin; set local role anon;')
  try { return await db.query(sql) } finally { await db.exec('rollback') }
}

describe('safe WorkGroup management', () => {
  it('keeps organization audit separate from the global Superadmin deletion privilege', () => {
    expect(migration).toContain('private.is_admin(p_organization_id) or private.is_superadmin(auth.uid())')
    expect(migration).toContain('not private.is_superadmin(auth.uid())')
    expect(migration).toContain("using errcode = '42501'")
    expect(migration).toContain('where id = p_group_id and organization_id = p_organization_id')
  })

  it('stores the global privilege in a database-only registry with no self-assignment path', () => {
    expect(migration).toContain('create table private.superadmins')
    expect(migration).toContain('revoke all on table private.superadmins from public, anon, authenticated')
    expect(migration).not.toMatch(/grant (insert|update|delete).*superadmins/i)
    expect(repository).not.toContain("from('superadmins')")
    expect(page).toContain('{superadmin && <Button variant="danger"')
  })

  it('locks the exact target and blocks every operational reference before deleting', () => {
    expect(migration).toContain('for update;')
    for (const reference of ['group_player_memberships', 'group_player_assignments', 'training_sessions', 'matches', 'family_publications', 'match_callups']) {
      expect(migration).toContain(`from public.${reference}`)
    }
    expect(migration).toContain("p_confirmation_name <> target.name")
    expect(migration).toContain("using errcode = '23503'")
    expect(migration).not.toMatch(/delete from public\.(group_player_memberships|group_player_assignments|training_sessions|matches|family_publications|match_callups)/)
  })

  it('removes only technical staff bindings and the exact group without broad cascades', () => {
    expect(migration).toContain('delete from public.group_memberships')
    expect(migration).toContain('delete from public.groups')
    expect(migration).not.toContain('drop table')
    expect(migration).not.toContain('truncate')
    expect(migration).not.toContain('on delete cascade')
  })

  it('uses authenticated RPCs and refreshes context after successful deletion', () => {
    expect(repository).toContain("rpc('get_organization_group_dependency_audit'")
    expect(repository).toContain("rpc('current_user_is_superadmin'")
    expect(repository).toContain("rpc('delete_empty_organization_group'")
    expect(page).toContain('confirmationName !== deleteTarget.groupName')
    expect(page).toContain('await reload(); await loadGroupAudit()')
    expect(page).toContain('availableGroups.find(group => group.id !== deleteTarget.groupId')
  })

  it('allows only the organization admin to audit its groups', async () => {
    const audit = await asUser(id.admin, `select group_name,training_sessions,can_delete from get_organization_group_dependency_audit('${id.org}') order by group_name`)
    expect(audit.rows).toEqual([
      { group_name: 'Busy', training_sessions: 1, can_delete: false },
      { group_name: 'Empty', training_sessions: 0, can_delete: true },
    ])
    await expect(asUser(id.outsider, `select * from get_organization_group_dependency_audit('${id.org}')`)).rejects.toThrow('administrator')
    await expect(asUser(id.admin, `select * from get_organization_group_dependency_audit('${id.otherOrg}')`)).rejects.toThrow('administrator')
  })

  it('denies organization admin, coach, collaborator, outsider and anonymous direct deletion calls', async () => {
    for (const user of [id.admin, id.coach, id.collaborator, id.outsider]) {
      await expect(asUser(user, `select delete_empty_organization_group('${id.org}','${id.empty}','Empty')`)).rejects.toThrow('Superadmin')
    }
    await expect(asAnon(`select delete_empty_organization_group('${id.org}','${id.empty}','Empty')`)).rejects.toThrow()
  })

  it('blocks dependencies even for Superadmin and deletes only the exact empty target', async () => {
    await expect(asUser(id.superadmin, `select delete_empty_organization_group('${id.org}','${id.busy}','Busy')`)).rejects.toThrow('operational dependencies')
    await expect(asUser(id.superadmin, `select delete_empty_organization_group('${id.org}','${id.empty}','Wrong')`)).rejects.toThrow('confirmation name')
    await asUserCommit(id.superadmin, `select delete_empty_organization_group('${id.org}','${id.empty}','Empty')`)
    expect((await db.query(`select id from groups order by id`)).rows).toEqual([{ id: id.busy }, { id: id.foreign }])
    expect((await db.query(`select count(*)::int as count from group_memberships where group_id='${id.empty}'`)).rows).toEqual([{ count: 0 }])
    expect((await db.query(`select count(*)::int as count from training_sessions where group_id='${id.busy}'`)).rows).toEqual([{ count: 1 }])
  })
})
