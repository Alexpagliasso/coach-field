import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'

const ids = { admin: '00000000-0000-0000-0000-000000000001', coach: '00000000-0000-0000-0000-000000000002', collaborator: '00000000-0000-0000-0000-000000000003', outsider: '00000000-0000-0000-0000-000000000004', org: '10000000-0000-0000-0000-000000000001', otherOrg: '10000000-0000-0000-0000-000000000002', a: '20000000-0000-0000-0000-000000000001', b: '20000000-0000-0000-0000-000000000002', c: '20000000-0000-0000-0000-000000000003', member: '30000000-0000-0000-0000-000000000001', player: '40000000-0000-0000-0000-000000000001', otherPlayer: '40000000-0000-0000-0000-000000000002', playerMembership: '50000000-0000-0000-0000-000000000001' }
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
  await db.exec(readFileSync('supabase/migrations/202610060001_v6_2a_organization_bootstrap.sql', 'utf8'))
  await db.exec(readFileSync('supabase/migrations/202610070001_player_cloud_foundation.sql', 'utf8'))
  await db.exec(readFileSync('supabase/migrations/202610070002_atomic_player_import.sql', 'utf8'))
  await db.exec(readFileSync('supabase/migrations/202610070003_team_workgroup_foundation.sql', 'utf8'))
  await db.exec(readFileSync('supabase/migrations/202610070004_organization_seasons_foundation.sql', 'utf8'))
  await db.exec(readFileSync('supabase/migrations/202610070005_team_membership_group_assignment_foundation.sql', 'utf8'))
  await db.exec(readFileSync('supabase/migrations/202610080006_fix_organization_season_returning_rls.sql', 'utf8'))
  await db.exec(readFileSync('supabase/migrations/202610080007_fix_team_returning_rls.sql', 'utf8'))
  await db.exec(readFileSync('supabase/migrations/202610080008_team_roster_player_access_and_create.sql', 'utf8'))
  await db.exec(readFileSync('supabase/migrations/202610080009_atomic_workgroup_player_assignment.sql', 'utf8'))
  await db.exec(readFileSync('supabase/migrations/202610080010_safe_player_lifecycle.sql', 'utf8'))
  await db.exec(readFileSync('supabase/migrations/202610080011_workgroup_roster_cloud_access.sql', 'utf8'))
  await db.exec(readFileSync('supabase/migrations/202610080012_batch_workgroup_roster_assignment.sql', 'utf8'))
  await db.exec(readFileSync('supabase/migrations/202610080013_cloud_training_library.sql', 'utf8'))
  await db.exec(readFileSync('supabase/migrations/202610080014_cloud_training_attendance.sql', 'utf8'))
  await db.exec(readFileSync('supabase/migrations/202610090015_cloud_matches.sql', 'utf8'))
  await db.exec(readFileSync('supabase/migrations/202610100016_match_callup_candidates.sql', 'utf8'))
  await db.exec(readFileSync('supabase/migrations/202610200028_training_session_visibility.sql', 'utf8'))
  await db.exec(`insert into auth.users values ('${ids.admin}','admin@test.local'),('${ids.coach}','coach@test.local'),('${ids.collaborator}','collaborator@test.local'),('${ids.outsider}','outsider@test.local');
    insert into organizations(id,name,slug) values ('${ids.org}','Club','club'),('${ids.otherOrg}','Other','other');
    insert into organization_memberships(organization_id,user_id) values ('${ids.org}','${ids.admin}');
    insert into groups(id,organization_id,name,public_visible) values ('${ids.a}','${ids.org}','A',true),('${ids.b}','${ids.org}','B',false),('${ids.c}','${ids.otherOrg}','C',false);
    insert into group_memberships(organization_id,group_id,user_id,role) values ('${ids.org}','${ids.a}','${ids.coach}','coach');
    insert into group_memberships(id,organization_id,group_id,user_id,role) values ('${ids.member}','${ids.org}','${ids.a}','${ids.collaborator}','collaborator');
    insert into collaborator_permissions(membership_id,permission,enabled) values ('${ids.member}','players.create',true);
    insert into players(id,organization_id,first_name,last_name,birth_year) values ('${ids.player}','${ids.org}','Mario','Rossi',2016),('${ids.otherPlayer}','${ids.otherOrg}','Other','Player',2017);
    insert into group_player_memberships(id,organization_id,group_id,player_id,season) values ('${ids.playerMembership}','${ids.org}','${ids.a}','${ids.player}','2026/2027');`)
})

describe('workgroup cloud roster', () => {
  const team = 'f0000000-0000-0000-0000-000000000001'
  beforeAll(async () => {
    await db.exec(`insert into teams(id,organization_id,name) values ('${team}','${ids.org}','Cloud roster') on conflict (id) do nothing;
      update groups set team_id='${team}' where id='${ids.a}';`)
  })
  const create = (groupId = ids.a) => `select * from create_workgroup_roster_player(
    '${ids.org}','${team}','${groupId}','Cloud','Player',2016)`

  it('atomically persists a player, category membership and active WorkGroup assignment', async () => {
    await asUserSession(ids.coach, async () => {
      const created = (await db.query<{ player_id: string }>(create())).rows[0]
      expect(created).toEqual({ player_id: expect.any(String), membership_id: expect.any(String), assignment_id: expect.any(String) })
      expect((await db.query(`select group_id from group_player_assignments assignment join team_player_memberships membership on membership.id=assignment.team_player_membership_id where membership.player_id='${created.player_id}' and assignment.status='active'`)).rows)
        .toEqual([{ group_id: ids.a }])
      expect((await db.query(`select id from group_player_assignments where group_id='${ids.b}' and team_player_membership_id in (select id from team_player_memberships where player_id='${created.player_id}')`)).rows).toEqual([])
    })
  })

  it('rejects users without the current WorkGroup player-create permission', async () => {
    await expect(asUser(ids.outsider, create())).rejects.toThrow('Permission denied')
  })

  it('rejects null names and organization or category mismatches before any insert', async () => {
    await expect(asUser(ids.coach, `select * from create_workgroup_roster_player('${ids.org}','${team}','${ids.a}',null,'Player',2016)`)).rejects.toThrow('Player first and last name')
    await expect(asUser(ids.coach, `select * from create_workgroup_roster_player('${ids.otherOrg}','${team}','${ids.a}','Cloud','Player',2016)`)).rejects.toThrow('does not belong')
  })

  it('does not expose a player assigned only to another WorkGroup in the same category', async () => {
    const isolatedPlayer = 'f2000000-0000-0000-0000-000000000001'
    try {
      await db.exec(`update groups set team_id='${team}' where id='${ids.b}';
        insert into players(id,organization_id,first_name,last_name) values ('${isolatedPlayer}','${ids.org}','Isolated','B');
        insert into team_player_memberships(organization_id,team_id,player_id) values ('${ids.org}','${team}','${isolatedPlayer}');
        insert into group_player_assignments(organization_id,team_id,group_id,team_player_membership_id)
        select '${ids.org}','${team}','${ids.b}',id from team_player_memberships where player_id='${isolatedPlayer}';`)
      expect((await asUser(ids.coach, `select id from players where id='${isolatedPlayer}'`)).rows).toEqual([])
    } finally {
      await db.exec(`delete from group_player_assignments where group_id='${ids.b}' and team_player_membership_id in (select id from team_player_memberships where player_id='${isolatedPlayer}');
        delete from team_player_memberships where player_id='${isolatedPlayer}'; delete from players where id='${isolatedPlayer}'; update groups set team_id=null where id='${ids.b}';`)
    }
  })

  it('assigns multiple category players atomically and rejects non-admin assignment', async () => {
    const first = 'f3000000-0000-0000-0000-000000000001', second = 'f3000000-0000-0000-0000-000000000002'
    try {
      await db.exec(`insert into players(id,organization_id,first_name,last_name) values ('${first}','${ids.org}','Batch','One'),('${second}','${ids.org}','Batch','Two');
        insert into team_player_memberships(organization_id,team_id,player_id) values ('${ids.org}','${team}','${first}'),('${ids.org}','${team}','${second}');`)
      const sql = `select * from assign_team_roster_players_to_workgroup('${ids.a}', array(select id from team_player_memberships where player_id in ('${first}','${second}')))`
      await expect(asUser(ids.coach, sql)).rejects.toThrow('Permission denied')
      expect((await asUser(ids.admin, sql)).rows).toEqual([{ assigned_count: 2, moved_count: 0 }])
      expect((await db.query(`select count(*)::int as count from group_player_assignments where group_id='${ids.a}' and team_player_membership_id in (select id from team_player_memberships where player_id in ('${first}','${second}')) and status='active'`)).rows).toEqual([{ count: 0 }])
    } finally {
      await db.exec(`delete from group_player_assignments where team_player_membership_id in (select id from team_player_memberships where player_id in ('${first}','${second}'));
        delete from team_player_memberships where player_id in ('${first}','${second}'); delete from players where id in ('${first}','${second}');`)
    }
  })

  it('can be safely re-executed without changing its function signature or grants', async () => {
    await db.exec(readFileSync('supabase/migrations/202610080011_workgroup_roster_cloud_access.sql', 'utf8'))
    expect((await db.query(`select has_function_privilege('authenticated','public.create_workgroup_roster_player(uuid,uuid,uuid,text,text,integer)','EXECUTE') as authenticated,
      has_function_privilege('anon','public.create_workgroup_roster_player(uuid,uuid,uuid,text,text,integer)','EXECUTE') as anon`)).rows)
      .toEqual([{ authenticated: true, anon: false }])
  })
})
describe('cloud training library RPC and integrity', () => {
  const exA = '71000000-0000-0000-0000-000000000001'
  const exOther = '71000000-0000-0000-0000-000000000002'
  const sessionA = '72000000-0000-0000-0000-000000000001'
  const sessionB = '72000000-0000-0000-0000-000000000002'
  const sessionRollback = '72000000-0000-0000-0000-000000000003'
  const exerciseJson = (exerciseId: string, duration = 20, name?: string) => `'[{"exerciseId":"${exerciseId}","durationMinutes":${duration},"snapshotName":${name ? `"${name}"` : 'null'},"coachNotes":"note"}]'::jsonb`
  const save = (sessionId: string | null, groupId: string, exercises: string, title = 'Seduta tecnica') => `select save_training_session(${sessionId ? `'${sessionId}'` : 'null'},'${groupId}','2026-10-10','18:30','${title}','Possesso',60,'note','planned',${exercises}) as id`

  beforeAll(async () => {
    await db.exec(`insert into exercise_library_items(id,organization_id,name,objective,short_description,created_by,source_collection,source_id)
      values ('${exA}','${ids.org}','Rondo base','Possesso','Snapshot iniziale','${ids.admin}','fixture','a'),
      ('${exOther}','${ids.otherOrg}','Rondo esterno','Possesso','Non disponibile','${ids.admin}','fixture','other');
      insert into training_sessions(id,organization_id,group_id,session_date,title,planned_duration_minutes,created_by)
      values ('${sessionRollback}','${ids.org}','${ids.a}','2026-10-01','Baseline',60,'${ids.admin}');
      insert into training_session_exercises(training_session_id,exercise_id,position,snapshot_name,snapshot_objective,snapshot_description,duration_minutes)
      values ('${sessionRollback}','${exA}',1,'Snapshot baseline','Possesso','Snapshot iniziale',20);`)
  })

  it('creates and modifies a session atomically through save_training_session', async () => {
    await asUserSession(ids.coach, async () => {
      expect((await db.query(save(null, ids.a, exerciseJson(exA), 'Prima seduta'))).rows[0].id).toMatch(/[0-9a-f-]{36}/)
      const created = (await db.query(`select id from training_sessions where title='Prima seduta'`)).rows[0].id as string
      expect((await db.query(save(created, ids.a, exerciseJson(exA, 35, 'Snapshot scelto'), 'Seduta aggiornata'))).rows).toEqual([{ id: created }])
      expect((await db.query(`select title,planned_duration_minutes from training_sessions where id='${created}'`)).rows).toEqual([{ title: 'Seduta aggiornata', planned_duration_minutes: 60 }])
      expect((await db.query(`select position,duration_minutes,snapshot_name from training_session_exercises where training_session_id='${created}'`)).rows).toEqual([{ position: 1, duration_minutes: 35, snapshot_name: 'Snapshot scelto' }])
    })
  })

  it('rejects edits to a session in an unauthorized WorkGroup', async () => {
    await db.exec(`insert into training_sessions(id,organization_id,group_id,session_date,title,planned_duration_minutes,created_by) values ('${sessionB}','${ids.org}','${ids.b}','2026-10-02','Gruppo B',60,'${ids.admin}')`)
    await expect(asUser(ids.coach, save(sessionB, ids.b, "'[]'::jsonb"))).rejects.toThrow('Permission denied')
    expect((await db.query(`select title from training_sessions where id='${sessionB}'`)).rows).toEqual([{ title: 'Gruppo B' }])
  })

  it('enforces organization isolation for exercises and sessions', async () => {
    await expect(asUser(ids.coach, save(null, ids.a, exerciseJson(exOther)))).rejects.toThrow('does not belong to organization')
    expect((await asUser(ids.coach, `select id from exercise_library_items where organization_id='${ids.otherOrg}'`)).rows).toEqual([])
    expect((await asUser(ids.coach, `select id from training_sessions where group_id='${ids.b}'`)).rows).toEqual([])
  })

  it('keeps a historical snapshot after the source exercise is modified', async () => {
    await db.exec(`update exercise_library_items set name='Rondo aggiornato', short_description='Nuova descrizione' where id='${exA}'`)
    expect((await db.query(`select snapshot_name,snapshot_description from training_session_exercises where training_session_id='${sessionRollback}'`)).rows)
      .toEqual([{ snapshot_name: 'Snapshot baseline', snapshot_description: 'Snapshot iniziale' }])
  })

  it('orders exercise snapshots deterministically and enforces unique positions', async () => {
    await asUserSession(ids.coach, async () => {
      const result = await db.query(save(null, ids.a, `'[{"exerciseId":"${exA}","durationMinutes":10},{"snapshotName":"Secondo","durationMinutes":15}]'::jsonb`, 'Ordinamento'))
      const id = result.rows[0].id as string
      expect((await db.query(`select position,snapshot_name from training_session_exercises where training_session_id='${id}' order by position`)).rows)
        .toEqual([{ position: 1, snapshot_name: 'Rondo aggiornato' }, { position: 2, snapshot_name: 'Secondo' }])
      await expect(db.query(`insert into training_session_exercises(training_session_id,position,snapshot_name,duration_minutes) values ('${id}',1,'Duplicato',10)`)).rejects.toThrow()
    })
  })

  it('duplicates session headers, exercises and their snapshots', async () => {
    await asUserSession(ids.admin, async () => {
      const copied = (await db.query(`select duplicate_training_session('${sessionRollback}','2026-11-01') as id`)).rows[0].id as string
      expect((await db.query(`select session_date::text,title,status from training_sessions where id='${copied}'`)).rows).toEqual([{ session_date: '2026-11-01', title: 'Baseline copia', status: 'planned' }])
      expect((await db.query(`select snapshot_name,snapshot_description,duration_minutes from training_session_exercises where training_session_id='${copied}'`)).rows)
        .toEqual([{ snapshot_name: 'Snapshot baseline', snapshot_description: 'Snapshot iniziale', duration_minutes: 20 }])
    })
  })

  it('rolls back the header and exercise changes for invalid payloads', async () => {
    await expect(asUser(ids.coach, save(null, ids.a, exerciseJson(exA, 0), 'Invalid duration'))).rejects.toThrow('Exercise duration is invalid')
    await expect(asUser(ids.coach, save(sessionRollback, ids.a, exerciseJson(exOther), 'Should rollback'))).rejects.toThrow('does not belong to organization')
    expect((await db.query(`select title from training_sessions where id='${sessionRollback}'`)).rows).toEqual([{ title: 'Baseline' }])
    expect((await db.query(`select snapshot_name from training_session_exercises where training_session_id='${sessionRollback}'`)).rows).toEqual([{ snapshot_name: 'Snapshot baseline' }])
  })

  it('applies admin, coach and collaborator training permissions', async () => {
    await expect(asUser(ids.collaborator, `select * from exercise_library_items`)).resolves.toBeDefined()
    await expect(asUser(ids.collaborator, save(null, ids.a, "'[]'::jsonb", 'Collaborator denied'))).rejects.toThrow('Permission denied')
    await db.exec(`insert into collaborator_permissions(membership_id,permission,enabled) values ('${ids.member}','training.edit',true) on conflict (membership_id,permission) do update set enabled=true`)
    await asUserSession(ids.collaborator, async () => { expect((await db.query(save(null, ids.a, "'[]'::jsonb", 'Collaborator allowed'))).rows).toHaveLength(1) })
    await asUserSession(ids.admin, async () => { expect((await db.query(save(null, ids.b, "'[]'::jsonb", 'Admin allowed'))).rows).toHaveLength(1) })
  })
})

describe('training session visibility', () => {
  const hiddenSession = '90000000-0000-0000-0000-000000000001'

  it('allows only an organization admin to hide or restore a session', async () => {
    await db.exec(`insert into training_sessions(id,organization_id,group_id,session_date,title,planned_duration_minutes,created_by)
      values ('${hiddenSession}','${ids.org}','${ids.a}','2026-10-30','Seduta di prova',60,'${ids.admin}') on conflict (id) do nothing`)
    await expect(asUser(ids.coach, `update training_sessions set is_hidden=true where id='${hiddenSession}'`)).rejects.toThrow('Only organization administrators can change training session visibility')
    await expect(asUser(ids.collaborator, `update training_sessions set is_hidden=true where id='${hiddenSession}'`)).rejects.toThrow('Only organization administrators can change training session visibility')
    await asUserSession(ids.admin, async () => {
      await db.query(`update training_sessions set is_hidden=true where id='${hiddenSession}'`)
      expect((await db.query(`select is_hidden from training_sessions where id='${hiddenSession}'`)).rows).toEqual([{ is_hidden: true }])
      await db.query(`update training_sessions set is_hidden=false where id='${hiddenSession}'`)
      expect((await db.query(`select is_hidden from training_sessions where id='${hiddenSession}'`)).rows).toEqual([{ is_hidden: false }])
    })
  })
})

afterAll(async () => { await db?.close() })
async function asUser(user: string, sql: string) {
  await db.exec(`begin; set local role authenticated; select set_config('request.jwt.claim.sub','${user}',true);`)
  try { return await db.query(sql) } finally { await db.exec('rollback') }
}
async function asUserSession<T>(user: string, run: () => Promise<T>) {
  await db.exec(`begin; set local role authenticated; select set_config('request.jwt.claim.sub','${user}',true);`)
  try { return await run() } finally { await db.exec('rollback') }
}
describe('actual PostgreSQL RLS', () => {
  it('admin sees all organization groups without individual membership', async () => {
    expect((await asUser(ids.admin, 'select name from groups order by name')).rows).toEqual([{ name: 'A' }, { name: 'B' }])
  })
  it('allows an organization admin to create only groups in their organization', async () => {
    expect((await asUser(ids.admin, `select auth.uid() as uid, private.is_admin('${ids.org}') as admin`)).rows).toEqual([{ uid: ids.admin, admin: true }])
    await asUserSession(ids.admin, async () => {
      await db.query(`insert into groups(organization_id,name,season) values ('${ids.org}','Admin group','2026/2027')`)
      expect((await db.query(`select organization_id,name,season from groups where name='Admin group'`)).rows)
        .toEqual([{ organization_id: ids.org, name: 'Admin group', season: '2026/2027' }])
    })
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

describe('organization bootstrap RPC', () => {
  it('is owned by postgres, security definer, search-path hardened and authenticated-only', async () => {
    expect((await db.query(`select r.rolname as owner, p.prosecdef as security_definer, p.proconfig as config
      from pg_proc p join pg_roles r on r.oid=p.proowner
      where p.oid='public.bootstrap_organization(text)'::regprocedure`)).rows)
      .toEqual([{ owner: 'postgres', security_definer: true, config: ['search_path=""'] }])
    expect((await db.query(`select
      has_function_privilege('authenticated','public.bootstrap_organization(text)','EXECUTE') as authenticated,
      has_function_privilege('anon','public.bootstrap_organization(text)','EXECUTE') as anon`)).rows)
      .toEqual([{ authenticated: true, anon: false }])
  })

  it('creates an organization and an active admin membership for the authenticated caller', async () => {
    await asUserSession(ids.coach, async () => {
      const created = await db.query<{ id: string; name: string; slug: string }>(`select (bootstrap_organization('  Auxilium Monterosa  ')).*`)
      expect(created.rows[0].name).toBe('Auxilium Monterosa')
      expect(created.rows[0].slug).toMatch(/^auxilium-monterosa-[a-f0-9]{32}$/)
      expect((await db.query(`select role, active, user_id from organization_memberships where organization_id='${created.rows[0].id}'`)).rows)
        .toEqual([{ role: 'admin', active: true, user_id: ids.coach }])
    })
  })

  it('rejects an anonymous caller', async () => {
    await db.exec('begin; set local role anon;')
    try { await expect(db.query(`select bootstrap_organization('Anonymous Club')`)).rejects.toThrow() } finally { await db.exec('rollback') }
  })

  it.each([['empty', ''], ['whitespace-only', '   ']])('rejects an %s name', async (_case, name) => {
    await expect(asUser(ids.coach, `select bootstrap_organization('${name}')`)).rejects.toThrow('Organization name is required')
  })

  it('allows one authenticated user to create multiple organizations', async () => {
    await asUserSession(ids.coach, async () => {
      await db.query(`select bootstrap_organization('Auxilium Monterosa')`)
      await db.query(`select bootstrap_organization('Atletico Barriera')`)
      expect((await db.query(`select o.name, m.role from organizations o join organization_memberships m on m.organization_id=o.id where m.user_id='${ids.coach}' order by o.name`)).rows)
        .toEqual([{ name: 'Atletico Barriera', role: 'admin' }, { name: 'Auxilium Monterosa', role: 'admin' }])
    })
  })

  it('does not grant another user membership in the new organization', async () => {
    await asUserSession(ids.coach, async () => {
      const created = await db.query<{ id: string }>(`select (bootstrap_organization('Caller Only Club')).id`)
      expect((await db.query(`select user_id from organization_memberships where organization_id='${created.rows[0].id}'`)).rows)
        .toEqual([{ user_id: ids.coach }])
      expect((await db.query(`select 1 from organization_memberships where organization_id='${created.rows[0].id}' and user_id='${ids.outsider}'`)).rows).toHaveLength(0)
    })
  })

  it('rolls back the organization when membership creation fails', async () => {
    const userWithoutProfile = '00000000-0000-0000-0000-000000000099'
    await db.exec(`insert into auth.users values ('${userWithoutProfile}','rollback@test.local'); delete from profiles where id='${userWithoutProfile}'`)
    const before = Number((await db.query<{ count: number }>(`select count(*)::int as count from organizations where name='Rollback Club'`)).rows[0].count)
    await expect(asUser(userWithoutProfile, `select bootstrap_organization('Rollback Club')`)).rejects.toThrow()
    const after = Number((await db.query<{ count: number }>(`select count(*)::int as count from organizations where name='Rollback Club'`)).rows[0].count)
    expect(after).toBe(before)
  })
})

describe('player cloud foundation RLS and integrity', () => {
  const newPlayer = '40000000-0000-0000-0000-000000000010'

  it('lets an organization admin create and update an organization player', async () => {
    await asUserSession(ids.admin, async () => {
      await db.query(`insert into players(id,organization_id,first_name,last_name,birth_year) values ('${newPlayer}','${ids.org}','Luca','Bianchi',2016)`)
      expect((await db.query(`select organization_id,first_name,last_name,birth_year from players where id='${newPlayer}'`)).rows)
        .toEqual([{ organization_id: ids.org, first_name: 'Luca', last_name: 'Bianchi', birth_year: 2016 }])
      await db.query(`update players set first_name='Luciano' where id='${newPlayer}'`)
      expect((await db.query(`select first_name from players where id='${newPlayer}'`)).rows).toEqual([{ first_name: 'Luciano' }])
    })
  })

  it('lets a coach create players and memberships only in an authorized organization/group', async () => {
    await asUserSession(ids.coach, async () => {
      await db.query(`insert into players(id,organization_id,first_name) values ('${newPlayer}','${ids.org}','Coach player')`)
      await db.query(`insert into group_player_memberships(organization_id,group_id,player_id,season) values ('${ids.org}','${ids.a}','${newPlayer}','2026/2027')`)
      expect((await db.query(`select p.first_name from players p join group_player_memberships m on m.player_id=p.id where m.group_id='${ids.a}' and p.id='${newPlayer}'`)).rows)
        .toEqual([{ first_name: 'Coach player' }])
      await expect(db.query(`insert into group_player_memberships(organization_id,group_id,player_id,season) values ('${ids.otherOrg}','${ids.c}','${ids.otherPlayer}','2026/2027')`)).rejects.toThrow('row-level security')
    })
  })

  it('enforces collaborator create and edit permissions independently', async () => {
    await asUserSession(ids.collaborator, async () => {
      await db.query(`insert into players(id,organization_id,first_name) values ('${newPlayer}','${ids.org}','Collaborator player')`)
      await db.query(`insert into group_player_memberships(organization_id,group_id,player_id,season) values ('${ids.org}','${ids.a}','${newPlayer}','2026/2027')`)
      expect((await db.query(`select first_name from players where id='${newPlayer}'`)).rows).toEqual([{ first_name: 'Collaborator player' }])
      expect((await db.query(`update players set first_name='Forbidden edit' where id='${newPlayer}' returning id`)).rows).toHaveLength(0)
      expect((await db.query(`update group_player_memberships set status='inactive' where player_id='${newPlayer}' returning id`)).rows).toHaveLength(0)
    })
  })

  it('honors an explicit collaborator players.view denial', async () => {
    await db.exec(`insert into collaborator_permissions(membership_id,permission,enabled) values ('${ids.member}','players.view',false)`)
    try {
      expect((await asUser(ids.collaborator, `select id from players where id='${ids.player}'`)).rows).toHaveLength(0)
      expect((await asUser(ids.collaborator, `select id from group_player_memberships where id='${ids.playerMembership}'`)).rows).toHaveLength(0)
    } finally {
      await db.exec(`delete from collaborator_permissions where membership_id='${ids.member}' and permission='players.view'`)
    }
  })

  it('denies outsider and cross-organization reads and writes even with known UUIDs', async () => {
    expect((await asUser(ids.outsider, `select id from players where id in ('${ids.player}','${ids.otherPlayer}')`)).rows).toHaveLength(0)
    await expect(asUser(ids.outsider, `insert into players(organization_id,first_name) values ('${ids.org}','Forbidden')`)).rejects.toThrow('row-level security')
    expect((await asUser(ids.coach, `select id from players where id='${ids.otherPlayer}'`)).rows).toHaveLength(0)
    expect((await asUser(ids.coach, `select id from group_player_memberships where group_id='${ids.c}'`)).rows).toHaveLength(0)
    await expect(asUser(ids.admin, `insert into players(organization_id,first_name) values ('${ids.otherOrg}','Foreign')`)).rejects.toThrow('row-level security')
  })

  it('denies anonymous access and exposes no delete privilege to authenticated users', async () => {
    await db.exec('begin; set local role anon;')
    try {
      await expect(db.query('select * from players')).rejects.toThrow()
      await expect(db.query('select * from group_player_memberships')).rejects.toThrow()
    } finally { await db.exec('rollback') }
    await expect(asUser(ids.admin, `delete from players where id='${ids.player}'`)).rejects.toThrow()
    await expect(asUser(ids.admin, `delete from group_player_memberships where id='${ids.playerMembership}'`)).rejects.toThrow()
  })

  it('rejects cross-organization combinations and invalid foreign keys', async () => {
    await expect(asUser(ids.admin, `insert into group_player_memberships(organization_id,group_id,player_id,season) values ('${ids.org}','${ids.a}','${ids.otherPlayer}','2026/2027')`)).rejects.toThrow()
    await expect(asUser(ids.admin, `insert into group_player_memberships(organization_id,group_id,player_id,season) values ('${ids.org}','99999999-9999-9999-9999-999999999999','${ids.player}','2026/2027')`)).rejects.toThrow()
    await expect(asUser(ids.admin, `insert into group_player_memberships(organization_id,group_id,player_id,season) values ('${ids.org}','${ids.a}','99999999-9999-9999-9999-999999999999','2026/2027')`)).rejects.toThrow()
  })

  it.each(['active', 'inactive', 'left', 'archived'])('accepts the %s lifecycle status and preserves the membership', async status => {
    await asUserSession(ids.admin, async () => {
      await db.query(`update group_player_memberships set status='${status}' where id='${ids.playerMembership}'`)
      expect((await db.query(`select status from group_player_memberships where id='${ids.playerMembership}'`)).rows).toEqual([{ status }])
    })
  })

  it('supports inactive and left returning to active', async () => {
    await asUserSession(ids.admin, async () => {
      for (const status of ['inactive', 'left']) {
        await db.query(`update group_player_memberships set status='${status}' where id='${ids.playerMembership}'`)
        await db.query(`update group_player_memberships set status='active', left_at=null where id='${ids.playerMembership}'`)
        expect((await db.query(`select status from group_player_memberships where id='${ids.playerMembership}'`)).rows).toEqual([{ status: 'active' }])
      }
    })
  })

  it('rejects invalid lifecycle, season and date values', async () => {
    await expect(asUser(ids.admin, `update group_player_memberships set status='deleted' where id='${ids.playerMembership}'`)).rejects.toThrow()
    await expect(asUser(ids.admin, `update group_player_memberships set season='   ' where id='${ids.playerMembership}'`)).rejects.toThrow()
    await expect(asUser(ids.admin, `update group_player_memberships set season='${'x'.repeat(31)}' where id='${ids.playerMembership}'`)).rejects.toThrow()
    await expect(asUser(ids.admin, `update group_player_memberships set joined_at='2026-10-01',left_at='2026-09-01' where id='${ids.playerMembership}'`)).rejects.toThrow()
  })

  it('prevents duplicate membership for the same group, player and season', async () => {
    await expect(asUser(ids.admin, `insert into group_player_memberships(organization_id,group_id,player_id,season) values ('${ids.org}','${ids.a}','${ids.player}','2026/2027')`)).rejects.toThrow('unique')
  })

  it('keeps ownership and membership targets immutable', async () => {
    await expect(asUser(ids.admin, `update group_player_memberships set group_id='${ids.b}' where id='${ids.playerMembership}'`)).rejects.toThrow()
    await expect(asUser(ids.admin, `update players set organization_id='${ids.otherOrg}' where id='${ids.player}'`)).rejects.toThrow()
  })
})

describe('team and workgroup foundation RLS', () => {
  const teamA = '70000000-0000-0000-0000-000000000001'
  const teamB = '70000000-0000-0000-0000-000000000002'
  it('keeps legacy groups valid with a null team_id', async () => {
    expect((await db.query(`select team_id from groups where id='${ids.b}'`)).rows).toEqual([{ team_id: null }])
  })
  it('lets an organization admin create and read its team', async () => {
    await asUserSession(ids.admin, async () => {
      await db.query(`insert into teams(id,organization_id,name,season) values ('${teamA}','${ids.org}','Pulcini','2026/27')`)
      expect((await db.query(`select name from teams where id='${teamA}'`)).rows).toEqual([{ name: 'Pulcini' }])
    })
  })
  it('prevents cross-organization updates and group links', async () => {
    await db.exec(`insert into teams(id,organization_id,name) values ('${teamB}','${ids.otherOrg}','Other Team')`)
    expect((await asUser(ids.admin, `update teams set name='No' where id='${teamB}' returning id`)).rows).toHaveLength(0)
    await expect(asUser(ids.admin, `update groups set team_id='${teamB}' where id='${ids.a}'`)).rejects.toThrow()
  })
  it('allows a same-organization workgroup link and coach team read, but not outsider read', async () => {
    await db.exec(`insert into teams(id,organization_id,name) values ('${teamA}','${ids.org}','Pulcini') on conflict (id) do nothing`)
    await db.exec(`update groups set team_id='${teamA}' where id='${ids.a}'`)
    expect((await asUser(ids.coach, `select id from teams where id='${teamA}'`)).rows).toEqual([{ id: teamA }])
    expect((await asUser(ids.outsider, `select id from teams where id='${teamA}'`)).rows).toHaveLength(0)
  })
  it('denies non-admin team creation and modification', async () => {
    await expect(asUser(ids.coach, `insert into teams(organization_id,name) values ('${ids.org}','Forbidden')`)).rejects.toThrow('row-level security')
    expect((await asUser(ids.coach, `update teams set name='No' where id='${teamA}' returning id`)).rows).toHaveLength(0)
  })
})

describe('team membership and workgroup assignment foundation', () => {
  const teamA = '80000000-0000-0000-0000-000000000001', teamB = '80000000-0000-0000-0000-000000000002', membership = '81000000-0000-0000-0000-000000000001'
  beforeAll(async () => { await db.exec(`insert into teams(id,organization_id,name) values ('${teamA}','${ids.org}','A'),('${teamB}','${ids.org}','B'); update groups set team_id='${teamA}' where id='${ids.a}'; update groups set team_id='${teamB}' where id='${ids.b}'; insert into team_player_memberships(id,organization_id,team_id,player_id) values ('${membership}','${ids.org}','${teamA}','${ids.player}'); insert into group_player_assignments(organization_id,team_id,group_id,team_player_membership_id) values ('${ids.org}','${teamA}','${ids.a}','${membership}')`) })
  it('creates a valid membership and assignment, preserving historical reassignment', async () => {
    await asUserSession(ids.admin, async () => { await db.query(`update group_player_assignments set status='ended', ended_at=current_date where team_player_membership_id='${membership}'`); await db.query(`insert into group_player_assignments(organization_id,team_id,group_id,team_player_membership_id) values ('${ids.org}','${teamA}','${ids.a}','${membership}')`) })
  })
  it('rejects cross-organization membership, cross-team assignment, and duplicate active assignment', async () => {
    await expect(asUser(ids.admin, `insert into team_player_memberships(organization_id,team_id,player_id) values ('${ids.org}','${teamA}','${ids.otherPlayer}')`)).rejects.toThrow()
    await expect(asUser(ids.admin, `insert into group_player_assignments(organization_id,team_id,group_id,team_player_membership_id) values ('${ids.org}','${teamB}','${ids.b}','${membership}')`)).rejects.toThrow()
    await expect(asUser(ids.admin, `insert into group_player_assignments(organization_id,team_id,group_id,team_player_membership_id) values ('${ids.org}','${teamA}','${ids.a}','${membership}')`)).rejects.toThrow()
  })
  it('rejects duplicate active team membership while legacy roster remains available', async () => {
    await expect(asUser(ids.admin, `insert into team_player_memberships(organization_id,team_id,player_id) values ('${ids.org}','${teamA}','${ids.player}')`)).rejects.toThrow()
    expect((await asUser(ids.admin, `select id from group_player_memberships where id='${ids.playerMembership}'`)).rows).toEqual([{ id: ids.playerMembership }])
  })
  it('rejects active membership or assignment with a closing date', async () => {
    await expect(asUser(ids.admin, `insert into team_player_memberships(organization_id,team_id,player_id,status,left_at) values ('${ids.org}','${teamB}','${ids.player}','active',current_date)`)).rejects.toThrow()
    await expect(asUser(ids.admin, `insert into group_player_assignments(organization_id,team_id,group_id,team_player_membership_id,status,ended_at) values ('${ids.org}','${teamA}','${ids.a}','${membership}','active',current_date)`)).rejects.toThrow()
  })
})

describe('atomic player import RPC', () => {
  const importedPlayer = '60000000-0000-0000-0000-000000000001'
  const rollbackPlayer = '60000000-0000-0000-0000-000000000002'
  const call = (playerId: string, overrides = '') => `select * from import_group_player(
    p_player_id => '${playerId}',
    p_organization_id => '${ids.org}',
    p_group_id => '${ids.a}',
    p_first_name => 'Andrea',
    p_last_name => 'Verdi',
    p_birth_year => 2016,
    p_season => '2026/2027'
    ${overrides}
  )`

  it('is postgres-owned, hardened and authenticated-only', async () => {
    expect((await db.query(`select r.rolname as owner, p.prosecdef as security_definer, p.proconfig as config
      from pg_proc p join pg_roles r on r.oid=p.proowner
      where p.oid='public.import_group_player(uuid,uuid,uuid,text,text,integer,text,text,text,date,date,text[],text[],boolean)'::regprocedure`)).rows)
      .toEqual([{ owner: 'postgres', security_definer: true, config: ['search_path=""'] }])
    expect((await db.query(`select
      has_function_privilege('authenticated','public.import_group_player(uuid,uuid,uuid,text,text,integer,text,text,text,date,date,text[],text[],boolean)','EXECUTE') as authenticated,
      has_function_privilege('anon','public.import_group_player(uuid,uuid,uuid,text,text,integer,text,text,text,date,date,text[],text[],boolean)','EXECUTE') as anon`)).rows)
      .toEqual([{ authenticated: true, anon: false }])
  })

  it('imports player and membership atomically and preserves the supplied UUID', async () => {
    await asUserSession(ids.admin, async () => {
      const result = await db.query(call(importedPlayer))
      expect(result.rows).toEqual([{ player_id: importedPlayer, membership_id: expect.any(String), player_created: true, membership_created: true }])
      expect((await db.query(`select id from players where id='${importedPlayer}'`)).rows).toEqual([{ id: importedPlayer }])
      expect((await db.query(`select player_id,group_id,season from group_player_memberships where player_id='${importedPlayer}'`)).rows)
        .toEqual([{ player_id: importedPlayer, group_id: ids.a, season: '2026/2027' }])
    })
  })

  it('makes an identical retry idempotent without duplicate records', async () => {
    await asUserSession(ids.admin, async () => {
      const first = await db.query<{ membership_id: string }>(call(importedPlayer))
      const retry = await db.query(call(importedPlayer))
      expect(retry.rows).toEqual([{ player_id: importedPlayer, membership_id: first.rows[0].membership_id, player_created: false, membership_created: false }])
      expect((await db.query(`select count(*)::int as count from players where id='${importedPlayer}'`)).rows).toEqual([{ count: 1 }])
      expect((await db.query(`select count(*)::int as count from group_player_memberships where player_id='${importedPlayer}' and season='2026/2027'`)).rows).toEqual([{ count: 1 }])
    })
  })

  it('reuses a compatible existing player and creates only the missing membership', async () => {
    await asUserSession(ids.admin, async () => {
      await db.query(`insert into players(id,organization_id,first_name,last_name,birth_year) values ('${importedPlayer}','${ids.org}','Andrea','Verdi',2016)`)
      expect((await db.query(call(importedPlayer))).rows)
        .toEqual([{ player_id: importedPlayer, membership_id: expect.any(String), player_created: false, membership_created: true }])
    })
  })

  it('returns a conflict for an incompatible existing player UUID', async () => {
    await expect(asUser(ids.admin, `select * from import_group_player(
      p_player_id => '${ids.player}', p_organization_id => '${ids.org}', p_group_id => '${ids.a}',
      p_first_name => 'Different', p_last_name => 'Identity', p_birth_year => 2016, p_season => '2026/2027')`)).rejects.toThrow('incompatible data')
  })

  it('returns a conflict for an incompatible existing membership', async () => {
    await asUserSession(ids.admin, async () => {
      await db.query(call(importedPlayer))
      await expect(db.query(call(importedPlayer, `, p_membership_type => 'guest'`))).rejects.toThrow('membership already exists with incompatible data')
    })
  })

  it('denies cross-organization and unauthorized-group imports', async () => {
    await expect(asUser(ids.admin, `select * from import_group_player(
      p_player_id => '${importedPlayer}', p_organization_id => '${ids.otherOrg}', p_group_id => '${ids.a}',
      p_first_name => 'Andrea', p_last_name => 'Verdi', p_birth_year => 2016, p_season => '2026/2027')`)).rejects.toThrow('does not belong')
    await expect(asUser(ids.coach, `select * from import_group_player(
      p_player_id => '${importedPlayer}', p_organization_id => '${ids.org}', p_group_id => '${ids.b}',
      p_first_name => 'Andrea', p_last_name => 'Verdi', p_birth_year => 2016, p_season => '2026/2027')`)).rejects.toThrow('Permission denied')
  })

  it('rolls back a newly created player when membership creation fails', async () => {
    await db.exec(`create function pg_temp.reject_import_membership() returns trigger language plpgsql as $$ begin if new.player_id='${rollbackPlayer}' then raise exception 'Forced membership failure'; end if; return new; end $$;
      create trigger reject_import_membership before insert on group_player_memberships for each row execute function pg_temp.reject_import_membership();`)
    try {
      await expect(asUser(ids.admin, call(rollbackPlayer))).rejects.toThrow('Forced membership failure')
      expect((await db.query(`select id from players where id='${rollbackPlayer}'`)).rows).toHaveLength(0)
      expect((await db.query(`select id from group_player_memberships where player_id='${rollbackPlayer}'`)).rows).toHaveLength(0)
    } finally {
      await db.exec('drop trigger reject_import_membership on group_player_memberships')
    }
  })

  it('rejects anonymous execution', async () => {
    await db.exec('begin; set local role anon;')
    try { await expect(db.query(call(importedPlayer))).rejects.toThrow() } finally { await db.exec('rollback') }
  })
})

describe('team roster player access and atomic create RPC', () => {
  const team = '90000000-0000-0000-0000-000000000001'
  const otherTeam = '90000000-0000-0000-0000-000000000002'
  const group = '91000000-0000-0000-0000-000000000001'
  const collaboratorMembership = '91000000-0000-0000-0000-000000000002'
  const rosterPlayer = '92000000-0000-0000-0000-000000000001'
  const createdPlayer = '92000000-0000-0000-0000-000000000002'
  const rollbackPlayer = '92000000-0000-0000-0000-000000000003'
  const legacyPlayer = '92000000-0000-0000-0000-000000000004'
  const legacyMembership = '93000000-0000-0000-0000-000000000004'

  beforeAll(async () => {
    await db.exec(`
      insert into teams(id,organization_id,name) values
        ('${team}','${ids.org}','Team roster'),
        ('${otherTeam}','${ids.otherOrg}','Other team');
      insert into groups(id,organization_id,team_id,name) values ('${group}','${ids.org}','${team}','Roster group');
      insert into group_memberships(organization_id,group_id,user_id,role) values
        ('${ids.org}','${group}','${ids.coach}','coach');
      insert into group_memberships(id,organization_id,group_id,user_id,role) values
        ('${collaboratorMembership}','${ids.org}','${group}','${ids.collaborator}','collaborator');
      insert into players(id,organization_id,first_name,last_name,birth_year)
        values
          ('${rosterPlayer}','${ids.org}','Team','Player',2016),
          ('${legacyPlayer}','${ids.org}','Legacy','Player',2016);
      insert into team_player_memberships(organization_id,team_id,player_id)
        values ('${ids.org}','${team}','${rosterPlayer}');
      insert into group_player_memberships(id,organization_id,group_id,player_id,season)
        values ('${legacyMembership}','${ids.org}','${group}','${legacyPlayer}','2026/2027');
    `)
  })

  const call = (playerId: string, targetOrganization = ids.org, targetTeam = team) => `select * from create_team_roster_player(
    p_player_id => '${playerId}',
    p_organization_id => '${targetOrganization}',
    p_team_id => '${targetTeam}',
    p_first_name => ' Anna ',
    p_last_name => ' Verdi ',
    p_birth_year => 2017
  )`

  it('keeps the helper and RPC postgres-owned, hardened and minimally granted', async () => {
    expect((await db.query(`select r.rolname as owner, p.prosecdef as security_definer, p.proconfig as config
      from pg_proc p join pg_roles r on r.oid=p.proowner
      where p.oid='private.can_read_player(uuid)'::regprocedure`)).rows)
      .toEqual([{ owner: 'postgres', security_definer: true, config: ['search_path=""'] }])
    expect((await db.query(`select r.rolname as owner, p.prosecdef as security_definer, p.proconfig as config
      from pg_proc p join pg_roles r on r.oid=p.proowner
      where p.oid='public.create_team_roster_player(uuid,uuid,uuid,text,text,integer)'::regprocedure`)).rows)
      .toEqual([{ owner: 'postgres', security_definer: true, config: ['search_path=""'] }])
    expect((await db.query(`select
      has_function_privilege('authenticated','public.create_team_roster_player(uuid,uuid,uuid,text,text,integer)','EXECUTE') as authenticated,
      has_function_privilege('anon','public.create_team_roster_player(uuid,uuid,uuid,text,text,integer)','EXECUTE') as anon`)).rows)
      .toEqual([{ authenticated: true, anon: false }])
  })

  it('does not expose a team roster player without an active authorized WorkGroup assignment', async () => {
    expect((await asUser(ids.coach, `select id from players where id='${rosterPlayer}'`)).rows).toHaveLength(0)
    expect((await asUser(ids.collaborator, `select id from players where id='${rosterPlayer}'`)).rows).toHaveLength(0)
    expect((await asUser(ids.outsider, `select id from players where id='${rosterPlayer}'`)).rows).toHaveLength(0)
    expect((await asUser(ids.coach, `select id from players where id='${ids.otherPlayer}'`)).rows).toHaveLength(0)
  })

  it('keeps a team membership alone insufficient even while active', async () => {
    expect((await asUser(ids.coach, `select id from players where id='${rosterPlayer}'`)).rows).toHaveLength(0)
    await db.exec(`update team_player_memberships set status='inactive' where player_id='${rosterPlayer}'`)
    try {
      expect((await asUser(ids.coach, `select id from players where id='${rosterPlayer}'`)).rows).toHaveLength(0)
    } finally {
      await db.exec(`update team_player_memberships set status='active', left_at=null where player_id='${rosterPlayer}'`)
    }
  })

  it('preserves active legacy access but removes authorization from inactive legacy memberships', async () => {
    expect((await asUser(ids.coach, `select id from players where id='${legacyPlayer}'`)).rows).toEqual([{ id: legacyPlayer }])
    await db.exec(`update group_player_memberships set status='inactive' where id='${legacyMembership}'`)
    try {
      expect((await asUser(ids.coach, `select id from players where id='${legacyPlayer}'`)).rows).toHaveLength(0)
    } finally {
      await db.exec(`update group_player_memberships set status='active', left_at=null where id='${legacyMembership}'`)
    }
  })

  it('continues to honor an explicit collaborator players.view denial', async () => {
    await db.exec(`insert into collaborator_permissions(membership_id,permission,enabled) values ('${collaboratorMembership}','players.view',false)`)
    try {
      expect((await asUser(ids.collaborator, `select id from players where id='${rosterPlayer}'`)).rows).toHaveLength(0)
    } finally {
      await db.exec(`delete from collaborator_permissions where membership_id='${collaboratorMembership}' and permission='players.view'`)
    }
  })

  it('atomically creates one organization player and one active team membership without an assignment', async () => {
    await asUserSession(ids.admin, async () => {
      expect((await db.query(call(createdPlayer))).rows).toEqual([{ player_id: createdPlayer, membership_id: expect.any(String) }])
      expect((await db.query(`select organization_id,first_name,last_name,birth_year from players where id='${createdPlayer}'`)).rows)
        .toEqual([{ organization_id: ids.org, first_name: 'Anna', last_name: 'Verdi', birth_year: 2017 }])
      expect((await db.query(`select organization_id,team_id,player_id,status from team_player_memberships where player_id='${createdPlayer}'`)).rows)
        .toEqual([{ organization_id: ids.org, team_id: team, player_id: createdPlayer, status: 'active' }])
      expect((await db.query(`select id from group_player_assignments where team_player_membership_id in (select id from team_player_memberships where player_id='${createdPlayer}')`)).rows).toHaveLength(0)
    })
  })

  it('denies coach, outsider, anonymous and cross-organization creation', async () => {
    await expect(asUser(ids.coach, call(createdPlayer))).rejects.toThrow('Permission denied')
    await expect(asUser(ids.outsider, call(createdPlayer))).rejects.toThrow('Permission denied')
    await expect(asUser(ids.admin, call(createdPlayer, ids.org, otherTeam))).rejects.toThrow('does not belong')
    await expect(asUser(ids.admin, call(createdPlayer, ids.otherOrg, otherTeam))).rejects.toThrow('Permission denied')
    await db.exec('begin; set local role anon;')
    try { await expect(db.query(call(createdPlayer))).rejects.toThrow() } finally { await db.exec('rollback') }
  })

  it('rolls back the player when team membership creation fails', async () => {
    await db.exec(`create function pg_temp.reject_team_roster_membership() returns trigger language plpgsql as $$ begin if new.player_id='${rollbackPlayer}' then raise exception 'Forced team membership failure'; end if; return new; end $$;
      create trigger reject_team_roster_membership before insert on team_player_memberships for each row execute function pg_temp.reject_team_roster_membership();`)
    try {
      await expect(asUser(ids.admin, call(rollbackPlayer))).rejects.toThrow('Forced team membership failure')
      expect((await db.query(`select id from players where id='${rollbackPlayer}'`)).rows).toHaveLength(0)
      expect((await db.query(`select id from team_player_memberships where player_id='${rollbackPlayer}'`)).rows).toHaveLength(0)
    } finally {
      await db.exec('drop trigger reject_team_roster_membership on team_player_memberships')
    }
  })

  it('rejects invalid identity data without leaving partial rows', async () => {
    await expect(asUser(ids.admin, `select * from create_team_roster_player(
      p_player_id => '${createdPlayer}', p_organization_id => '${ids.org}', p_team_id => '${team}',
      p_first_name => ' ', p_last_name => 'Verdi', p_birth_year => 2017)`)).rejects.toThrow('first name')
    expect((await db.query(`select id from players where id='${createdPlayer}'`)).rows).toHaveLength(0)
  })
})

describe('atomic WorkGroup player assignment RPC', () => {
  const team = 'a0000000-0000-0000-0000-000000000001'
  const otherTeam = 'a0000000-0000-0000-0000-000000000002'
  const groupA = 'a1000000-0000-0000-0000-000000000001'
  const groupB = 'a1000000-0000-0000-0000-000000000002'
  const otherTeamGroup = 'a1000000-0000-0000-0000-000000000003'
  const otherOrganizationGroup = 'a1000000-0000-0000-0000-000000000004'
  const player = 'a2000000-0000-0000-0000-000000000001'
  const membership = 'a3000000-0000-0000-0000-000000000001'

  beforeAll(async () => {
    await db.exec(`
      insert into teams(id,organization_id,name) values
        ('${team}','${ids.org}','Assignment team'),
        ('${otherTeam}','${ids.org}','Other assignment team');
      insert into groups(id,organization_id,team_id,name) values
        ('${groupA}','${ids.org}','${team}','Rosso'),
        ('${groupB}','${ids.org}','${team}','Blu'),
        ('${otherTeamGroup}','${ids.org}','${otherTeam}','Other team group'),
        ('${otherOrganizationGroup}','${ids.otherOrg}',null,'Other organization group');
      insert into players(id,organization_id,first_name,last_name)
        values ('${player}','${ids.org}','Assigned','Player');
      insert into team_player_memberships(id,organization_id,team_id,player_id)
        values ('${membership}','${ids.org}','${team}','${player}');
    `)
  })

  const call = (groupId: string | null) => `select * from set_team_roster_player_group(
    p_team_player_membership_id => '${membership}',
    p_group_id => ${groupId ? `'${groupId}'` : 'null'}
  )`

  it('is postgres-owned, hardened and authenticated-only', async () => {
    expect((await db.query(`select r.rolname as owner, p.prosecdef as security_definer, p.proconfig as config
      from pg_proc p join pg_roles r on r.oid=p.proowner
      where p.oid='public.set_team_roster_player_group(uuid,uuid)'::regprocedure`)).rows)
      .toEqual([{ owner: 'postgres', security_definer: true, config: ['search_path=""'] }])
    expect((await db.query(`select
      has_function_privilege('authenticated','public.set_team_roster_player_group(uuid,uuid)','EXECUTE') as authenticated,
      has_function_privilege('anon','public.set_team_roster_player_group(uuid,uuid)','EXECUTE') as anon`)).rows)
      .toEqual([{ authenticated: true, anon: false }])
  })

  it('assigns, changes and removes atomically while preserving history and roster identity', async () => {
    await asUserSession(ids.admin, async () => {
      expect((await db.query(call(groupA))).rows).toEqual([{
        assignment_id: expect.any(String), previous_assignment_id: null, operation: 'assigned',
      }])
      const firstAssignment = (await db.query<{ id: string }>(`select id from group_player_assignments where team_player_membership_id='${membership}' and status='active'`)).rows[0].id

      expect((await db.query(call(groupA))).rows).toEqual([{
        assignment_id: firstAssignment, previous_assignment_id: null, operation: 'unchanged',
      }])
      expect((await db.query(call(groupB))).rows).toEqual([{
        assignment_id: expect.any(String), previous_assignment_id: firstAssignment, operation: 'changed',
      }])
      expect((await db.query(`select group_id,status,ended_at is not null as ended from group_player_assignments where team_player_membership_id='${membership}' order by group_id`)).rows)
        .toEqual([
          { group_id: groupA, status: 'ended', ended: true },
          { group_id: groupB, status: 'active', ended: false },
        ])

      expect((await db.query(call(null))).rows).toEqual([{
        assignment_id: null, previous_assignment_id: expect.any(String), operation: 'removed',
      }])
      expect((await db.query(`select count(*)::int as count from group_player_assignments where team_player_membership_id='${membership}' and status='active'`)).rows).toEqual([{ count: 0 }])
      expect((await db.query(`select count(*)::int as count from players where id='${player}'`)).rows).toEqual([{ count: 1 }])
      expect((await db.query(`select count(*)::int as count from team_player_memberships where id='${membership}'`)).rows).toEqual([{ count: 1 }])
    })
  })

  it('rejects another team, another organization, inactive groups and non-admin users', async () => {
    await expect(asUser(ids.admin, call(otherTeamGroup))).rejects.toThrow('does not belong')
    await expect(asUser(ids.admin, call(otherOrganizationGroup))).rejects.toThrow('does not belong')
    await db.exec(`update groups set active=false where id='${groupA}'`)
    try { await expect(asUser(ids.admin, call(groupA))).rejects.toThrow('inactive') }
    finally { await db.exec(`update groups set active=true where id='${groupA}'`) }
    await expect(asUser(ids.coach, call(groupA))).rejects.toThrow('Permission denied')
    await expect(asUser(ids.outsider, call(groupA))).rejects.toThrow('Permission denied')
    await db.exec('begin; set local role anon;')
    try { await expect(db.query(call(groupA))).rejects.toThrow() } finally { await db.exec('rollback') }
  })

  it('serializes repeated assignment requests and never creates two active rows', async () => {
    await asUserSession(ids.admin, async () => {
      const [first, second] = await Promise.all([db.query(call(groupA)), db.query(call(groupA))])
      expect([first.rows[0].operation, second.rows[0].operation].sort()).toEqual(['assigned', 'unchanged'])
      expect((await db.query(`select count(*)::int as count from group_player_assignments where team_player_membership_id='${membership}' and status='active'`)).rows).toEqual([{ count: 1 }])
    })
  })
})

describe('safe player lifecycle RPCs', () => {
  const teamA = 'b0000000-0000-0000-0000-000000000001'
  const teamB = 'b0000000-0000-0000-0000-000000000002'
  const groupA = 'b1000000-0000-0000-0000-000000000001'
  const groupB = 'b1000000-0000-0000-0000-000000000002'
  const removablePlayer = 'b2000000-0000-0000-0000-000000000001'
  const removableMembership = 'b3000000-0000-0000-0000-000000000001'
  const removableAssignment = 'b4000000-0000-0000-0000-000000000001'
  const multiPlayer = 'b2000000-0000-0000-0000-000000000002'
  const multiMembershipA = 'b3000000-0000-0000-0000-000000000002'
  const multiMembershipB = 'b3000000-0000-0000-0000-000000000003'
  const deletablePlayer = 'b2000000-0000-0000-0000-000000000003'
  const deletableMembership = 'b3000000-0000-0000-0000-000000000004'
  const deletableAssignment = 'b4000000-0000-0000-0000-000000000002'
  const protectedPlayer = 'b2000000-0000-0000-0000-000000000004'
  const protectedLegacyMembership = 'b5000000-0000-0000-0000-000000000001'
  const rollbackPlayer = 'b2000000-0000-0000-0000-000000000005'
  const rollbackMembership = 'b3000000-0000-0000-0000-000000000005'
  const rollbackAssignment = 'b4000000-0000-0000-0000-000000000003'

  beforeAll(async () => {
    await db.exec(`
      insert into teams(id,organization_id,name) values
        ('${teamA}','${ids.org}','Lifecycle A'),
        ('${teamB}','${ids.org}','Lifecycle B');
      insert into groups(id,organization_id,team_id,name) values
        ('${groupA}','${ids.org}','${teamA}','Lifecycle group A'),
        ('${groupB}','${ids.org}','${teamB}','Lifecycle group B');
      insert into players(id,organization_id,first_name,last_name,archived_at) values
        ('${removablePlayer}','${ids.org}','Remove','Player',null),
        ('${multiPlayer}','${ids.org}','Multi','Player',null),
        ('${deletablePlayer}','${ids.org}','Delete','Player',null),
        ('${protectedPlayer}','${ids.org}','Protected','Player',now()),
        ('${rollbackPlayer}','${ids.org}','Rollback','Player',now());
      insert into team_player_memberships(id,organization_id,team_id,player_id,status,left_at) values
        ('${removableMembership}','${ids.org}','${teamA}','${removablePlayer}','active',null),
        ('${multiMembershipA}','${ids.org}','${teamA}','${multiPlayer}','active',null),
        ('${multiMembershipB}','${ids.org}','${teamB}','${multiPlayer}','active',null),
        ('${deletableMembership}','${ids.org}','${teamA}','${deletablePlayer}','active',null),
        ('${rollbackMembership}','${ids.org}','${teamA}','${rollbackPlayer}','left',current_date);
      insert into group_player_assignments(id,organization_id,team_id,group_id,team_player_membership_id,status,ended_at) values
        ('${removableAssignment}','${ids.org}','${teamA}','${groupA}','${removableMembership}','active',null),
        ('${deletableAssignment}','${ids.org}','${teamA}','${groupA}','${deletableMembership}','active',null),
        ('${rollbackAssignment}','${ids.org}','${teamA}','${groupA}','${rollbackMembership}','ended',current_date);
      insert into group_player_memberships(id,organization_id,group_id,player_id,season,status)
        values ('${protectedLegacyMembership}','${ids.org}','${groupA}','${protectedPlayer}','2026/2027','inactive');
    `)
  })

  const remove = (membershipId: string) => `select * from remove_team_roster_player('${membershipId}')`
  const archive = (playerId: string, organizationId = ids.org) => `select * from archive_organization_player('${playerId}','${organizationId}')`
  const permanentlyDelete = (playerId: string, organizationId = ids.org) => `select * from delete_organization_player('${playerId}','${organizationId}')`
  const expectErrorWithoutAborting = async (sql: string, message: string) => {
    await db.exec('savepoint expected_lifecycle_error')
    try { await expect(db.query(sql)).rejects.toThrow(message) }
    finally { await db.exec('rollback to savepoint expected_lifecycle_error') }
  }

  it('removes a player from one category, ends active assignments and is repeat-safe', async () => {
    await asUserSession(ids.admin, async () => {
      expect((await db.query(remove(removableMembership))).rows).toEqual([{
        membership_id: removableMembership, ended_assignment_count: 1, operation: 'removed',
      }])
      expect((await db.query(`select status,left_at is not null as left from team_player_memberships where id='${removableMembership}'`)).rows)
        .toEqual([{ status: 'left', left: true }])
      expect((await db.query(`select status,ended_at is not null as ended from group_player_assignments where id='${removableAssignment}'`)).rows)
        .toEqual([{ status: 'ended', ended: true }])
      expect((await db.query(remove(removableMembership))).rows).toEqual([{
        membership_id: removableMembership, ended_assignment_count: 0, operation: 'unchanged',
      }])
    })
  })

  it('does not globally archive a player who still belongs to another category', async () => {
    await asUserSession(ids.admin, async () => {
      await db.query(remove(multiMembershipA))
      await expectErrorWithoutAborting(archive(multiPlayer), 'active team roster')
      expect((await db.query(`select archived_at from players where id='${multiPlayer}'`)).rows).toEqual([{ archived_at: null }])
      expect((await db.query(`select status from team_player_memberships where id='${multiMembershipB}'`)).rows).toEqual([{ status: 'active' }])
      await db.query(remove(multiMembershipB))
      expect((await db.query(archive(multiPlayer))).rows).toEqual([{ player_id: multiPlayer, operation: 'archived' }])
      expect((await db.query(archive(multiPlayer))).rows).toEqual([{ player_id: multiPlayer, operation: 'unchanged' }])
    })
  })

  it('permanently deletes only an archived player with controlled team links', async () => {
    await asUserSession(ids.admin, async () => {
      await expectErrorWithoutAborting(permanentlyDelete(deletablePlayer), 'must be archived')
      await db.query(remove(deletableMembership))
      await db.query(archive(deletablePlayer))
      expect((await db.query(permanentlyDelete(deletablePlayer))).rows).toEqual([{
        player_id: deletablePlayer,
        deleted_membership_count: 1,
        deleted_assignment_count: 1,
        operation: 'deleted',
      }])
      expect((await db.query(`select id from players where id='${deletablePlayer}'`)).rows).toHaveLength(0)
      expect((await db.query(`select id from team_player_memberships where id='${deletableMembership}'`)).rows).toHaveLength(0)
      expect((await db.query(`select id from group_player_assignments where id='${deletableAssignment}'`)).rows).toHaveLength(0)
    })
  })

  it('blocks deletion when legacy history must be preserved', async () => {
    await asUserSession(ids.admin, async () => {
      await expectErrorWithoutAborting(permanentlyDelete(protectedPlayer), 'legacy group history')
      expect((await db.query(`select status from group_player_memberships where id='${protectedLegacyMembership}'`)).rows)
        .toEqual([{ status: 'inactive' }])
      expect((await db.query(`select id from players where id='${protectedPlayer}'`)).rows).toEqual([{ id: protectedPlayer }])
    })
  })

  it.each([
    ['coach', ids.coach],
    ['collaborator', ids.collaborator],
    ['outsider', ids.outsider],
  ])('denies lifecycle operations to %s', async (_role, userId) => {
    await expect(asUser(userId, remove(removableMembership))).rejects.toThrow('Permission denied')
    await expect(asUser(userId, archive(removablePlayer))).rejects.toThrow('Permission denied')
    await expect(asUser(userId, permanentlyDelete(protectedPlayer))).rejects.toThrow('Permission denied')
  })

  it('enforces organization isolation without changing the player', async () => {
    await expect(asUser(ids.admin, archive(removablePlayer, ids.otherOrg))).rejects.toThrow('not found in organization')
    expect((await db.query(`select archived_at from players where id='${removablePlayer}'`)).rows).toEqual([{ archived_at: null }])
  })

  it('rolls back assignment cleanup when a later membership delete fails', async () => {
    await db.exec(`create function pg_temp.reject_lifecycle_membership_delete() returns trigger language plpgsql as $$ begin if old.id='${rollbackMembership}' then raise exception 'Forced lifecycle failure'; end if; return old; end $$;
      create trigger reject_lifecycle_membership_delete before delete on team_player_memberships for each row execute function pg_temp.reject_lifecycle_membership_delete();`)
    try {
      await expect(asUser(ids.admin, permanentlyDelete(rollbackPlayer))).rejects.toThrow('Forced lifecycle failure')
      expect((await db.query(`select id from group_player_assignments where id='${rollbackAssignment}'`)).rows).toEqual([{ id: rollbackAssignment }])
      expect((await db.query(`select id from team_player_memberships where id='${rollbackMembership}'`)).rows).toEqual([{ id: rollbackMembership }])
      expect((await db.query(`select id from players where id='${rollbackPlayer}'`)).rows).toEqual([{ id: rollbackPlayer }])
    } finally {
      await db.exec('drop trigger reject_lifecycle_membership_delete on team_player_memberships')
    }
  })

  it('keeps the pre-existing legacy player and membership intact', async () => {
    expect((await db.query(`select p.first_name,p.last_name,m.id as membership_id,m.status
      from players p join group_player_memberships m on m.player_id=p.id
      where p.id='${ids.player}' and m.id='${ids.playerMembership}'`)).rows)
      .toEqual([{ first_name: 'Mario', last_name: 'Rossi', membership_id: ids.playerMembership, status: 'active' }])
  })
})
