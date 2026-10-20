import { requireSupabase } from '../lib/supabase'
import { fromRow } from './staffRepository'
import { getWorkGroupRoster, type CloudPlayer, type WorkGroupRosterEntry } from './playerCloudRepository'

export type AttendanceStatus = 'present' | 'absent' | 'excused'
export type CloudAttendance = { id: string; trainingSessionId: string; organizationId: string; playerId: string; status: AttendanceStatus; note: string; createdAt: string; updatedAt: string }
export type AttendanceRollCallEntry = { player: CloudPlayer; stable: boolean; guest: boolean; attendance?: CloudAttendance }
export type PlayerAttendanceHistoryItem = CloudAttendance & { session?: { id: string; sessionDate: string; title: string; groupId: string } }

export async function getTrainingAttendance(sessionId: string) {
  const { data, error } = await requireSupabase().from('training_session_attendance').select('*').eq('training_session_id', sessionId)
  if (error) throw error
  return (data ?? []).map(fromRow<CloudAttendance>)
}
export async function getTrainingSessionGuests(sessionId: string) {
  const { data, error } = await requireSupabase().from('training_session_guest_players').select('*, player:players(*)').eq('training_session_id', sessionId)
  if (error) throw error
  return (data ?? []).map(raw => { const record = raw as Record<string, unknown>; const { player, ...guest } = record; return { ...fromRow<{ playerId: string }>(guest), player: fromRow<CloudPlayer>(player as object) } })
}
export async function getAggregatablePlayers(organizationId: string, excludedPlayerIds: string[] = []) {
  let request = requireSupabase().from('players').select('*').eq('organization_id', organizationId).is('archived_at', null).order('last_name').order('first_name')
  if (excludedPlayerIds.length) request = request.not('id', 'in', `(${excludedPlayerIds.join(',')})`)
  const { data, error } = await request
  if (error) throw error
  return (data ?? []).map(fromRow<CloudPlayer>)
}
export async function getTrainingRollCall(sessionId: string, groupId: string): Promise<AttendanceRollCallEntry[]> {
  const [roster, guests, attendance] = await Promise.all([getWorkGroupRoster(groupId), getTrainingSessionGuests(sessionId), getTrainingAttendance(sessionId)])
  const marks = new Map(attendance.map(item => [item.playerId, item]))
  const players = new Map<string, AttendanceRollCallEntry>()
  roster.forEach((entry: WorkGroupRosterEntry) => players.set(entry.player.id, { player: entry.player, stable: true, guest: false, attendance: marks.get(entry.player.id) }))
  guests.forEach(entry => players.set(entry.player.id, { player: entry.player, stable: players.get(entry.player.id)?.stable ?? false, guest: true, attendance: marks.get(entry.player.id) }))
  const historicalIds = attendance.map(item => item.playerId).filter(playerId => !players.has(playerId))
  if (historicalIds.length) {
    const { data, error } = await requireSupabase().from('players').select('*').in('id', historicalIds)
    if (error) throw error
    for (const raw of data ?? []) { const player = fromRow<CloudPlayer>(raw); players.set(player.id, { player, stable: false, guest: false, attendance: marks.get(player.id) }) }
  }
  return [...players.values()]
}
export async function saveTrainingAttendance(input: Omit<CloudAttendance, 'id' | 'createdAt' | 'updatedAt'>) {
  const { data, error } = await requireSupabase().from('training_session_attendance').upsert({
    training_session_id: input.trainingSessionId, organization_id: input.organizationId, player_id: input.playerId, status: input.status, note: input.note,
  }, { onConflict: 'training_session_id,player_id' }).select('*').single()
  if (error) throw error
  return fromRow<CloudAttendance>(data)
}
export async function clearTrainingAttendance(sessionId: string, playerId: string) {
  const { error } = await requireSupabase().from('training_session_attendance').delete().eq('training_session_id', sessionId).eq('player_id', playerId)
  if (error) throw error
}
/**
 * Writes only explicitly confirmed draft values. Marked rows use one idempotent
 * upsert request; explicit resets are deleted separately because `status` is
 * non-null in the cloud schema.
 */
export async function saveTrainingAttendanceBatch(sessionId: string, organizationId: string, entries: Array<{ playerId: string; status?: AttendanceStatus }>) {
  const client = requireSupabase()
  const marked = entries.filter((entry): entry is { playerId: string; status: AttendanceStatus } => entry.status !== undefined)
  const unmarkedIds = entries.filter(entry => entry.status === undefined).map(entry => entry.playerId)
  if (marked.length) {
    const { error } = await client.from('training_session_attendance').upsert(marked.map(entry => ({
      training_session_id: sessionId, organization_id: organizationId, player_id: entry.playerId, status: entry.status, note: '',
    })), { onConflict: 'training_session_id,player_id' })
    if (error) throw error
  }
  if (unmarkedIds.length) {
    const { error } = await client.from('training_session_attendance').delete().eq('training_session_id', sessionId).in('player_id', unmarkedIds)
    if (error) throw error
  }
}
export async function markTrainingSessionAllPresent(sessionId: string) {
  const { data, error } = await requireSupabase().rpc('mark_training_session_all_present', { p_training_session_id: sessionId })
  if (error) throw error
  return Number(data)
}
export async function addTrainingSessionGuest(sessionId: string, organizationId: string, playerId: string) {
  const { error } = await requireSupabase().from('training_session_guest_players').insert({ training_session_id: sessionId, organization_id: organizationId, player_id: playerId })
  if (error) throw error
}
export async function removeTrainingSessionGuest(sessionId: string, playerId: string) {
  const { error } = await requireSupabase().from('training_session_guest_players').delete().eq('training_session_id', sessionId).eq('player_id', playerId)
  if (error) throw error
}
export async function getPlayerAttendanceHistory(playerId: string, options: { page?: number; pageSize?: number } = {}) {
  const page = Math.max(1, options.page ?? 1)
  const pageSize = Math.min(50, Math.max(1, options.pageSize ?? 10))
  const { data, count, error } = await requireSupabase().from('training_session_attendance')
    .select('*, session:training_sessions!inner(id,session_date,title,group_id,is_hidden)', { count: 'exact' })
    .eq('session.is_hidden', false)
    .eq('player_id', playerId).order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)
  if (error) throw error
  return {
    items: (data ?? []).map(raw => {
      const record = raw as Record<string, unknown>
      const { session, ...attendance } = record
      return { ...fromRow<CloudAttendance>(attendance), session: session ? fromRow<PlayerAttendanceHistoryItem['session']>(session) : undefined }
    }),
    total: count ?? 0,
  }
}
