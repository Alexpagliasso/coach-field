import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { aggregateTrainingObjectiveTags } from '../src/cloud/trainingObjectiveTagsRepository'

const repository = readFileSync(new URL('../src/cloud/dashboardAnalyticsRepository.ts', import.meta.url), 'utf8')
const dashboard = readFileSync(new URL('../src/pages/GroupDashboardPage.tsx', import.meta.url), 'utf8')
const charts = readFileSync(new URL('../src/components/DashboardAnalytics.tsx', import.meta.url), 'utf8')
const tag = (id: string, name: string) => ({ id, organizationId: 'org', name, slug: name.toLowerCase(), createdAt: '2026-01-01', active: true as const })

describe('dashboard cloud analytics', () => {
  it('counts attendance only from explicit marks, never treating an unmarked player as absent', () => {
    expect(repository).toContain("item.marked += 1")
    expect(repository).toContain("if (mark.status === 'present') item.present += 1")
    expect(charts).toContain('item.marked ? Math.round(item.present / item.marked * 100) : null')
  })

  it('uses only scored completed matches and keeps unavailable call-ups separate', () => {
    expect(charts).toContain("item.status === 'completed' && item.ourScore != null && item.opponentScore != null")
    expect(repository).toContain("if (row.status === 'unavailable') item.unavailable += 1")
  })

  it('aggregates technical tags by association for the active WorkGroup period', () => {
    expect(aggregateTrainingObjectiveTags([{ sessionId: 'a', tag: tag('press', 'Pressing') }, { sessionId: 'b', tag: tag('press', 'Pressing') }, { sessionId: 'b', tag: tag('pass', 'Passaggio') }])).toEqual([{ ...tag('pass', 'Passaggio'), count: 1 }, { ...tag('press', 'Pressing'), count: 2 }].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)))
    expect(dashboard).toContain('getWorkGroupTrainingObjectiveTagAssociations(activeGroup.id')
    expect(charts).toContain('<PieChart>')
  })
})
