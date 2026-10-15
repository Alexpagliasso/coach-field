import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { collectPagedSessions } from '../src/utils/cloudPagination'

const calendar = readFileSync(new URL('../src/pages/CalendarPage.tsx', import.meta.url), 'utf8')
const dashboard = readFileSync(new URL('../src/pages/GroupDashboardPage.tsx', import.meta.url), 'utf8')
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')

describe('cloud dashboard and calendar flow', () => {
  it('loads every server-side calendar page, including a month with more than ten sessions', async () => {
    const requested: number[] = []
    const sessions = await collectPagedSessions(async page => {
      requested.push(page)
      return page === 1
        ? { total: 205, sessions: Array.from({ length: 100 }, (_, index) => ({ id: index })) }
        : { total: 205, sessions: Array.from({ length: page === 2 ? 100 : 5 }, (_, index) => ({ id: page * 100 + index })) }
    })
    expect(requested).toEqual([1, 2, 3])
    expect(sessions).toHaveLength(205)
  })

  it('routes to the actual dashboard and calendar components', () => {
    expect(app).toContain('path="dashboard" element={<PermissionGuard permission="training.view"><GroupDashboardPage /></PermissionGuard>}')
    expect(app).toContain('path="calendar" element={<PermissionGuard permission="training.view"><CalendarPage /></PermissionGuard>}')
  })

  it('uses Supabase-only sources for training and match widgets', () => {
    expect(dashboard).toContain('getCloudTrainingSessions(activeGroup.id)')
    expect(dashboard).toContain('getCloudTrainingSessionCounts(activeGroup.id, today)')
    expect(dashboard).not.toContain('getCurrentSession')
    expect(dashboard).not.toContain('getAppState')
    expect(dashboard).toContain('getWorkGroupRoster(activeGroup.id)')
    expect(dashboard).toContain('getCloudMatches(activeGroup.id)')
    expect(dashboard).not.toContain('getMatches')
    expect(dashboard).toContain('Rosa WorkGroup')
    expect(calendar).toContain('getCloudTrainingSessionsInRange(activeGroup.id, monthStart, monthEnd)')
    expect(calendar).toContain('getCloudMatches(activeGroup.id, monthStart, monthEnd)')
    expect(calendar).not.toContain('getMatches')
    expect(calendar).not.toContain('getCurrentSession')
    expect(calendar).not.toContain('getAppState')
  })

  it('keeps completed training in the calendar, scopes cloud queries by group and month, and opens the cloud deep-link', () => {
    expect(calendar).toContain('monthStart, monthEnd')
    expect(calendar).toContain('to: `/training?session=${item.id}`')
    expect(calendar).toContain('to: `/matches/${item.id}`')
    expect(calendar).not.toContain("status !== 'completed'")
    expect(calendar).toContain('setSessions([]); setMatches([])')
  })

  it('exposes query failures and development diagnostics without a local-training fallback', () => {
    for (const source of [calendar, dashboard]) {
      expect(source).toContain('debugTraining')
      expect(source).toContain('data-testid="training-debug"')
      expect(source).toContain('>Riprova</Button>')
      expect(source).toContain('current !== request.current')
    }
  })

  it('organizes the authenticated cloud data as an analytical bento dashboard without duplicate navigation', () => {
    for (const label of ['Cabina di regia', 'Prossima attività', 'Presenze alle ultime sedute', 'Risultati recenti', 'Convocazioni', 'Riepilogo gruppo']) expect(dashboard).toContain(label)
    expect(dashboard).not.toContain('Azioni rapide')
    expect(dashboard).not.toContain('Prossimi impegni')
    expect(dashboard).toContain('DashboardPanel')
    expect(dashboard).toContain('DashboardStatTile')
    expect(dashboard).toContain('TacticalBackdrop')
    expect(dashboard).toContain('getDashboardAttendanceTrend')
    expect(dashboard).toContain('getDashboardCallupDistribution')
    expect(dashboard).toContain("item.status === 'completed'")
    expect(dashboard).toContain("item.matchDate >= today")
  })
})
