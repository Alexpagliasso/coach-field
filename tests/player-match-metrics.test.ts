import { describe, expect, it } from 'vitest'
import { calculatePlayerMatchTotals } from '../src/cloud/playerCloudRepository'

describe('player match metrics', () => {
  it('keeps call-ups separate and counts appearances only for completed matches', () => {
    expect(calculatePlayerMatchTotals([
      { playerId: 'p1', matchStatus: 'scheduled' },
      { playerId: 'p1', matchStatus: 'live' },
      { playerId: 'p1', matchStatus: 'cancelled' },
      { playerId: 'p1', matchStatus: 'completed' },
      { playerId: 'p1', matchStatus: 'completed' },
    ])).toEqual({ callups: 5, matchesPlayed: 2 })
  })
})
