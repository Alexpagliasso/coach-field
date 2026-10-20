import { requireSupabase } from '../lib/supabase'

export type AttendanceTrendPoint = { sessionId: string; date: string; title: string; present: number; marked: number }
export type CallupDistributionPoint = { playerId: string; name: string; callups: number; unavailable: number }

/** Attendance is intentionally measured only against explicit marks: unmarked never means absent. */
export async function getDashboardAttendanceTrend(groupId: string, limit = 8): Promise<AttendanceTrendPoint[]> {
  const client = requireSupabase()
  const { data: sessions, error: sessionError } = await client.from('training_sessions').select('id,session_date,title').eq('group_id', groupId).eq('is_hidden', false).eq('status', 'completed').order('session_date', { ascending: false }).limit(limit)
  if (sessionError) throw sessionError
  const ids = (sessions ?? []).map(row => String(row.id))
  if (!ids.length) return []
  const { data: marks, error: markError } = await client.from('training_session_attendance').select('training_session_id,status').in('training_session_id', ids)
  if (markError) throw markError
  const totals = new Map(ids.map(id => [id, { present: 0, marked: 0 }]))
  for (const mark of marks ?? []) {
    const item = totals.get(String(mark.training_session_id)); if (!item) continue
    item.marked += 1
    if (mark.status === 'present') item.present += 1
  }
  return (sessions ?? []).map(session => {
    const total = totals.get(String(session.id))!
    return { sessionId: String(session.id), date: String(session.session_date), title: String(session.title), ...total }
  }).reverse()
}

/** Call-ups are counted as registered choices; unavailable is displayed separately, never discarded. */
export async function getDashboardCallupDistribution(groupId: string, from: string): Promise<CallupDistributionPoint[]> {
  const client = requireSupabase()
  const { data: matches, error: matchError } = await client.from('matches').select('id').eq('group_id', groupId).eq('is_hidden', false).gte('match_date', from)
  if (matchError) throw matchError
  const matchIds = (matches ?? []).map(row => String(row.id))
  if (!matchIds.length) return []
  const { data, error } = await client.from('match_callups').select('player_id,status,player:players(first_name,last_name)').in('match_id', matchIds)
  if (error) throw error
  const rows = new Map<string, CallupDistributionPoint>()
  for (const raw of data ?? []) {
    const row = raw as { player_id: string; status: string; player?: { first_name?: string; last_name?: string } | null }
    const id = String(row.player_id), player = row.player
    const item = rows.get(id) ?? { playerId: id, name: [player?.first_name, player?.last_name].filter(Boolean).join(' ') || 'Giocatore', callups: 0, unavailable: 0 }
    item.callups += 1
    if (row.status === 'unavailable') item.unavailable += 1
    rows.set(id, item)
  }
  return [...rows.values()].sort((a, b) => b.callups - a.callups || a.name.localeCompare(b.name))
}
