import { describe, expect, it } from 'vitest'
import type { WorkGroupPlayerSummary, WorkGroupRosterEntry } from '../src/cloud/playerCloudRepository'
import { nextPlayerSort, sortWorkGroupRoster } from '../src/utils/playerSorting'
import { readFileSync } from 'node:fs'

const entry = (id: string, firstName: string, lastName: string, preferredRole: string | null, technicalRating: number | null): WorkGroupRosterEntry => ({
  assignment: { id: `assignment-${id}` }, membership: { id: `membership-${id}` },
  player: { id, firstName, lastName, preferredRole, technicalRating },
} as WorkGroupRosterEntry)

const summaries = new Map<string, WorkGroupPlayerSummary>([
  ['a', { playerId: 'a', trainingPresent: 3, trainingMarked: 4, callups: 2, matchesPlayed: 1 }],
  ['b', { playerId: 'b', trainingPresent: 8, trainingMarked: 8, callups: 1, matchesPlayed: 0 }],
])
const roster = [entry('a', 'Émile', 'Rossi', null, null), entry('b', 'Anna', 'Bianchi', 'Difensore', 3.5), entry('c', 'Carlo', 'Rossi', 'Attaccante', 4.5)]

describe('Players sorting', () => {
  it('cycles the shared desktop/mobile sorting state through asc, desc and default', () => {
    expect(nextPlayerSort(undefined, 'name')).toEqual({ key: 'name', direction: 'asc' })
    expect(nextPlayerSort({ key: 'name', direction: 'asc' }, 'name')).toEqual({ key: 'name', direction: 'desc' })
    expect(nextPlayerSort({ key: 'name', direction: 'desc' }, 'name')).toBeUndefined()
  })

  it('uses Italian text comparison, numerical ratings and preserves equal roster order', () => {
    expect(sortWorkGroupRoster(roster, summaries, { key: 'name', direction: 'asc' }).map(item => item.player.id)).toEqual(['b', 'c', 'a'])
    expect(sortWorkGroupRoster(roster, summaries, { key: 'rating', direction: 'desc' }).map(item => item.player.id)).toEqual(['c', 'b', 'a'])
    expect(sortWorkGroupRoster(roster, summaries, { key: 'trainings', direction: 'desc' }).map(item => item.player.id)).toEqual(['b', 'a', 'c'])
  })

  it('keeps null cloud values at the bottom in both directions and does not mutate roster data', () => {
    const original = roster.map(item => item.player.id)
    expect(sortWorkGroupRoster(roster, summaries, { key: 'role', direction: 'asc' }).map(item => item.player.id)).toEqual(['c', 'b', 'a'])
    expect(sortWorkGroupRoster(roster, summaries, { key: 'role', direction: 'desc' }).map(item => item.player.id)).toEqual(['b', 'c', 'a'])
    expect(roster.map(item => item.player.id)).toEqual(original)
  })

  it('paginates only after the shared filter and ordering pipeline', () => {
    const page = readFileSync('src/pages/PlayersPage.tsx', 'utf8')
    expect(page).toContain('const pageSize = 10')
    expect(page).toContain('const paged = visible.slice')
    expect(page).toContain('setPage(1)')
    expect(page).toContain('getWorkGroupRoster(rosterGroup.id)')
  })
})
