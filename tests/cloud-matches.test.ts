import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'

const id = {
  admin: 'a0000000-0000-0000-0000-000000000001', coach: 'a0000000-0000-0000-0000-000000000002', collaborator: 'a0000000-0000-0000-0000-000000000003', outsider: 'a0000000-0000-0000-0000-000000000004',
  org: 'b0000000-0000-0000-0000-000000000001', otherOrg: 'b0000000-0000-0000-0000-000000000002', team: 'c0000000-0000-0000-0000-000000000001', group: 'd0000000-0000-0000-0000-000000000001', otherGroup: 'd0000000-0000-0000-0000-000000000002',
  stable: 'e0000000-0000-0000-0000-000000000001', guest: 'e0000000-0000-0000-0000-000000000002', outsiderPlayer: 'e0000000-0000-0000-0000-000000000003', unassigned: 'e0000000-0000-0000-0000-000000000004',
  match: 'f0000000-0000-0000-0000-000000000001', historic: 'f0000000-0000-0000-0000-000000000002', otherMatch: 'f0000000-0000-0000-0000-000000000003', created: 'f0000000-0000-0000-0000-000000000004',
}
let db: PGlite
const migrations = ['202609230001_v5a_foundation.sql', '202609250001_v5a_group_admin_rls_hotfix.sql', '202610060001_v6_2a_organization_bootstrap.sql', '202610070001_player_cloud_foundation.sql', '202610070002_atomic_player_import.sql', '202610070003_team_workgroup_foundation.sql', '202610070004_organization_seasons_foundation.sql', '202610070005_team_membership_group_assignment_foundation.sql', '202610080006_fix_organization_season_returning_rls.sql', '202610080007_fix_team_returning_rls.sql', '202610080008_team_roster_player_access_and_create.sql', '202610080009_atomic_workgroup_player_assignment.sql', '202610080010_safe_player_lifecycle.sql', '202610080011_workgroup_roster_cloud_access.sql', '202610080012_batch_workgroup_roster_assignment.sql', '202610080013_cloud_training_library.sql', '202610080014_cloud_training_attendance.sql', '202610090015_cloud_matches.sql', '202610100016_match_callup_candidates.sql']
async function asUser(user: string, sql: string) { await db.exec("begin; set local role authenticated; select set_config('request.jwt.claim.sub','" + user + "',true)"); try { return await db.query(sql) } finally { await db.exec('rollback') } }
async function session<T>(user: string, run: () => Promise<T>) { await db.exec("begin; set local role authenticated; select set_config('request.jwt.claim.sub','" + user + "',true)"); try { return await run() } finally { await db.exec('rollback') } }
const matchRow = (matchId = id.match, groupId = id.group, orgId = id.org, createdBy = id.admin) => `insert into matches(id,organization_id,group_id,match_date,opponent,home_away,created_by) values ('${matchId}','${orgId}','${groupId}','2026-11-01','Rivali','home','${createdBy}')`

beforeAll(async () => {
  db = new PGlite()
  await db.exec("create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key,email text); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;")
  for (const file of migrations) await db.exec(readFileSync('supabase/migrations/' + file, 'utf8'))
  await db.exec(`insert into auth.users values ('${id.admin}','admin@test'),('${id.coach}','coach@test'),('${id.collaborator}','collab@test'),('${id.outsider}','out@test');
    insert into organizations(id,name,slug) values ('${id.org}','Club','club'),('${id.otherOrg}','Other','other');
    insert into organization_memberships(organization_id,user_id) values ('${id.org}','${id.admin}');
    insert into teams(id,organization_id,name) values ('${id.team}','${id.org}','U10');
    insert into groups(id,organization_id,team_id,name) values ('${id.group}','${id.org}','${id.team}','A'),('${id.otherGroup}','${id.org}','${id.team}','B');
    insert into group_memberships(organization_id,group_id,user_id,role) values ('${id.org}','${id.group}','${id.coach}','coach'),('${id.org}','${id.otherGroup}','${id.coach}','coach'),('${id.org}','${id.group}','${id.collaborator}','collaborator');
    insert into players(id,organization_id,first_name,last_name) values ('${id.stable}','${id.org}','Stable','One'),('${id.guest}','${id.org}','Guest','Other'),('${id.unassigned}','${id.org}','No','Group'),('${id.outsiderPlayer}','${id.otherOrg}','Other','Org');
    insert into team_player_memberships(organization_id,team_id,player_id) select '${id.org}','${id.team}',id from players where id in ('${id.stable}','${id.guest}');
    insert into group_player_assignments(organization_id,team_id,group_id,team_player_membership_id) select '${id.org}','${id.team}','${id.group}',id from team_player_memberships where player_id='${id.stable}';
    insert into group_player_assignments(organization_id,team_id,group_id,team_player_membership_id) select '${id.org}','${id.team}','${id.otherGroup}',id from team_player_memberships where player_id='${id.guest}';
    ${matchRow()}; ${matchRow(id.historic)}; ${matchRow(id.otherMatch, id.otherGroup)};`)
})
afterAll(async () => { await db.close() })

describe('cloud matches and call-ups', () => {
  it('creates, updates and cancels matches with valid score/status combinations', async () => {
    await session(id.coach, async () => {
      expect((await db.query(`${matchRow(id.created, id.group, id.org, id.coach)} returning id,status`)).rows).toEqual([{ id: id.created, status: 'scheduled' }])
      await db.query(`update matches set status='live',our_score=1,opponent_score=0 where id='${id.match}'`)
      expect((await db.query(`update matches set status='completed' where id='${id.match}' returning status,our_score,opponent_score`)).rows).toEqual([{ status: 'completed', our_score: 1, opponent_score: 0 }])
      expect((await db.query(`update matches set status='cancelled',our_score=null,opponent_score=null where id='${id.match}' returning status`)).rows).toEqual([{ status: 'cancelled' }])
    })
  })

  it('rejects incomplete, negative and cancelled scores', async () => {
    await expect(asUser(id.coach, `update matches set status='completed' where id='${id.historic}'`)).rejects.toThrow()
    await expect(asUser(id.coach, `update matches set our_score=1 where id='${id.historic}'`)).rejects.toThrow()
    await expect(asUser(id.coach, `update matches set status='cancelled',our_score=0,opponent_score=0 where id='${id.historic}'`)).rejects.toThrow()
    await expect(asUser(id.coach, `update matches set our_score=-1,opponent_score=0 where id='${id.historic}'`)).rejects.toThrow()
  })

  it('records stable and temporary same-organization call-ups without duplicates or roster changes', async () => {
    await session(id.coach, async () => {
      expect((await db.query(`insert into match_callups(match_id,organization_id,player_id) values ('${id.match}','${id.org}','${id.stable}') returning source,status`)).rows).toEqual([{ source: 'roster', status: 'called' }])
      expect((await db.query(`insert into match_callups(match_id,organization_id,player_id,status) values ('${id.match}','${id.org}','${id.guest}','confirmed') returning source,status`)).rows).toEqual([{ source: 'guest', status: 'confirmed' }])
      await db.exec('savepoint duplicate_callup')
      try { await expect(db.query(`insert into match_callups(match_id,organization_id,player_id) values ('${id.match}','${id.org}','${id.guest}')`)).rejects.toThrow() }
      finally { await db.exec('rollback to savepoint duplicate_callup') }
      expect((await db.query(`select group_id from group_player_assignments a join team_player_memberships m on m.id=a.team_player_membership_id where m.player_id='${id.guest}' and a.status='active'`)).rows).toEqual([{ group_id: id.otherGroup }])
    })
  })

  it('lists only authorized, active cross-WorkGroup candidates and snapshots their origin', async () => {
    await session(id.coach, async () => {
      expect((await db.query(`select player_id,source_group_id,source_group_name from list_match_callup_candidates('${id.match}')`)).rows).toEqual([{ player_id: id.guest, source_group_id: id.otherGroup, source_group_name: 'B' }])
      expect((await db.query(`insert into match_callups(match_id,organization_id,player_id) values ('${id.match}','${id.org}','${id.guest}') returning source,source_group_id`)).rows).toEqual([{ source: 'guest', source_group_id: id.otherGroup }])
    })
    await expect(asUser(id.outsider, `select * from list_match_callup_candidates('${id.match}')`)).rejects.toThrow('Permission denied')
  })

  it('blocks cross-organization and non-WorkGroup players in the database', async () => {
    await expect(asUser(id.coach, `insert into match_callups(match_id,organization_id,player_id) values ('${id.match}','${id.org}','${id.outsiderPlayer}')`)).rejects.toThrow('same organization')
    await expect(asUser(id.coach, `insert into match_callups(match_id,organization_id,player_id) values ('${id.match}','${id.org}','${id.unassigned}')`)).rejects.toThrow('active WorkGroup player')
  })

  it('keeps the call-up history editable after a WorkGroup transfer', async () => {
    await db.exec(`insert into match_callups(match_id,organization_id,player_id,created_by) values ('${id.historic}','${id.org}','${id.stable}','${id.admin}');
      update group_player_assignments set status='ended',ended_at=current_date where group_id='${id.group}' and team_player_membership_id=(select id from team_player_memberships where player_id='${id.stable}');
      insert into group_player_assignments(organization_id,team_id,group_id,team_player_membership_id) select '${id.org}','${id.team}','${id.otherGroup}',id from team_player_memberships where player_id='${id.stable}';`)
    await session(id.coach, async () => {
      expect((await db.query(`update match_callups set status='unavailable',note='Indisponibile' where match_id='${id.historic}' and player_id='${id.stable}' returning status,note,source`)).rows).toEqual([{ status: 'unavailable', note: 'Indisponibile', source: 'roster' }])
    })
  })

  it('enforces match permissions and WorkGroup isolation for collaborators', async () => {
    expect((await asUser(id.admin, `select id from matches where id='${id.match}'`)).rows).toEqual([{ id: id.match }])
    await expect(asUser(id.collaborator, `select * from matches where id='${id.match}'`)).resolves.toBeDefined()
    expect((await asUser(id.collaborator, `update matches set opponent='Nope' where id='${id.match}'`)).rowCount).toBe(0)
    await db.exec(`insert into collaborator_permissions(membership_id,permission,enabled) values ((select id from group_memberships where user_id='${id.collaborator}' and group_id='${id.group}'),'matches.edit',true),((select id from group_memberships where user_id='${id.collaborator}' and group_id='${id.group}'),'matches.create',true) on conflict (membership_id,permission) do update set enabled=true`)
    await expect(asUser(id.collaborator, `update matches set opponent='Aggiornato' where id='${id.match}'`)).resolves.toBeDefined()
    expect((await asUser(id.collaborator, `update matches set opponent='Altro gruppo' where id='${id.otherMatch}'`)).rowCount).toBe(0)
  })

  it('prevents spoofed authors and moving a match across WorkGroups', async () => {
    await expect(asUser(id.coach, matchRow(id.created, id.group, id.org, id.admin))).rejects.toThrow('creator')
    await expect(asUser(id.coach, `update matches set group_id='${id.otherGroup}' where id='${id.match}'`)).rejects.toThrow('cannot be moved')
  })

  it('rolls back a multi-call-up transaction when a later row is invalid', async () => {
    await session(id.coach, async () => {
      await db.query(`insert into match_callups(match_id,organization_id,player_id) values ('${id.otherMatch}','${id.org}','${id.guest}')`)
      await expect(db.query(`insert into match_callups(match_id,organization_id,player_id) values ('${id.otherMatch}','${id.org}','${id.outsiderPlayer}')`)).rejects.toThrow()
    })
    expect((await db.query(`select count(*)::int as count from match_callups where match_id='${id.otherMatch}'`)).rows).toEqual([{ count: 0 }])
  })
})
