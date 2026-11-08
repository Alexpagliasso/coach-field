import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const migrations = ['202611050030_organization_staff_directory.sql', '202611080031_staff_group_assignments.sql', '202611080032_staff_account_linking.sql']
const id = { admin:'00000000-0000-0000-0000-000000000001', account:'00000000-0000-0000-0000-000000000002', outsider:'00000000-0000-0000-0000-000000000003', org:'10000000-0000-0000-0000-000000000001', otherOrg:'10000000-0000-0000-0000-000000000002', a:'20000000-0000-0000-0000-000000000001', b:'20000000-0000-0000-0000-000000000002' }
let db:PGlite, person=''
beforeAll(async()=>{
  db=new PGlite()
  await db.exec(`create role anon; create role authenticated; create schema auth; create schema private;
  create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  create table profiles(id uuid primary key references auth.users(id)); create table organizations(id uuid primary key);
  create table organization_memberships(organization_id uuid,user_id uuid,active boolean default true);
  create table groups(id uuid primary key,organization_id uuid,name text,unique(id,organization_id));
  create table group_memberships(id uuid primary key default gen_random_uuid(),organization_id uuid,group_id uuid,user_id uuid,role text,active boolean default true,unique(group_id,user_id));
  create function private.is_admin(org uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.organization_memberships where organization_id=org and user_id=auth.uid() and active)$$;
  grant usage on schema public,auth to authenticated; grant execute on function auth.uid(),private.is_admin(uuid) to authenticated;
  insert into auth.users values('${id.admin}'),('${id.account}'),('${id.outsider}'); insert into profiles values('${id.admin}'),('${id.account}'),('${id.outsider}');
  insert into organizations values('${id.org}'),('${id.otherOrg}'); insert into organization_memberships values('${id.org}','${id.admin}',true);
  insert into groups values('${id.a}','${id.org}','A'),('${id.b}','${id.org}','B');`)
  await db.exec(readFileSync('supabase/migrations/'+migrations[0],'utf8'))
  await db.exec(readFileSync('supabase/migrations/'+migrations[1],'utf8'))
  const p=await asUser<{id:string}>(id.admin,`insert into organization_staff_people(organization_id,first_name,last_name,intended_role) values('${id.org}','Ada','Rossi','collaborator') returning id`,true); person=p.rows[0].id
  await asUser(id.admin,`insert into organization_staff_group_assignments(organization_id,staff_person_id,group_id,intended_role) values('${id.org}','${person}','${id.a}','coach'),('${id.org}','${person}','${id.b}','collaborator')`,true)
  await db.exec(readFileSync('supabase/migrations/'+migrations[2],'utf8'))
})
afterAll(async()=>db?.close())
async function asUser<T=unknown>(user:string,sql:string,commit=false){await db.exec(`begin;set local role authenticated;select set_config('request.jwt.claim.sub','${user}',true);`);try{const r=await db.query<T>(sql);await db.exec(commit?'commit':'rollback');return r}catch(e){await db.exec('rollback');throw e}}

describe('verified staff account linking',()=>{
  it('requires admin initiation and authenticated one-time acceptance',async()=>{
    await expect(asUser(id.outsider,`select create_staff_account_link_invitation('${id.org}','${person}')`)).rejects.toThrow('administrator')
    const invite=await asUser<{create_staff_account_link_invitation:string}>(id.admin,`select create_staff_account_link_invitation('${id.org}','${person}')`,true)
    const token=invite.rows[0].create_staff_account_link_invitation
    await asUser(id.account,`select accept_staff_account_link('${token}')`,true)
    await expect(asUser(id.outsider,`select accept_staff_account_link('${token}')`)).rejects.toThrow('invalid or expired')
    expect((await db.query(`select group_id,role,user_id from group_memberships order by group_id`)).rows).toEqual([{group_id:id.a,role:'coach',user_id:id.account},{group_id:id.b,role:'collaborator',user_id:id.account}])
  })
  it('updates and removes only managed memberships atomically',async()=>{
    const assignment=(await db.query<{id:string}>(`select id from organization_staff_group_assignments where group_id='${id.b}'`)).rows[0].id
    await asUser(id.admin,`select save_staff_group_assignment('${assignment}','${id.org}','${person}','${id.b}','coach')`,true)
    expect((await db.query(`select role from group_memberships where group_id='${id.b}'`)).rows).toEqual([{role:'coach'}])
    await asUser(id.admin,`select delete_staff_group_assignment('${assignment}','${id.org}','${person}')`,true)
    expect((await db.query(`select group_id from group_memberships`)).rows).toEqual([{group_id:id.a}])
  })
  it('revokes the link and all remaining managed access',async()=>{
    await asUser(id.admin,`select revoke_staff_account_link('${id.org}','${person}')`,true)
    expect((await db.query(`select linked_user_id from organization_staff_people where id='${person}'`)).rows).toEqual([{linked_user_id:null}])
    expect((await db.query('select id from group_memberships')).rows).toEqual([])
  })
  it('links an account with no assignments without granting any group access',async()=>{
    const created=await asUser<{id:string}>(id.admin,`insert into organization_staff_people(organization_id,first_name,last_name,intended_role) values('${id.org}','Nora','Vuota','collaborator') returning id`,true)
    const invite=await asUser<{create_staff_account_link_invitation:string}>(id.admin,`select create_staff_account_link_invitation('${id.org}','${created.rows[0].id}')`,true)
    await asUser(id.outsider,`select accept_staff_account_link('${invite.rows[0].create_staff_account_link_invitation}')`,true)
    expect((await db.query(`select count(*)::int as count from group_memberships where user_id='${id.outsider}'`)).rows).toEqual([{count:0}])
  })
  it('keeps routing and selectors membership-driven',()=>{
    const provider=readFileSync('src/groups/GroupProvider.tsx','utf8'), guard=readFileSync('src/auth/Guards.tsx','utf8')
    expect(provider).toContain('data.groups.filter(group => groupRole(data, userId, group))')
    expect(guard).toContain('return activeGroup ? <Outlet')
  })
})
