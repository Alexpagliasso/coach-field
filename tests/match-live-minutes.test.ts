import { describe, expect, it } from 'vitest'
import { calculateMatchPlayerMinutes } from '../src/utils/matchLiveMinutes'

const snapshot = (phase: 'running' | 'paused' | 'interval' | 'completed', elapsedSeconds: number, activePlayers: Array<{ playerId: string; slotId: string }> = []) => ({ matchId: 'match', phase, currentPeriod: 2, elapsedSeconds, version: 1, activePlayers, events: [] })

describe('live match minutes', () => {
  it('counts starters, substitutions and a re-entry from durable stints', () => {
    const rows = calculateMatchPlayerMinutes(['a', 'b', 'c'], [
      { id: '1', matchId: 'match', playerId: 'a', periodNumber: 1, enteredElapsedSeconds: 0, exitedElapsedSeconds: 900, createdAt: '' },
      { id: '2', matchId: 'match', playerId: 'a', periodNumber: 2, enteredElapsedSeconds: 300, exitedElapsedSeconds: null, createdAt: '' },
      { id: '3', matchId: 'match', playerId: 'b', periodNumber: 1, enteredElapsedSeconds: 400, exitedElapsedSeconds: 900, createdAt: '' },
      { id: '4', matchId: 'match', playerId: 'c', periodNumber: 2, enteredElapsedSeconds: 0, exitedElapsedSeconds: 300, createdAt: '' },
    ], snapshot('running', 600, [{ playerId: 'a', slotId: 'forward' }]))
    const a = rows.find(row => row.playerId === 'a')!, b = rows.find(row => row.playerId === 'b')!, c = rows.find(row => row.playerId === 'c')!
    expect(a.totalSeconds).toBe(1200)
    expect(a.entries).toBe(2)
    expect(b.totalSeconds).toBe(500)
    expect(c.totalSeconds).toBe(300)
    expect(c.active).toBe(false)
  })

  it('does not add interval or completed wall-clock time to an open stint', () => {
    const stints = [{ id: '1', matchId: 'match', playerId: 'a', periodNumber: 2, enteredElapsedSeconds: 0, exitedElapsedSeconds: null, createdAt: '' }]
    expect(calculateMatchPlayerMinutes(['a'], stints, snapshot('interval', 900)).at(0)?.totalSeconds).toBe(0)
    expect(calculateMatchPlayerMinutes(['a'], stints, snapshot('completed', 900)).at(0)?.totalSeconds).toBe(0)
  })

  it('orders active players first by default before lower-minute bench players', () => {
    const rows = calculateMatchPlayerMinutes(['a', 'b'], [
      { id: '1', matchId: 'match', playerId: 'a', periodNumber: 2, enteredElapsedSeconds: 0, exitedElapsedSeconds: null, createdAt: '' },
    ], snapshot('paused', 120, [{ playerId: 'a', slotId: 'goalkeeper' }]))
    expect(rows.map(row => row.playerId)).toEqual(['a', 'b'])
  })
})
