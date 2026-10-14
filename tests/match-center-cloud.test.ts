import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
const repository = readFileSync(new URL('../src/cloud/matchCloudRepository.ts', import.meta.url), 'utf8')
const matches = readFileSync(new URL('../src/pages/MatchesPage.tsx', import.meta.url), 'utf8')
const detail = readFileSync(new URL('../src/pages/MatchDetailPage.tsx', import.meta.url), 'utf8')
const callups = readFileSync(new URL('../src/components/MatchCallupsPanel.tsx', import.meta.url), 'utf8')
const calendar = readFileSync(new URL('../src/pages/CalendarPage.tsx', import.meta.url), 'utf8')
const dashboard = readFileSync(new URL('../src/pages/GroupDashboardPage.tsx', import.meta.url), 'utf8')

describe('Match Center cloud flow', () => {
  it('uses the effective cloud routes without a legacy-data boundary', () => {
    expect(app).toContain('path="matches" element={<PermissionGuard permission="matches.view"><MatchesPage /></PermissionGuard>}')
    expect(app).toContain('path="matches/:id" element={<PermissionGuard permission="matches.view"><MatchDetailPage /></PermissionGuard>}')
    expect(app).not.toContain('LocalDataGuard')
  })

  it('loads the complete authorized cloud archive before applying filters, sorting and pagination', () => {
    expect(matches).toContain('getCloudMatches(activeGroup.id)')
    expect(matches).toContain('matchesMatchArchive')
    expect(matches).toContain('sortMatchArchive')
    expect(matches).toContain('paginateMatchArchive')
    expect(matches).toContain('const request = useRef(0), pageSize = 12')
    expect(matches).toContain('Pagina {archive.page} di {archive.pages}')
    expect(matches).toContain('CloudMatchEditor')
    expect(matches).not.toContain('getMatches')
    expect(repository).toContain('getCloudMatches(groupId: string')
  })

  it('provides cloud detail, cancellation and call-up operations with player profiles', () => {
    expect(detail).toContain('getCloudMatch(id, activeGroup.id)')
    expect(detail).toContain('cancelCloudMatch(match.id)')
    expect(detail).toContain('MatchCallupsPanel')
    expect(detail).not.toContain('getMatch(')
    for (const operation of ['getCloudMatchCallups', 'getCloudMatchCallupCandidates', 'addCloudMatchCallup', 'updateCloudMatchCallup', 'removeCloudMatchCallup']) expect(callups).toContain(operation)
    expect(callups).toContain('PlayerProfileModal')
    expect(callups).toContain('sourceGroupName')
    expect(callups).not.toContain('getMatches')
  })

  it('shows cloud matches alongside cloud training in calendar and dashboard without a local fallback', () => {
    for (const source of [calendar, dashboard]) {
      expect(source).toContain('getCloudMatches')
      expect(source).not.toContain('getMatches')
      expect(source).toContain('current !== request.current')
      expect(source).toContain('>Riprova</Button>')
    }
    expect(calendar).toContain('getCloudMatches(activeGroup.id, monthStart, monthEnd)')
    expect(calendar).toContain('matchDate')
    expect(calendar).toContain('startTime')
    expect(calendar).toContain('to: `/matches/${item.id}`')
    expect(dashboard).toContain('Prossima partita')
    expect(dashboard).toContain('to={`/matches/${nextMatch.id}`}')
  })
})
