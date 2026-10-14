import { describe, expect, it } from 'vitest'
import { availablePlayerLifecycleActions, playerLifecycleErrorMessage, rosterLifecycleState } from '../src/cloud/playerLifecycle'
import type { TeamRosterEntry } from '../src/cloud/playerCloudRepository'

function entry(status: TeamRosterEntry['membership']['status'], archivedAt?: string): TeamRosterEntry {
  return {
    membership: { id: 'membership-1', organizationId: 'organization-1', teamId: 'team-1', playerId: 'player-1', status, joinedAt: '2026-01-01', createdAt: '2026-01-01', updatedAt: '2026-01-01' },
    player: { id: 'player-1', organizationId: 'organization-1', firstName: 'Ada', lastName: 'Rossi', archivedAt, createdAt: '2026-01-01', updatedAt: '2026-01-01' },
  }
}

describe('category roster lifecycle UI rules', () => {
  it('keeps active, left and globally archived states distinct', () => {
    expect(rosterLifecycleState(entry('active'))).toBe('active')
    expect(rosterLifecycleState(entry('left'))).toBe('left')
    expect(rosterLifecycleState(entry('left', '2026-10-08T10:00:00Z'))).toBe('archived')
  })

  it('offers only context-compatible lifecycle actions', () => {
    expect(availablePlayerLifecycleActions(entry('active'))).toEqual(['remove'])
    expect(availablePlayerLifecycleActions(entry('left'))).toEqual(['archive'])
    expect(availablePlayerLifecycleActions(entry('left', '2026-10-08T10:00:00Z'))).toEqual(['delete'])
  })

  it('explains missing remote RPCs and protected legacy data', () => {
    expect(playerLifecycleErrorMessage({ code: 'PGRST202', message: 'schema cache' })).toContain('migration player lifecycle')
    expect(playerLifecycleErrorMessage({ code: '23514', message: 'Player has legacy group history that must be preserved' })).toContain('collegamenti legacy')
  })
})
