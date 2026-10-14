import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'

const id = {
  admin: 'a0000000-0000-0000-0000-000000000001', coach: 'a0000000-0000-0000-0000-000000000002', collaborator: 'a0000000-0000-0000-0000-000000000003', outsider: 'a0000000-0000-0000-0000-000000000004',
  org: 'b0000000-0000-0000-0000-000000000001', otherOrg: 'b0000000-0000-0000-0000-000000000002', team: 'c0000000-0000-0000-0000-000000000001', group: 'd0000000-0000-0000-0000-000000000001', otherGroup: 'd0000000-0000-0000-0000-000000000002',
  stable: 'e0000000-0000-0000-0000-000000000001', stableTwo: 'e0000000-0000-0000-0000-000000000002', guest: 'e0000000-0000-0000-0000-000000000003', unassigned: 'e0000000-0000-0000-0000-000000000004', outsiderPlayer: 'e0000000-0000-0000-0000-000000000005',
  session: 'f0000000-0000-0000-0000-000000000001', allPresent: 'f0000000-0000-0000-0000-000000000002', sessionB: 'f0000000-0000-0000-0000-000000000003', rollback: 'f0000000-0000-0000-0000-000000000004',
}
let db: PGlite
const migrations = ['202609230001_v5a_foundation.sql', '202609250001_v5a_group_admin_rls_hotfix.sql', '202610060001_v6_2a_organization_bootstrap.sql', '202610070001_player_cloud_foundation.sql', '202610070002_atomic_player_import.sql', '202610070003_team_workgroup_foundation.sql', '202610070004_organization_seasons_foundation.sql', '202610070005_team_membership_group_assignment_foundation.sql', '202610080006_fix_organization_season_returning_rls.sql', '202610080007_fix_team_returning_rls.sql', '202610080008_team_roster_player_access_and_create.sql', '202610080009_atomic_workgroup_player_assignment.sql', '202610080010_safe_player_lifecycle.sql', '202610080011_workgroup_roster_cloud_access.sql', '202610080012_batch_workgroup_roster_assignment.sql', '202610080013_cloud_training_library.sql', '202610080014_cloud_training_attendance.sql']
async function asUser(user: string, sql: string) { await db.exec("begin; set local role authenticated; select set_config('request.jwt.claim.sub','" + user + "',true)"); try { return await db.query(sql) } finally { await db.exec('rollback') } }
async function session<T>(user: string, run: () => Promise<T>) { await db.exec("begin; set local role authenticated; select set_config('request.jwt.claim.sub','" + user + "',true)"); try { return await run() } finally { await db.exec('rollback') } }

beforeAll(async () => {
  db = new PGlite()
  await db.exec("create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key,email text); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;")
  for (const file of migrations) await db.exec(readFileSync('supabase/migrations/' + file, 'utf8'))
  await db.exec("insert into auth.users values ('" + id.admin + "','admin@test'),('" + id.coach + "','coach@test'),('" + id.collaborator + "','collab@test'),('" + id.outsider + "','out@test');" +
    "insert into organizations(id,name,slug) values ('" + id.org + "','Club','club'),('" + id.otherOrg + "','Other','other');" +
    "insert into organization_memberships(organization_id,user_id) values ('" + id.org + "','" + id.admin + "');" +
    "insert into teams(id,organization_id,name) values ('" + id.team + "','" + id.org + "','U10');" +
    "insert into groups(id,organization_id,team_id,name) values ('" + id.group + "','" + id.org + "','" + id.team + "','A'),('" + id.otherGroup + "','" + id.org + "','" + id.team + "','B');" +
    "insert into group_memberships(organization_id,group_id,user_id,role) values ('" + id.org + "','" + id.group + "','" + id.coach + "','coach'),('" + id.org + "','" + id.otherGroup + "','" + id.coach + "','coach'),('" + id.org + "','" + id.group + "','" + id.collaborator + "','collaborator');" +
    "insert into collaborator_permissions(membership_id,permission,enabled) select id,'training.view',true from group_memberships where user_id='" + id.collaborator + "';" +
    "insert into players(id,organization_id,first_name,last_name) values ('" + id.stable + "','" + id.org + "','Stable','One'),('" + id.stableTwo + "','" + id.org + "','Stable','Two'),('" + id.guest + "','" + id.org + "','Guest','Other'),('" + id.unassigned + "','" + id.org + "','No','Group'),('" + id.outsiderPlayer + "','" + id.otherOrg + "','Other','Org');" +
    "insert into team_player_memberships(organization_id,team_id,player_id) select '" + id.org + "','" + id.team + "',id from players where id in ('" + id.stable + "','" + id.stableTwo + "','" + id.guest + "');" +
    "insert into group_player_assignments(organization_id,team_id,group_id,team_player_membership_id) select '" + id.org + "','" + id.team + "','" + id.group + "',id from team_player_memberships where player_id in ('" + id.stable + "','" + id.stableTwo + "');" +
    "insert into group_player_assignments(organization_id,team_id,group_id,team_player_membership_id) select '" + id.org + "','" + id.team + "','" + id.otherGroup + "',id from team_player_memberships where player_id='" + id.guest + "';" +
    "insert into training_sessions(id,organization_id,group_id,session_date,title,planned_duration_minutes,created_by) values ('" + id.session + "','" + id.org + "','" + id.group + "','2026-10-12','Attendance',60,'" + id.admin + "'),('" + id.allPresent + "','" + id.org + "','" + id.group + "','2026-10-13','All present',60,'" + id.admin + "'),('" + id.sessionB + "','" + id.org + "','" + id.otherGroup + "','2026-10-14','Other group',60,'" + id.admin + "'),('" + id.rollback + "','" + id.org + "','" + id.group + "','2026-10-15','Rollback',60,'" + id.admin + "');")
})
afterAll(async () => { await db.close() })

describe('training attendance cloud', () => {
  const mark = (status: string) => "insert into training_session_attendance(training_session_id,organization_id,player_id,status) values ('" + id.session + "','" + id.org + "','" + id.stable + "','" + status + "') on conflict (training_session_id,player_id) do update set status=excluded.status returning status"
  it('records, changes and resets marks without duplicates', async () => {
    await session(id.coach, async () => {
      expect((await db.query(mark('present'))).rows).toEqual([{ status: 'present' }])
      expect((await db.query(mark('absent'))).rows).toEqual([{ status: 'absent' }])
      expect((await db.query(mark('excused'))).rows).toEqual([{ status: 'excused' }])
      expect((await db.query("select count(*)::int as count from training_session_attendance where training_session_id='" + id.session + "' and player_id='" + id.stable + "'")).rows).toEqual([{ count: 1 }])
      await db.query("delete from training_session_attendance where training_session_id='" + id.session + "' and player_id='" + id.stable + "'")
      expect((await db.query("select count(*)::int as count from training_session_attendance where training_session_id='" + id.session + "' and player_id='" + id.stable + "'")).rows).toEqual([{ count: 0 }])
    })
  })
  it('accepts a same-organization guest, preserves history, and never changes stable assignment', async () => {
    await session(id.coach, async () => {
      await db.query("insert into training_session_guest_players(training_session_id,organization_id,player_id) values ('" + id.session + "','" + id.org + "','" + id.guest + "')")
      await db.query("insert into training_session_attendance(training_session_id,organization_id,player_id,status) values ('" + id.session + "','" + id.org + "','" + id.guest + "','present')")
      await db.exec('savepoint guest_history')
      try { await expect(db.query("delete from training_session_guest_players where training_session_id='" + id.session + "' and player_id='" + id.guest + "'")).rejects.toThrow('Clear attendance') }
      finally { await db.exec('rollback to savepoint guest_history') }
      expect((await db.query("select group_id from group_player_assignments a join team_player_memberships m on m.id=a.team_player_membership_id where m.player_id='" + id.guest + "' and a.status='active'")).rows).toEqual([{ group_id: id.otherGroup }])
      await db.query("delete from training_session_attendance where training_session_id='" + id.session + "' and player_id='" + id.guest + "'")
      await db.query("delete from training_session_guest_players where training_session_id='" + id.session + "' and player_id='" + id.guest + "'")
    })
  })
  it('enforces organization and roll-call membership in the database', async () => {
    await expect(asUser(id.coach, "insert into training_session_guest_players(training_session_id,organization_id,player_id) values ('" + id.session + "','" + id.org + "','" + id.outsiderPlayer + "')")).rejects.toThrow('same organization')
    await expect(asUser(id.coach, "insert into training_session_attendance(training_session_id,organization_id,player_id,status) values ('" + id.session + "','" + id.org + "','" + id.unassigned + "','present')")).rejects.toThrow('not part')
  })
  it('marks every stable and aggregated participant present atomically', async () => {
    await session(id.coach, async () => {
      await db.query("insert into training_session_guest_players(training_session_id,organization_id,player_id) values ('" + id.allPresent + "','" + id.org + "','" + id.guest + "')")
      expect((await db.query("select mark_training_session_all_present('" + id.allPresent + "') as count")).rows[0].count).toBe(3)
      expect((await db.query("select count(*)::int as count from training_session_attendance where training_session_id='" + id.allPresent + "' and status='present'")).rows).toEqual([{ count: 3 }])
    })
  })
  it('enforces view/edit permissions and rejects unapproved RPC callers', async () => {
    await expect(asUser(id.collaborator, "select * from training_session_attendance where training_session_id='" + id.session + "'")).resolves.toBeDefined()
    await expect(asUser(id.collaborator, mark('present'))).rejects.toThrow()
    await expect(asUser(id.outsider, "select mark_training_session_all_present('" + id.allPresent + "')")).rejects.toThrow('Permission denied')
  })
  it('allows an edit-enabled collaborator only in the authorized WorkGroup', async () => {
    await db.exec("insert into collaborator_permissions(membership_id,permission,enabled) values ((select id from group_memberships where user_id='" + id.collaborator + "' and group_id='" + id.group + "'),'training.edit',true) on conflict (membership_id,permission) do update set enabled=true")
    await expect(asUser(id.collaborator, "insert into training_session_attendance(training_session_id,organization_id,player_id,status) values ('" + id.session + "','" + id.org + "','" + id.stable + "','present') on conflict (training_session_id,player_id) do update set status=excluded.status")).resolves.toBeDefined()
    await expect(asUser(id.collaborator, "insert into training_session_attendance(training_session_id,organization_id,player_id,status) values ('" + id.sessionB + "','" + id.org + "','" + id.guest + "','present')")).rejects.toThrow()
  })
  it('keeps an old-session mark editable after the player moves to another WorkGroup', async () => {
    await db.exec("insert into training_session_attendance(training_session_id,organization_id,player_id,status,created_by) values ('" + id.session + "','" + id.org + "','" + id.stable + "','present','" + id.admin + "') on conflict (training_session_id,player_id) do update set status='present'")
    await db.exec("update group_player_assignments set status='ended',ended_at=current_date where group_id='" + id.group + "' and team_player_membership_id=(select id from team_player_memberships where player_id='" + id.stable + "')")
    await db.exec("insert into group_player_assignments(organization_id,team_id,group_id,team_player_membership_id) select '" + id.org + "','" + id.team + "','" + id.otherGroup + "',id from team_player_memberships where player_id='" + id.stable + "'")
    await session(id.coach, async () => {
      await db.query("update training_session_attendance set status='excused',note='Correzione storica' where training_session_id='" + id.session + "' and player_id='" + id.stable + "'")
      expect((await db.query("select training_session_id,status,note from training_session_attendance where player_id='" + id.stable + "' and training_session_id='" + id.session + "'")).rows).toEqual([{ training_session_id: id.session, status: 'excused', note: 'Correzione storica' }])
    })
  })
  it('rolls back all marks when the all-present RPC encounters a later failure', async () => {
    await db.exec("update group_player_assignments set status='ended',ended_at=current_date where group_id='" + id.otherGroup + "' and team_player_membership_id=(select id from team_player_memberships where player_id='" + id.stable + "'); insert into group_player_assignments(organization_id,team_id,group_id,team_player_membership_id) select '" + id.org + "','" + id.team + "','" + id.group + "',id from team_player_memberships where player_id='" + id.stable + "'")
    await db.exec("create function pg_temp.reject_second_mark() returns trigger language plpgsql as $$ begin if new.training_session_id='" + id.rollback + "' and new.player_id='" + id.stableTwo + "' then raise exception 'forced attendance failure'; end if; return new; end $$; create trigger reject_second_mark before insert on training_session_attendance for each row execute function pg_temp.reject_second_mark();")
    try {
      await expect(asUser(id.coach, "select mark_training_session_all_present('" + id.rollback + "')")).rejects.toThrow('forced attendance failure')
      expect((await db.query("select count(*)::int as count from training_session_attendance where training_session_id='" + id.rollback + "'")).rows).toEqual([{ count: 0 }])
    } finally { await db.exec('drop trigger reject_second_mark on training_session_attendance') }
  })
})
