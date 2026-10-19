import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const page = readFileSync('src/pages/PlayersPage.tsx', 'utf8')
const repository = readFileSync('src/cloud/playerCloudRepository.ts', 'utf8')
const stars = readFileSync('src/components/PlayerStarRating.tsx', 'utf8')

describe('PlayersPage profile synchronization', () => {
  it('maps profile fields returned by the WorkGroup roster query', () => {
    expect(repository).toContain("select('*, membership:team_player_memberships(*, player:players(*))')")
    expect(repository).toContain('preferredRole?: string | null')
    expect(repository).toContain('technicalRating?: PlayerRating')
  })
  it('renders cloud role and rating on desktop and mobile with null-safe labels', () => {
    expect(page).toContain("player.preferredRole || 'Ruolo non impostato'")
    expect(page).toContain('CompactStarRating value={player.technicalRating ?? null}')
    expect(stars).toContain("if (value === null) return <span className=\"compact-rating\">")
    expect(stars).toContain('Non valutato')
  })
  it('reloads the authorized WorkGroup roster after the profile closes without retaining stale rows', () => {
    expect(page).toContain('if (!profilePlayerId && rosterGroup) void refresh()')
    expect(page).toContain('if (current !== request.current) return')
  })
})
