import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'

const files = ['202609230001_v5a_foundation.sql','202609250001_v5a_group_admin_rls_hotfix.sql','202610060001_v6_2a_organization_bootstrap.sql','202610070003_team_workgroup_foundation.sql','202610070004_organization_seasons_foundation.sql']
const ids = { admin:'a0000000-0000-0000-0000-000000000001', outsider:'a0000000-0000-0000-0000-000000000002', org:'b0000000-0000-0000-0000-000000000001', season:'c0000000-0000-0000-0000-000000000001', team:'d0000000-0000-0000-0000-000000000001', red:'e0000000-0000-0000-0000-000000000001', blue:'e0000000-0000-0000-0000-000000000002' }
let db: PGlite
const asUser = async (user: string, sql: string) => { await db.exec(`begin; set local role authenticated; select set_config('request.jwt.claim.sub','${user}',true)`); try { return await db.query(sql) } finally { await db.exec('rollback') } }
const asUserCommit = async (user: string, sql: string) => { await db.exec(`begin; set local role authenticated; select set_config('request.jwt.claim.sub','${user}',true)`); try { const result = await db.query(sql); await db.exec('commit'); return result } catch (error) { await db.exec('rollback'); throw error } }
const asAnon = async (sql: string) => { await db.exec('begin; set local role anon'); try { return await db.query(sql) } finally { await db.exec('rollback') } }

beforeAll(async () => {
  db = new PGlite()
  await db.exec("create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key,email text); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;")
  for (const file of files) await db.exec(readFileSync(`supabase/migrations/${file}`,'utf8'))
  await db.exec("create table public.family_publications(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),group_id uuid references public.groups(id),content_type text not null,title text not null,public_content text not null,reference_date date not null,status text not null,published_at timestamptz,created_by uuid not null default auth.uid() references public.profiles(id)); alter table public.family_publications enable row level security; grant insert on public.family_publications to authenticated; create policy family_admin_insert on public.family_publications for insert to authenticated with check(private.is_admin(organization_id));")
  await db.exec(readFileSync('supabase/migrations/202611160035_family_workgroup_public_routes.sql','utf8'))
  await db.exec(`insert into auth.users values ('${ids.admin}','admin@test'),('${ids.outsider}','out@test'); insert into organizations(id,name,slug) values ('${ids.org}','Club','club'); insert into organization_memberships(organization_id,user_id) values ('${ids.org}','${ids.admin}'); insert into organization_seasons(id,organization_id,name) values ('${ids.season}','${ids.org}','2026/27'); insert into teams(id,organization_id,season_id,name) values ('${ids.team}','${ids.org}','${ids.season}','Pulcini Misti'); insert into groups(id,organization_id,team_id,name) values ('${ids.red}','${ids.org}','${ids.team}','Rossi'),('${ids.blue}','${ids.org}','${ids.team}','Blu');`)
  await db.exec(`begin; set local role authenticated; select set_config('request.jwt.claim.sub','${ids.admin}',true); insert into family_publications(organization_id,group_id,content_type,title,public_content,reference_date,status,published_at) values ('${ids.org}','${ids.red}','objective','Rossi','Solo rossi','2026-11-16','published',now()),('${ids.org}','${ids.blue}','objective','Blu','Solo blu','2026-11-16','published',now()),('${ids.org}','${ids.red}','objective','Bozza','Privata','2026-11-16','draft',null); commit;`)
})
afterAll(async () => db.close())

describe('family public route database boundary', () => {
  it('creates readable independent routes and anonymous feeds remain isolated', async () => {
    expect((await asUserCommit(ids.admin, `select ensure_family_public_route('${ids.red}') path`)).rows).toEqual([{ path:'/2026-27/pulcini-misti/rossi' }])
    expect((await asUserCommit(ids.admin, `select ensure_family_public_route('${ids.blue}') path`)).rows).toEqual([{ path:'/2026-27/pulcini-misti/blu' }])
    expect((await asAnon("select title from get_family_publications_for_path('2026-27','pulcini-misti','rossi')")).rows).toEqual([{ title:'Rossi' }])
    expect((await asAnon("select title from get_family_publications_for_path('2026-27','pulcini-misti','blu')")).rows).toEqual([{ title:'Blu' }])
  })

  it('updates a renamed group route without letting the old path resolve another group', async () => {
    await db.exec(`update groups set name='Granata' where id='${ids.red}'`)
    expect((await asUserCommit(ids.admin, `select ensure_family_public_route('${ids.red}') path`)).rows).toEqual([{ path:'/2026-27/pulcini-misti/granata' }])
    expect((await asAnon("select count(*)::int count from get_family_publications_for_path('2026-27','pulcini-misti','rossi')")).rows).toEqual([{ count:0 }])
    expect((await asAnon("select title from get_family_publications_for_path('2026-27','pulcini-misti','granata')")).rows).toEqual([{ title:'Rossi' }])
  })

  it('requires server-side organization administration to create or update aliases', async () => {
    await expect(asUser(ids.outsider, `select ensure_family_public_route('${ids.blue}')`)).rejects.toThrow('Permission denied')
  })
})
