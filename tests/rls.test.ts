import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'

const ids = { admin: '00000000-0000-0000-0000-000000000001', coach: '00000000-0000-0000-0000-000000000002', collaborator: '00000000-0000-0000-0000-000000000003', outsider: '00000000-0000-0000-0000-000000000004', org: '10000000-0000-0000-0000-000000000001', otherOrg: '10000000-0000-0000-0000-000000000002', a: '20000000-0000-0000-0000-000000000001', b: '20000000-0000-0000-0000-000000000002', c: '20000000-0000-0000-0000-000000000003', member: '30000000-0000-0000-0000-000000000001' }
let db: PGlite
beforeAll(async () => {
  db = new PGlite()
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
    grant usage on schema auth to authenticated;
    grant execute on function auth.uid() to authenticated;`)
  await db.exec(readFileSync('supabase/migrations/202609230001_v5a_foundation.sql', 'utf8'))
  await db.exec(readFileSync('supabase/migrations/202609250001_v5a_group_admin_rls_hotfix.sql', 'utf8'))
  await db.exec(`insert into auth.users values ('${ids.admin}','admin@test.local'),('${ids.coach}','coach@test.local'),('${ids.collaborator}','collaborator@test.local'),('${ids.outsider}','outsider@test.local');
    insert into organizations(id,name,slug) values ('${ids.org}','Club','club'),('${ids.otherOrg}','Other','other');
    insert into organization_memberships(organization_id,user_id) values ('${ids.org}','${ids.admin}');
    insert into groups(id,organization_id,name,public_visible) values ('${ids.a}','${ids.org}','A',true),('${ids.b}','${ids.org}','B',false),('${ids.c}','${ids.otherOrg}','C',false);
    insert into group_memberships(organization_id,group_id,user_id,role) values ('${ids.org}','${ids.a}','${ids.coach}','coach');
    insert into group_memberships(id,organization_id,group_id,user_id,role) values ('${ids.member}','${ids.org}','${ids.a}','${ids.collaborator}','collaborator');`)
})
afterAll(async () => { await db?.close() })
async function asUser(user: string, sql: string) {
  await db.exec(`begin; set local role authenticated; select set_config('request.jwt.claim.sub','${user}',true);`)
  try { return await db.query(sql) } finally { await db.exec('rollback') }
}
describe('actual PostgreSQL RLS', () => {
  it('admin sees all organization groups without individual membership', async () => {
    expect((await asUser(ids.admin, 'select name from groups order by name')).rows).toEqual([{ name: 'A' }, { name: 'B' }])
  })
  it('allows an organization admin to create only groups in their organization', async () => {
    expect((await asUser(ids.admin, `select auth.uid() as uid, private.is_admin('${ids.org}') as admin`)).rows).toEqual([{ uid: ids.admin, admin: true }])
    await expect(asUser(ids.admin, `insert into groups(organization_id,name) values ('${ids.org}','Admin group')`)).resolves.toBeDefined()
    await expect(asUser(ids.admin, `insert into groups(organization_id,name) values ('${ids.otherOrg}','Foreign group')`)).rejects.toThrow('row-level security')
  })
  it.each([
    ['coach', ids.coach],
    ['collaborator', ids.collaborator],
  ])('denies arbitrary group creation to %s', async (_role, userId) => {
    await expect(asUser(userId, `insert into groups(organization_id,name) values ('${ids.org}','Forbidden')`)).rejects.toThrow('row-level security')
  })
  it('denies anonymous group creation', async () => {
    await db.exec('begin; set local role anon;')
    try { await expect(db.query(`insert into groups(organization_id,name) values ('${ids.org}','Anonymous')`)).rejects.toThrow() } finally { await db.exec('rollback') }
  })
  it('coach A cannot see or administer B or another organization', async () => {
    expect((await asUser(ids.coach, 'select name from groups')).rows).toEqual([{ name: 'A' }])
    expect((await asUser(ids.coach, `update groups set name='hacked' where id='${ids.b}' returning id`)).rows).toHaveLength(0)
    await expect(asUser(ids.coach, `select assign_group_staff('${ids.b}','outsider@test.local','collaborator')`)).rejects.toThrow()
  })
  it('collaborator cannot promote self, alter membership or permissions', async () => {
    expect((await asUser(ids.collaborator, `update group_memberships set role='coach' where id='${ids.member}' returning id`)).rows).toHaveLength(0)
    expect((await asUser(ids.collaborator, `update group_memberships set active=false where id='${ids.member}' returning id`)).rows).toHaveLength(0)
    await expect(asUser(ids.collaborator, `insert into collaborator_permissions(membership_id,permission,enabled) values ('${ids.member}','training.edit',true)`)).rejects.toThrow()
  })
  it('coach can manage collaborator permissions, never structural ones or admin elevation', async () => {
    expect((await asUser(ids.coach, `insert into collaborator_permissions(membership_id,permission,enabled) values ('${ids.member}','training.evaluate',true) returning permission`)).rows).toHaveLength(1)
    await expect(asUser(ids.coach, `insert into collaborator_permissions(membership_id,permission,enabled) values ('${ids.member}','staff.manage',true)`)).rejects.toThrow()
    await expect(asUser(ids.coach, `insert into organization_memberships(organization_id,user_id) values ('${ids.org}','${ids.coach}')`)).rejects.toThrow()
    await expect(asUser(ids.coach, `update group_memberships set role='coach' where id='${ids.member}'`)).rejects.toThrow()
  })
  it('outsider cannot self-assign', async () => {
    await expect(asUser(ids.outsider, `insert into group_memberships(organization_id,group_id,user_id,role) values ('${ids.org}','${ids.a}','${ids.outsider}','coach')`)).rejects.toThrow()
    expect((await asUser(ids.outsider, 'select * from organizations')).rows).toHaveLength(0)
  })
  it('denies inactive members and inactive groups to normal staff', async () => {
    await db.exec(`update group_memberships set active=false where id='${ids.member}'`)
    expect((await asUser(ids.collaborator, 'select * from groups')).rows).toHaveLength(0)
    await db.exec(`update group_memberships set active=true where id='${ids.member}'; update groups set active=false where id='${ids.a}'`)
    expect((await asUser(ids.coach, 'select * from groups')).rows).toHaveLength(0)
    expect((await asUser(ids.admin, 'select * from groups')).rows).toHaveLength(2)
    await db.exec(`update groups set active=true where id='${ids.a}'`)
  })
  it('prevents moving memberships across tenants', async () => {
    await expect(asUser(ids.admin, `update group_memberships set group_id='${ids.b}' where id='${ids.member}'`)).rejects.toThrow('Immutable membership target')
  })
  it('allows intended administrative edits and assignment RPC', async () => {
    expect((await asUser(ids.admin, `update groups set name='A edited' where id='${ids.a}' returning name`)).rows).toEqual([{ name: 'A edited' }])
    await expect(asUser(ids.coach, `select assign_group_staff('${ids.a}','outsider@test.local','collaborator')`)).resolves.toBeDefined()
    await expect(asUser(ids.admin, `select assign_group_staff('${ids.b}','outsider@test.local','coach')`)).resolves.toBeDefined()
  })
  it('anonymous directory exposes only explicit public metadata', async () => {
    await db.exec('begin; set local role anon;')
    try { expect((await db.query('select * from public_group_directory()')).rows).toEqual([{ id: ids.a, name: 'A', season: null, description: null, organization_name: 'Club' }]) } finally { await db.exec('rollback') }
    await db.exec('begin; set local role anon;')
    try { await expect(db.query('select * from profiles')).rejects.toThrow() } finally { await db.exec('rollback') }
  })
})
