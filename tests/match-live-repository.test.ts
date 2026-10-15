import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpc = vi.fn()
vi.mock('../src/lib/supabase', () => ({ requireSupabase: () => ({ rpc }) }))

import { getCloudMatchLiveReport, getCloudMatchLiveSnapshot, recordCloudMatchGoal, startCloudMatchLive, substituteCloudMatchPlayer, voidCloudMatchGoal } from '../src/cloud/matchLiveRepository'

describe('match live cloud repository', () => {
  beforeEach(() => { rpc.mockReset(); rpc.mockResolvedValue({ data: undefined, error: null }) })

  it('uses the authenticated RPC contract and allows callers to reuse a request ID after a retry', async () => {
    const requestId = '10000000-0000-0000-0000-000000000001'
    await startCloudMatchLive('match-1', requestId)
    await startCloudMatchLive('match-1', requestId)
    expect(rpc).toHaveBeenNthCalledWith(1, 'start_match_live', { p_match_id: 'match-1', p_request_id: requestId })
    expect(rpc).toHaveBeenNthCalledWith(2, 'start_match_live', { p_match_id: 'match-1', p_request_id: requestId })
  })

  it('sends only the permitted scorer fields for our and opponent goals', async () => {
    await recordCloudMatchGoal('match-1', 'ours', { scorerPlayerId: 'player-1' }, '10000000-0000-0000-0000-000000000002')
    await recordCloudMatchGoal('match-1', 'opponent', { opponentJerseyNumber: 9 }, '10000000-0000-0000-0000-000000000003')
    expect(rpc).toHaveBeenNthCalledWith(1, 'record_match_live_goal', { p_match_id: 'match-1', p_scoring_team: 'ours', p_scorer_player_id: 'player-1', p_opponent_jersey_number: null, p_request_id: '10000000-0000-0000-0000-000000000002' })
    expect(rpc).toHaveBeenNthCalledWith(2, 'record_match_live_goal', { p_match_id: 'match-1', p_scoring_team: 'opponent', p_scorer_player_id: null, p_opponent_jersey_number: 9, p_request_id: '10000000-0000-0000-0000-000000000003' })
  })

  it('exposes snapshot, report, substitution and goal correction endpoints without local persistence', async () => {
    rpc.mockResolvedValueOnce({ data: { matchId: 'match-1', phase: 'paused', currentPeriod: 1, elapsedSeconds: 42, version: 2, activePlayers: [], events: [] }, error: null })
    expect((await getCloudMatchLiveSnapshot('match-1')).elapsedSeconds).toBe(42)
    rpc.mockResolvedValueOnce({ data: { match: {}, globalScore: { ours: 0, opponent: 0 }, periods: [], figcScore: { ours: 0, opponent: 0 }, goals: [], substitutions: [] }, error: null })
    expect((await getCloudMatchLiveReport('match-1')).figcScore).toEqual({ ours: 0, opponent: 0 })
    await substituteCloudMatchPlayer('match-1', 'out', 'in', '10000000-0000-0000-0000-000000000004')
    await voidCloudMatchGoal('match-1', 'goal-1', '10000000-0000-0000-0000-000000000005')
    expect(rpc).toHaveBeenCalledWith('substitute_match_live_player', expect.objectContaining({ p_player_out_id: 'out', p_player_in_id: 'in' }))
    expect(rpc).toHaveBeenCalledWith('void_match_live_goal', expect.objectContaining({ p_goal_event_id: 'goal-1' }))
  })
})
