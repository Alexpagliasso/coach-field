import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const dashboard = readFileSync(new URL('../src/pages/GroupDashboardPage.tsx', import.meta.url), 'utf8')
const preview = readFileSync(new URL('../src/components/WorkGroupRosterPreview.tsx', import.meta.url), 'utf8')
const repository = readFileSync(new URL('../src/cloud/playerCloudRepository.ts', import.meta.url), 'utf8')

describe('Dashboard WorkGroup cloud roster', () => {
  it('uses active stable WorkGroup assignments, not IndexedDB or the entire category roster', () => {
    expect(repository).toContain(".from('group_player_assignments')")
    expect(repository).toContain(".eq('group_id', groupId)")
    expect(repository).toContain(".eq('status', 'active')")
    expect(dashboard).toContain('getWorkGroupRoster(activeGroup.id)')
    expect(dashboard).not.toContain('getPlayers(')
    expect(dashboard).not.toContain('getCurrentSession')
  })

  it('clears old WorkGroup roster data and rejects stale async responses', () => {
    expect(dashboard).toContain('setRoster([])')
    expect(dashboard).toContain('current !== rosterRequest.current')
    expect(dashboard).toContain('[activeGroup?.id]')
  })

  it('renders loading, empty, error/retry and cloud roster preview states', () => {
    expect(dashboard).toContain('Rosa del gruppo')
    expect(dashboard).toContain('Caricamento rosa...')
    expect(dashboard).toContain('rosterError')
    expect(dashboard).toContain('>Riprova</Button>')
    expect(dashboard).toContain('<WorkGroupRosterPreview roster={roster}')
    expect(preview).toContain('Rosa WorkGroup vuota')
    expect(dashboard).toContain('>Vedi tutti <ArrowRight')
  })

  it('keeps a compact swipeable preview with controls and avatar fallback for large rosters', () => {
    expect(preview).toContain('overflow-x-auto')
    expect(preview).toContain('snap-x')
    expect(preview).toContain('scrollBy')
    expect(preview).toContain('player.avatarUrl')
    expect(preview).toContain('initials(player.firstName, player.lastName)')
    expect(preview).toContain('roster.length')
  })
})
