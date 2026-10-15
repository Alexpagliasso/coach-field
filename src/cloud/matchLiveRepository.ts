import { requireSupabase } from '../lib/supabase'

export type MatchLivePhase = 'ready' | 'running' | 'paused' | 'interval' | 'completed'
export type MatchLiveEventType = 'period_started' | 'paused' | 'resumed' | 'period_completed' | 'substitution' | 'goal' | 'goal_voided' | 'match_completed'
export type MatchLiveEvent = { id: string; type: MatchLiveEventType; period?: number | null; elapsedSeconds?: number | null; scoringTeam?: 'ours' | 'opponent' | null; scorerPlayerId?: string | null; opponentJerseyNumber?: number | null; playerOutId?: string | null; playerInId?: string | null; voidedAt?: string | null; createdAt: string }
export type MatchLiveSnapshot = { matchId: string; phase: MatchLivePhase; currentPeriod: number; elapsedSeconds: number; version: number; activePlayers: Array<{ playerId: string; slotId: string }>; events: MatchLiveEvent[] }
export type MatchPlayerStint = { id: string; matchId: string; playerId: string; periodNumber: number; enteredElapsedSeconds: number; exitedElapsedSeconds?: number | null; createdAt: string }
export type MatchPeriodScore = { period: number; ours: number; opponent: number; completed: boolean; figcOurs: number; figcOpponent: number }
export type MatchLiveReport = {
  match: { id: string; opponent: string; matchDate: string; startTime?: string | null; location?: string | null; competition?: string | null; homeAway: 'home' | 'away'; periodCount: number; periodDurationMinutes: number; coachNotes: string }
  globalScore: { ours: number; opponent: number }; periods: MatchPeriodScore[]; figcScore: { ours: number; opponent: number }
  goals: Array<{ id: string; period: number; elapsedSeconds: number; team: 'ours' | 'opponent'; scorerPlayerId?: string | null; scorerName?: string | null; opponentJerseyNumber?: number | null }>
  substitutions: Array<{ id: string; period: number; elapsedSeconds: number; playerOutId: string; playerInId: string }>
}

const requestId = () => crypto.randomUUID()
const rpc = async (name: string, args: Record<string, unknown>) => { const { error } = await requireSupabase().rpc(name, args); if (error) throw error }

/** Elapsed time is reconstructed in PostgreSQL from persisted timestamps, never from a React tick. */
export async function getCloudMatchLiveSnapshot(matchId: string): Promise<MatchLiveSnapshot> { const { data, error } = await requireSupabase().rpc('get_match_live_snapshot', { p_match_id: matchId }); if (error) throw error; return data as MatchLiveSnapshot }
export async function getCloudMatchLiveReport(matchId: string): Promise<MatchLiveReport> { const { data, error } = await requireSupabase().rpc('get_match_live_report', { p_match_id: matchId }); if (error) throw error; return data as MatchLiveReport }
/** RLS grants matches.view only; this is a read of durable, server-recorded stints. */
export async function getCloudMatchPlayerStints(matchId: string): Promise<MatchPlayerStint[]> {
  const { data, error } = await requireSupabase().from('match_player_stints').select('*').eq('match_id', matchId).order('period_number').order('entered_elapsed_seconds')
  if (error) throw error
  return (data ?? []).map(row => ({ id: String(row.id), matchId: String(row.match_id), playerId: String(row.player_id), periodNumber: Number(row.period_number), enteredElapsedSeconds: Number(row.entered_elapsed_seconds), exitedElapsedSeconds: row.exited_elapsed_seconds === null ? null : Number(row.exited_elapsed_seconds), createdAt: String(row.created_at) }))
}
export async function startCloudMatchLive(matchId: string, id = requestId()) { await rpc('start_match_live', { p_match_id: matchId, p_request_id: id }); return id }
export async function pauseCloudMatchLive(matchId: string, id = requestId()) { await rpc('pause_match_live', { p_match_id: matchId, p_request_id: id }); return id }
export async function resumeCloudMatchLive(matchId: string, id = requestId()) { await rpc('resume_match_live', { p_match_id: matchId, p_request_id: id }); return id }
export async function finishCloudMatchPeriod(matchId: string, id = requestId()) { await rpc('finish_match_period', { p_match_id: matchId, p_request_id: id }); return id }
export async function startCloudNextMatchPeriod(matchId: string, id = requestId()) { await rpc('start_next_match_period', { p_match_id: matchId, p_request_id: id }); return id }
export async function substituteCloudMatchPlayer(matchId: string, playerOutId: string, playerInId: string, id = requestId()) { await rpc('substitute_match_live_player', { p_match_id: matchId, p_player_out_id: playerOutId, p_player_in_id: playerInId, p_request_id: id }); return id }
export async function recordCloudMatchGoal(matchId: string, scoringTeam: 'ours' | 'opponent', options: { scorerPlayerId?: string; opponentJerseyNumber?: number }, id = requestId()) { await rpc('record_match_live_goal', { p_match_id: matchId, p_scoring_team: scoringTeam, p_scorer_player_id: options.scorerPlayerId ?? null, p_opponent_jersey_number: options.opponentJerseyNumber ?? null, p_request_id: id }); return id }
export async function voidCloudMatchGoal(matchId: string, goalEventId: string, id = requestId()) { await rpc('void_match_live_goal', { p_match_id: matchId, p_goal_event_id: goalEventId, p_request_id: id }); return id }
export async function completeCloudMatchLive(matchId: string, id = requestId()) { await rpc('complete_match_live', { p_match_id: matchId, p_request_id: id }); return id }
