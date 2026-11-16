import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const dashboard = readFileSync('src/pages/GroupDashboardPage.tsx', 'utf8')
const charts = readFileSync('src/components/DashboardAnalytics.tsx', 'utf8')
const css = readFileSync('src/index.css', 'utf8')

describe('GP-UX-02 WorkGroup dashboard', () => {
  it('scopes every read and the family preview to the active WorkGroup', () => {
    for (const read of ['getCloudTrainingSessions(activeGroup.id)', 'getCloudMatches(activeGroup.id)', 'getWorkGroupRoster(activeGroup.id)', 'getDashboardAttendanceTrend(activeGroup.id)', '<FamilyBoardPreview groupId={activeGroup.id}']) expect(dashboard).toContain(read)
  })

  it('links primary and upcoming activities to their existing details', () => {
    expect(dashboard).toContain("item.type === 'training' ? `/training?session=${item.id}` : `/matches/${item.id}`")
    expect(dashboard).toContain("to={nextActivity ? destination(nextActivity) : '/training'}")
    expect(dashboard).toContain('to={destination(item)}')
    expect(dashboard).toContain('upcoming.slice(0, 4)')
  })

  it('shows honest empty states for both real-data charts', () => {
    expect(charts).toContain('Nessuna seduta completata nel WorkGroup.')
    expect(charts).toContain('Le sedute completate non hanno ancora un registro presenze compilato.')
    expect(charts).toContain('Nessun risultato concluso con punteggio disponibile.')
    expect(charts).toContain("item.status === 'completed' && item.ourScore != null && item.opponentScore != null")
  })

  it('uses semantic tokens and a responsive non-uniform grid', () => {
    expect(charts).toContain('fill="var(--chart-1)"')
    expect(charts).toContain('fill="var(--chart-4)"')
    expect(css).toContain('.dashboard-v8-next { grid-column:span 8;')
    expect(css).toContain('.dashboard-v8-kpis { grid-column:span 4;')
    expect(css).toContain('.dashboard-v8-upcoming { grid-column:span 7;')
    expect(css).toContain('.dashboard-v7-family-board { grid-column:span 5;')
  })
})
