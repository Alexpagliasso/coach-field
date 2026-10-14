import { requireSupabase } from '../lib/supabase'
import { fromRow } from './staffRepository'
import type { PlayerRating } from '../types/domain'

export type CloudPlayer = {
  id: string
  organizationId: string
  firstName: string
  lastName: string
  birthYear?: number
  archivedAt?: string
  createdAt: string
  updatedAt: string
  avatarUrl?: string | null
  preferredRole?: string | null
  technicalRating?: PlayerRating
}

export type GroupPlayerMembershipStatus = 'active' | 'inactive' | 'left' | 'archived'
export type GroupPlayerMembershipType = 'roster' | 'guest'

export type GroupPlayerMembership = {
  id: string
  organizationId: string
  groupId: string
  playerId: string
  season: string
  status: GroupPlayerMembershipStatus
  membershipType: GroupPlayerMembershipType
  joinedAt: string
  leftAt?: string
  previousRoles: string[]
  idealRoles: string[]
  goalkeeperCandidate: boolean
  createdAt: string
  updatedAt: string
}

export type TeamPlayerMembershipStatus = 'active' | 'inactive' | 'left' | 'archived'
export type TeamPlayerMembership = {
  id: string
  organizationId: string
  teamId: string
  playerId: string
  status: TeamPlayerMembershipStatus
  joinedAt: string
  leftAt?: string | null
  createdAt: string
  updatedAt: string
}

export type GroupPlayerAssignment = {
  id: string
  organizationId: string
  teamId: string
  groupId: string
  teamPlayerMembershipId: string
  status: 'active' | 'inactive' | 'ended'
  assignedAt: string
  endedAt?: string | null
  createdAt: string
  updatedAt: string
}

export type TeamRosterEntry = { membership: TeamPlayerMembership; player: CloudPlayer }
export type WorkGroupRosterEntry = TeamRosterEntry & { assignment: GroupPlayerAssignment }
export type WorkGroupPlayerSummary = {
  playerId: string
  trainingPresent: number
  trainingMarked: number
  callups: number
  matchesPlayed: number
}

export type PlayerMatchMetric = { playerId: string; matchStatus: 'scheduled' | 'live' | 'completed' | 'cancelled' | null }
export type PlayerMatchTotals = { callups: number; matchesPlayed: number }

/** A completed match is the current operational proxy for a player appearance. */
export function calculatePlayerMatchTotals(items: PlayerMatchMetric[]): PlayerMatchTotals {
  return { callups: items.length, matchesPlayed: items.filter(item => item.matchStatus === 'completed').length }
}

export async function getPlayerMatchTotals(playerId: string): Promise<PlayerMatchTotals> {
  const { data, error } = await requireSupabase().from('match_callups').select('player_id, match:matches(status)').eq('player_id', playerId)
  if (error) throw error
  return calculatePlayerMatchTotals((data ?? []).map(raw => {
    const row = raw as { player_id: string; match?: { status?: PlayerMatchMetric['matchStatus'] } | null }
    return { playerId: String(row.player_id), matchStatus: row.match?.status ?? null }
  }))
}

export type SetTeamRosterPlayerGroupResult = {
  assignmentId: string | null
  previousAssignmentId: string | null
  operation: 'assigned' | 'changed' | 'removed' | 'unchanged'
}
export type AssignTeamRosterPlayersResult = { assignedCount: number; movedCount: number }

export type RemoveTeamRosterPlayerResult = {
  membershipId: string
  endedAssignmentCount: number
  operation: 'removed' | 'unchanged'
}

export type ArchiveOrganizationPlayerResult = {
  playerId: string
  operation: 'archived' | 'unchanged'
}

export type DeleteOrganizationPlayerResult = {
  playerId: string
  deletedMembershipCount: number
  deletedAssignmentCount: number
  operation: 'deleted'
}

export type ImportGroupPlayerResult = {
  playerId: string
  membershipId: string
  playerCreated: boolean
  membershipCreated: boolean
}

export type ImportGroupPlayerInput = {
  playerId: string
  organizationId: string
  groupId: string
  firstName: string
  lastName: string
  birthYear?: number | null
  season: string
  membershipType?: GroupPlayerMembershipType
  status?: GroupPlayerMembershipStatus
  joinedAt?: string
  leftAt?: string
  previousRoles?: string[]
  idealRoles?: string[]
  goalkeeperCandidate?: boolean
}

type PlayerRow = Record<string, unknown>
type MembershipWithPlayerRow = PlayerRow & { player: PlayerRow }
type TeamMembershipWithPlayerRow = PlayerRow & { player: PlayerRow | null }

function toRow(row: object) {
  return Object.fromEntries(Object.entries(row)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => [key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`), value]))
}

export async function getGroupPlayers(groupId: string) {
  const { data, error } = await requireSupabase().from('group_player_memberships').select('*, player:players(*)').eq('group_id', groupId)
  if (error) throw error
  return (data ?? []).map(raw => {
    const row = raw as MembershipWithPlayerRow
    const { player, ...membership } = row
    return { membership: fromRow<GroupPlayerMembership>(membership), player: fromRow<CloudPlayer>(player) }
  })
}

export async function getTeamRoster(teamId: string): Promise<TeamRosterEntry[]> {
  const { data, error } = await requireSupabase().from('team_player_memberships').select('*, player:players(*)').eq('team_id', teamId).order('created_at')
  if (error) throw error
  return (data ?? []).map(raw => {
    const row = raw as TeamMembershipWithPlayerRow
    const { player, ...membership } = row
    if (!player) throw new Error('Profilo giocatore non accessibile per la rosa della categoria.')
    return { membership: fromRow<TeamPlayerMembership>(membership), player: fromRow<CloudPlayer>(player) }
  })
}

export async function getWorkGroupRoster(groupId: string): Promise<WorkGroupRosterEntry[]> {
  const { data, error } = await requireSupabase()
    .from('group_player_assignments')
    .select('*, membership:team_player_memberships(*, player:players(*))')
    .eq('group_id', groupId)
    .eq('status', 'active')
    .order('created_at')
  if (error) throw error
  return (data ?? []).flatMap(raw => {
    const row = raw as PlayerRow & { membership: TeamMembershipWithPlayerRow | null }
    if (!row.membership?.player) return []
    const { membership: rawMembership, ...assignment } = row
    const { player, ...membership } = rawMembership
    return [{ assignment: fromRow<GroupPlayerAssignment>(assignment), membership: fromRow<TeamPlayerMembership>(membership), player: fromRow<CloudPlayer>(player) }]
  })
}

/**
 * Loads list-level player metrics in batches. A call-up is deliberately not
 * treated as a match appearance: appearances do not exist in the cloud model
 * yet and must never be inferred.
 */
export async function getWorkGroupPlayerSummaries(groupId: string, playerIds: string[]): Promise<Map<string, WorkGroupPlayerSummary>> {
  const summaries = new Map(playerIds.map(playerId => [playerId, { playerId, trainingPresent: 0, trainingMarked: 0, callups: 0, matchesPlayed: 0 }]))
  if (playerIds.length === 0) return summaries
  const client = requireSupabase()
  const [sessionsResult, matchesResult] = await Promise.all([
    client.from('training_sessions').select('id').eq('group_id', groupId),
    client.from('matches').select('id,status').eq('group_id', groupId),
  ])
  if (sessionsResult.error) throw sessionsResult.error
  if (matchesResult.error) throw matchesResult.error
  const sessionIds = (sessionsResult.data ?? []).map(row => String(row.id))
  const matchStatusById = new Map((matchesResult.data ?? []).map(row => [String(row.id), String(row.status) as PlayerMatchMetric['matchStatus']]))
  const matchIds = [...matchStatusById.keys()]
  const [attendanceResult, callupsResult] = await Promise.all([
    sessionIds.length ? client.from('training_session_attendance').select('player_id,status').in('player_id', playerIds).in('training_session_id', sessionIds) : Promise.resolve({ data: [], error: null }),
    matchIds.length ? client.from('match_callups').select('player_id,match_id').in('player_id', playerIds).in('match_id', matchIds) : Promise.resolve({ data: [], error: null }),
  ])
  if (attendanceResult.error) throw attendanceResult.error
  if (callupsResult.error) throw callupsResult.error
  for (const mark of attendanceResult.data ?? []) {
    const summary = summaries.get(String(mark.player_id)); if (!summary) continue
    summary.trainingMarked += 1
    if (mark.status === 'present') summary.trainingPresent += 1
  }
  const metricsByPlayer = new Map<string, PlayerMatchMetric[]>()
  for (const callup of callupsResult.data ?? []) {
    const playerId = String(callup.player_id)
    metricsByPlayer.set(playerId, [...(metricsByPlayer.get(playerId) ?? []), { playerId, matchStatus: matchStatusById.get(String(callup.match_id)) ?? null }])
  }
  for (const [playerId, metrics] of metricsByPlayer) {
    const summary = summaries.get(playerId); if (summary) Object.assign(summary, calculatePlayerMatchTotals(metrics))
  }
  return summaries
}

export async function getActiveGroupAssignments(teamId: string) {
  const { data, error } = await requireSupabase().from('group_player_assignments').select('*').eq('team_id', teamId).eq('status', 'active')
  if (error) throw error
  return (data ?? []).map(fromRow<GroupPlayerAssignment>)
}

export async function getOrganizationPlayerArchiveEligibility(organizationId: string, playerIds: string[]) {
  if (playerIds.length === 0) return new Set<string>()
  const client = requireSupabase()
  const [teamResult, legacyResult] = await Promise.all([
    client.from('team_player_memberships').select('player_id').eq('organization_id', organizationId).eq('status', 'active').in('player_id', playerIds),
    client.from('group_player_memberships').select('player_id').eq('organization_id', organizationId).eq('status', 'active').in('player_id', playerIds),
  ])
  if (teamResult.error) throw teamResult.error
  if (legacyResult.error) throw legacyResult.error
  const blocked = new Set<string>([...(teamResult.data ?? []), ...(legacyResult.data ?? [])].map(row => String(row.player_id)))
  return new Set(playerIds.filter(playerId => !blocked.has(playerId)))
}

export async function setTeamRosterPlayerGroup(teamPlayerMembershipId: string, groupId: string | null) {
  const { data, error } = await requireSupabase().rpc('set_team_roster_player_group', {
    p_team_player_membership_id: teamPlayerMembershipId,
    p_group_id: groupId,
  }).single()
  if (error) throw error
  if (!data) throw new Error('Aggiornamento del WorkGroup non riuscito.')
  return fromRow<SetTeamRosterPlayerGroupResult>(data)
}

export async function assignTeamRosterPlayersToWorkGroup(groupId: string, teamPlayerMembershipIds: string[]) {
  const { data, error } = await requireSupabase().rpc('assign_team_roster_players_to_workgroup', {
    p_group_id: groupId,
    p_team_player_membership_ids: teamPlayerMembershipIds,
  }).single()
  if (error) throw error
  if (!data) throw new Error('Assegnazione dei giocatori non riuscita.')
  return fromRow<AssignTeamRosterPlayersResult>(data)
}

export async function removeTeamRosterPlayer(teamPlayerMembershipId: string) {
  const { data, error } = await requireSupabase().rpc('remove_team_roster_player', {
    p_team_player_membership_id: teamPlayerMembershipId,
  }).single()
  if (error) throw error
  if (!data) throw new Error('Rimozione dalla categoria non riuscita.')
  return fromRow<RemoveTeamRosterPlayerResult>(data)
}

export async function archiveOrganizationPlayer(playerId: string, organizationId: string) {
  const { data, error } = await requireSupabase().rpc('archive_organization_player', {
    p_player_id: playerId,
    p_organization_id: organizationId,
  }).single()
  if (error) throw error
  if (!data) throw new Error('Archiviazione del giocatore non riuscita.')
  return fromRow<ArchiveOrganizationPlayerResult>(data)
}

export async function deleteOrganizationPlayer(playerId: string, organizationId: string) {
  const { data, error } = await requireSupabase().rpc('delete_organization_player', {
    p_player_id: playerId,
    p_organization_id: organizationId,
  }).single()
  if (error) throw error
  if (!data) throw new Error('Eliminazione definitiva del giocatore non riuscita.')
  return fromRow<DeleteOrganizationPlayerResult>(data)
}

export async function createTeamRosterPlayer(input: Pick<CloudPlayer, 'organizationId' | 'firstName' | 'lastName'> & { teamId: string; birthYear?: number }) {
  const playerId = globalThis.crypto.randomUUID()
  const { data, error } = await requireSupabase().rpc('create_team_roster_player', {
    p_player_id: playerId,
    p_organization_id: input.organizationId,
    p_team_id: input.teamId,
    p_first_name: input.firstName,
    p_last_name: input.lastName,
    p_birth_year: input.birthYear ?? null,
  }).single()
  if (error) throw error
  if (!data) throw new Error('Creazione giocatore non riuscita.')
  return fromRow<{ playerId: string; membershipId: string }>(data)
}

export async function createWorkGroupRosterPlayer(input: Pick<CloudPlayer, 'organizationId' | 'firstName' | 'lastName'> & { teamId: string; groupId: string; birthYear?: number }) {
  const { data, error } = await requireSupabase().rpc('create_workgroup_roster_player', {
    p_organization_id: input.organizationId, p_team_id: input.teamId,
    p_group_id: input.groupId, p_first_name: input.firstName, p_last_name: input.lastName, p_birth_year: input.birthYear ?? null,
  }).single()
  if (error) throw error
  if (!data) throw new Error('Creazione giocatore non riuscita.')
  return fromRow<{ playerId: string; membershipId: string; assignmentId: string }>(data)
}

export async function getPlayer(playerId: string) {
  const { data, error } = await requireSupabase().from('players').select('*').eq('id', playerId).maybeSingle()
  if (error) throw error
  return data ? fromRow<CloudPlayer>(data) : undefined
}

export async function createPlayer(input: Pick<CloudPlayer, 'id' | 'organizationId' | 'firstName' | 'lastName'> & Partial<Pick<CloudPlayer, 'birthYear'>>) {
  const { data, error } = await requireSupabase().from('players').insert(toRow(input)).select('*').single()
  if (error) throw error
  return fromRow<CloudPlayer>(data)
}

export async function updatePlayer(playerId: string, patch: Partial<Pick<CloudPlayer, 'firstName' | 'lastName' | 'birthYear' | 'preferredRole' | 'technicalRating'>>) {
  const { data, error } = await requireSupabase().from('players').update(toRow(patch)).eq('id', playerId).select('*').single()
  if (error) throw error
  return fromRow<CloudPlayer>(data)
}

export async function createGroupPlayerMembership(input: Pick<GroupPlayerMembership, 'id' | 'organizationId' | 'groupId' | 'playerId' | 'season'> & Partial<Pick<GroupPlayerMembership, 'status' | 'membershipType' | 'joinedAt' | 'leftAt' | 'previousRoles' | 'idealRoles' | 'goalkeeperCandidate'>>) {
  const { data, error } = await requireSupabase().from('group_player_memberships').insert(toRow(input)).select('*').single()
  if (error) throw error
  return fromRow<GroupPlayerMembership>(data)
}

export async function updateGroupPlayerMembershipStatus(id: string, status: GroupPlayerMembershipStatus, leftAt?: string) {
  const { data, error } = await requireSupabase().from('group_player_memberships').update(toRow({ status, leftAt })).eq('id', id).select('*').single()
  if (error) throw error
  return fromRow<GroupPlayerMembership>(data)
}

export async function importGroupPlayer(input: ImportGroupPlayerInput) {
  const args = Object.fromEntries(Object.entries(input)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => [`p_${key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)}`, value]))
  const { data, error } = await requireSupabase().rpc('import_group_player', args).single()
  if (error) throw error
  return fromRow<ImportGroupPlayerResult>(data)
}
