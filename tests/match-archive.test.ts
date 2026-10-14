import { describe, expect, it } from 'vitest'
import type { CloudMatch } from '../src/cloud/matchCloudRepository'
import { matchesMatchArchive, paginateMatchArchive, sortMatchArchive } from '../src/utils/matchArchive'

const match = (id: string, patch: Partial<CloudMatch> = {}): CloudMatch => ({
  id, organizationId: 'org', groupId: 'group', matchDate: '2026-10-10', startTime: '18:00', opponent: 'Atletico Roma', homeAway: 'home', status: 'scheduled', coachNotes: '', createdBy: 'coach', createdAt: '', updatedAt: '', ...patch,
})

describe('match archive', () => {
  const matches = [
    match('completed', { matchDate: '2026-09-20', opponent: 'Città', competition: 'Campionato', status: 'completed', ourScore: 2, opponentScore: 1 }),
    match('future', { matchDate: '2026-10-22', opponent: 'Atletico Roma', competition: 'Coppa' }),
    match('cancelled', { matchDate: '2026-10-25', opponent: 'Borgo', status: 'cancelled' }),
  ]

  it('filters the entire authorized dataset before sorting and pagination', () => {
    const filtered = matches.filter(item => matchesMatchArchive(item, { query: 'coppa', status: 'scheduled', from: '2026-10-01' }))
    expect(filtered.map(item => item.id)).toEqual(['future'])
    expect(paginateMatchArchive(matches, 2, 2)).toEqual(expect.objectContaining({ total: 3, pages: 2, page: 2, matches: [matches[2]] }))
  })

  it('keeps upcoming matches distinct from completed and cancelled records', () => {
    expect(sortMatchArchive(matches, 'upcoming', '2026-10-15').map(item => item.id)).toEqual(['future', 'cancelled', 'completed'])
    expect(sortMatchArchive(matches, 'opponent').map(item => item.id)).toEqual(['future', 'cancelled', 'completed'])
  })
})
