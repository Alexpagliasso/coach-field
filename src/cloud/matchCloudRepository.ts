import { requireSupabase } from '../lib/supabase'
import { fromRow } from './staffRepository'
import type { CloudPlayer } from './playerCloudRepository'

export type CloudMatchStatus = 'scheduled' | 'live' | 'completed' | 'cancelled'
export type CloudMatchHomeAway = 'home' | 'away'
export type CloudMatch = {
  id: string; organizationId: string; groupId: string; matchDate: string; startTime?: string | null
  opponent: string; homeAway: CloudMatchHomeAway; location?: string | null; competition?: string | null
  status: CloudMatchStatus; ourScore?: number | null; opponentScore?: number | null; coachNotes: string
  matchFormat: 'seven_a_side'; periodCount: number; periodDurationMinutes: number; initialFormation: '2-3-1' | '3-2-1'
  createdBy: string; createdAt: string; updatedAt: string
}
export type CloudMatchCallupStatus = 'called' | 'confirmed' | 'unavailable'
export type CloudMatchCallup = { id: string; matchId: string; organizationId: string; playerId: string; source: 'roster' | 'guest'; sourceGroupId?: string | null; sourceGroupName?: string; status: CloudMatchCallupStatus; note: string; createdAt: string; updatedAt: string; player?: CloudPlayer }
export type CloudMatchCallupCandidate = { player: CloudPlayer; sourceGroupId: string; sourceGroupName: string }
export type CloudMatchPage = { matches: CloudMatch[]; total: number }
export type CloudMatchHistoryItem = CloudMatchCallup & { match?: CloudMatch }
export type CloudMatchLineupEntry = {
  id: string; matchId: string; playerId: string; slotId: string; positionX: number; positionY: number
  createdAt: string; updatedAt: string; player?: CloudPlayer
}
export type CloudMatchLineupSaveEntry = Pick<CloudMatchLineupEntry, 'playerId' | 'slotId' | 'positionX' | 'positionY'>

type MatchInput = Omit<CloudMatch, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'> & { id?: string }
const toRow = (row: object) => Object.fromEntries(Object.entries(row).filter(([, value]) => value !== undefined).map(([key, value]) => [key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`), value]))

export async function getCloudMatchPage(groupId: string, options: { page?: number; pageSize?: number; from?: string; to?: string; status?: CloudMatchStatus; query?: string; ascending?: boolean } = {}): Promise<CloudMatchPage> {
  const page = Math.max(1, options.page ?? 1), pageSize = Math.min(100, Math.max(1, options.pageSize ?? 20))
  let request = requireSupabase().from('matches').select('*', { count: 'exact' }).eq('group_id', groupId)
  if (options.from) request = request.gte('match_date', options.from)
  if (options.to) request = request.lte('match_date', options.to)
  if (options.status) request = request.eq('status', options.status)
  // Keep search before range/count so server-side pagination never hides a
  // matching opponent or competition on a later page.
  const query = options.query?.trim().replace(/[%,()]/g, ' ')
  if (query) request = request.or(`opponent.ilike.%${query}%,competition.ilike.%${query}%`)
  const { data, count, error } = await request.order('match_date', { ascending: options.ascending ?? false }).order('start_time', { ascending: options.ascending ?? false }).range((page - 1) * pageSize, page * pageSize - 1)
  if (error) throw error
  return { matches: (data ?? []).map(fromRow<CloudMatch>), total: count ?? 0 }
}

export async function getCloudMatches(groupId: string, from?: string, to?: string) {
  const first = await getCloudMatchPage(groupId, { page: 1, pageSize: 100, from, to, ascending: true })
  const pages = Math.ceil(first.total / 100)
  if (pages <= 1) return first.matches
  const rest = await Promise.all(Array.from({ length: pages - 1 }, (_, index) => getCloudMatchPage(groupId, { page: index + 2, pageSize: 100, from, to, ascending: true })))
  return [...first.matches, ...rest.flatMap(page => page.matches)]
}

export async function getCloudMatch(matchId: string, groupId?: string) {
  let request = requireSupabase().from('matches').select('*').eq('id', matchId)
  if (groupId) request = request.eq('group_id', groupId)
  const { data, error } = await request.maybeSingle()
  if (error) throw error
  return data ? fromRow<CloudMatch>(data) : undefined
}

export async function saveCloudMatch(input: MatchInput) {
  const row = toRow(input)
  const client = requireSupabase()
  const response = input.id
    ? await client.from('matches').update(row).eq('id', input.id).select('*').single()
    : await client.from('matches').insert(row).select('*').single()
  if (response.error) throw response.error
  return fromRow<CloudMatch>(response.data)
}

// Matches are cancelled instead of physically deleted so call-ups and their
// future match history remain auditable.
export async function cancelCloudMatch(matchId: string) {
  const { data, error } = await requireSupabase().from('matches').update({ status: 'cancelled', our_score: null, opponent_score: null }).eq('id', matchId).select('*').single()
  if (error) throw error
  return fromRow<CloudMatch>(data)
}

export async function getCloudMatchCallups(matchId: string) {
  const { data, error } = await requireSupabase().from('match_callups').select('*, player:players(*), source_group:groups!match_callups_source_group_id_fkey(id,name)').eq('match_id', matchId).order('created_at')
  if (error) throw error
  return ((data ?? []) as unknown[]).map(raw => {
    const record = raw as Record<string, unknown>; const { player, source_group: sourceGroup, ...callup } = record
    const group = sourceGroup as { id?: string; name?: string } | null
    return { ...fromRow<CloudMatchCallup>(callup), sourceGroupName: group?.name, player: player ? fromRow<CloudPlayer>(player) : undefined }
  })
}

export async function getCloudMatchInitialLineup(matchId: string) {
  const { data, error } = await requireSupabase().from('match_initial_lineup_entries').select('*, player:players(*)').eq('match_id', matchId).order('slot_id')
  if (error) throw error
  return ((data ?? []) as unknown[]).map(raw => {
    const record = raw as Record<string, unknown>; const { player, ...entry } = record
    return { ...fromRow<CloudMatchLineupEntry>(entry), player: player ? fromRow<CloudPlayer>(player as object) : undefined }
  })
}

/** Replaces the complete initial lineup in one authorized database transaction. */
export async function saveCloudMatchInitialLineup(matchId: string, entries: CloudMatchLineupSaveEntry[], expectedUpdatedAt: string, initialFormation?: CloudMatch['initialFormation']) {
  const params: Record<string, unknown> = {
    p_match_id: matchId,
    p_entries: entries.map(entry => ({ playerId: entry.playerId, slotId: entry.slotId, positionX: entry.positionX, positionY: entry.positionY })),
    p_expected_updated_at: expectedUpdatedAt,
  }
  if (initialFormation) params.p_initial_formation = initialFormation
  const { data, error } = await requireSupabase().rpc('save_match_initial_lineup', params)
  if (error) throw error
  return String(data)
}

/**
 * Returns only active players from other WorkGroups in the same organization.
 * The RPC checks matches.edit on the target match before intentionally crossing
 * ordinary WorkGroup read boundaries.
 */
export async function getCloudMatchCallupCandidates(matchId: string): Promise<CloudMatchCallupCandidate[]> {
  const { data, error } = await requireSupabase().rpc('list_match_callup_candidates', { p_match_id: matchId })
  if (error) throw error
  return ((data ?? []) as unknown[]).map(raw => {
    const row = raw as Record<string, unknown>
    return {
      player: fromRow<CloudPlayer>({ id: row.player_id, first_name: row.first_name, last_name: row.last_name, birth_year: row.birth_year }),
      sourceGroupId: String(row.source_group_id), sourceGroupName: String(row.source_group_name),
    }
  })
}

export async function addCloudMatchCallup(matchId: string, organizationId: string, playerId: string, status: CloudMatchCallupStatus = 'called', note = '') {
  const { data, error } = await requireSupabase().from('match_callups').upsert({ match_id: matchId, organization_id: organizationId, player_id: playerId, status, note }, { onConflict: 'match_id,player_id' }).select('*').single()
  if (error) throw error
  return fromRow<CloudMatchCallup>(data)
}

export async function updateCloudMatchCallup(matchId: string, playerId: string, patch: Pick<CloudMatchCallup, 'status'> & Partial<Pick<CloudMatchCallup, 'note'>>) {
  const { data, error } = await requireSupabase().from('match_callups').update(toRow(patch)).eq('match_id', matchId).eq('player_id', playerId).select('*').single()
  if (error) throw error
  return fromRow<CloudMatchCallup>(data)
}

export async function removeCloudMatchCallup(matchId: string, playerId: string) {
  const { error } = await requireSupabase().from('match_callups').delete().eq('match_id', matchId).eq('player_id', playerId)
  if (error) throw error
}

export async function getCloudPlayerMatchHistory(playerId: string, options: { page?: number; pageSize?: number } = {}) {
  const page = Math.max(1, options.page ?? 1), pageSize = Math.min(50, Math.max(1, options.pageSize ?? 10))
  const { data, count, error } = await requireSupabase().from('match_callups').select('*, match:matches(*)', { count: 'exact' }).eq('player_id', playerId).order('created_at', { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1)
  if (error) throw error
  return { items: (data ?? []).map(raw => { const record = raw as Record<string, unknown>; const { match, ...callup } = record; return { ...fromRow<CloudMatchCallup>(callup), match: match ? fromRow<CloudMatch>(match) : undefined } }), total: count ?? 0 }
}
