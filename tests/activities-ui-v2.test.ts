import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const calendar = readFileSync('src/pages/CalendarPage.tsx', 'utf8')
const training = readFileSync('src/pages/TrainingPage.tsx', 'utf8')
const matches = readFileSync('src/pages/MatchesPage.tsx', 'utf8')

describe('GP-UX-03 activities presentation', () => {
  it('keeps calendar events isolated to the active WorkGroup and linked to existing details', () => {
    expect(calendar).toContain('getCloudTrainingSessionsInRange(activeGroup.id, monthStart, monthEnd)')
    expect(calendar).toContain('getCloudMatches(activeGroup.id, monthStart, monthEnd)')
    expect(calendar).toContain('to: `/training?session=${item.id}`')
    expect(calendar).toContain('to: `/matches/${item.id}`')
    expect(calendar).toContain("useState<'month' | 'agenda'>('month')")
    expect(calendar).toContain("['all', 'Tutti'], ['training', 'Allenamenti'], ['match', 'Partite']")
  })

  it('preserves training filters, actions and permission guards', () => {
    for (const value of ['TrainingArchiveStatus', 'TrainingArchiveSort', 'training-archive-controls', 'training-archive-list', "can('training.edit')", 'PermissionAction permission="training.edit"']) expect(training).toContain(value)
    for (const action of ['onEdit', 'onDuplicate', 'onComplete', 'TrainingAttendanceSheet', 'FieldModeExperience']) expect(training).toContain(action)
  })

  it('preserves match filters and provides direct contextual Live access', () => {
    expect(matches).toContain('getCloudMatches(activeGroup.id')
    expect(matches).toContain('matchesMatchArchive')
    expect(matches).toContain('sortMatchArchive')
    expect(matches).toContain('PermissionAction permission="matches.create"')
    expect(matches).toContain('`/matches/${match.id}?tab=live`')
    expect(matches).toContain("match.status === 'live'")
  })
})
