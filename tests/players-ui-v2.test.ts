import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const page = readFileSync('src/pages/PlayersPage.tsx', 'utf8')
const profile = readFileSync('src/components/PlayerProfileModal.tsx', 'utf8')
const sorting = readFileSync('src/utils/playerSorting.ts', 'utf8')

describe('GP-UX-04 player directory', () => {
  it('loads roster and reliable summaries only for the selected WorkGroup', () => {
    expect(page).toContain('getWorkGroupRoster(rosterGroup.id)')
    expect(page).toContain('getWorkGroupPlayerSummaries(rosterGroup.id')
    expect(page).toContain('setSelectedGroupId(activeGroup?.id')
    expect(page).toContain('<PlayerProfileModal')
  })

  it('keeps every supported meaningful sort available on desktop and mobile', () => {
    for (const key of ['name', 'role', 'rating', 'trainings', 'callups', 'matchesPlayed']) {
      expect(page).toContain(key)
      expect(sorting).toContain(key)
    }
    expect(page).toContain('nextPlayerSort')
    expect(page).toContain('players-mobile-sort')
  })

  it('preserves authorized actions and all profile workflows', () => {
    expect(page).toContain('PermissionAction permission="players.create"')
    expect(page).toContain('editable={isAdmin}')
    expect(page).toContain('setTeamRosterPlayerGroup')
    for (const feature of ['updatePlayer', 'savePlayerNote', 'savePlayerObjective', 'archivePlayerObjective', 'PlayerStarRating']) expect(profile).toContain(feature)
  })

  it('uses a dedicated mobile list rather than the desktop table', () => {
    expect(page).toContain('hidden overflow-hidden rounded-xl border border-app-border md:block')
    expect(page).toContain('className="player-mobile-card"')
    expect(page).toContain('player-mobile-metrics')
    expect(page).toContain('player-role-indicator')
  })
})
