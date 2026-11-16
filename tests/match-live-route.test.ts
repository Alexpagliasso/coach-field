import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

describe('autonomous Match Live route', () => {
  it('uses one dedicated protected route and cloud-backed panel', () => {
    expect(read('src/App.tsx')).toContain('path="matches/:id/live"')
    const page = read('src/pages/MatchLivePage.tsx')
    expect(page).toContain('getCloudMatch(id, activeGroup.id)')
    expect(page).toContain('<MatchLivePanel')
    expect(page).toContain("window.addEventListener('pageshow'")
    expect(page).toContain("document.addEventListener('visibilitychange'")
  })
  it('routes every live entry point to the autonomous screen', () => {
    expect(read('src/components/MatchdayCard.tsx')).toContain('`/matches/${match.id}/live`')
    expect(read('src/components/Layout.tsx')).toContain('`/matches/${liveMatch.id}/live`')
    expect(read('src/pages/MatchDetailPage.tsx')).toContain('`/app/${activeGroup?.id}/matches/${id}/live`')
    const layout = read('src/components/Layout.tsx')
    expect(layout).toContain('page.matches.length === 1')
    expect(layout).toContain("sessionStorage.getItem('growpitch:live-dismissed')")
  })
  it('keeps live writes in the existing repository-backed panel', () => {
    const panel = read('src/components/MatchLivePanel.tsx')
    for (const operation of ['recordCloudMatchGoal', 'voidCloudMatchGoal', 'substituteCloudMatchPlayer', 'undoLastCloudMatchSubstitution']) expect(panel).toContain(operation)
    expect(panel).toContain('disabled={!canAct || snapshot.phase === \'interval\' || saving}')
  })
})
