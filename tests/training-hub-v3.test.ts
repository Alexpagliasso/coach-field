import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { CloudTrainingSession } from '../src/cloud/trainingCloudRepository'
import { matchesTrainingArchive, normalizeTrainingText, paginateTrainingArchive, sortTrainingArchive } from '../src/utils/trainingArchive'

const session = (id: string, patch: Partial<CloudTrainingSession> = {}): CloudTrainingSession => ({
  id, organizationId: 'org', groupId: 'group', sessionDate: '2026-10-15', startTime: '18:00', title: 'Possesso', objective: 'Uscita dalla pressione', plannedDurationMinutes: 75, coachNotes: '', status: 'planned',
  exercises: [{ id: `ex-${id}`, position: 1, snapshotName: 'Passàggio orientato', snapshotObjective: 'Scansione', snapshotDescription: 'Ricevi e passa', durationMinutes: 12, coachNotes: '' }], ...patch,
})

describe('Training Hub V3 archive', () => {
  const sessions = [session('a', { sessionDate: '2026-09-10', title: 'Finalizzazione', status: 'completed' }), session('b'), session('c', { sessionDate: '2026-10-22', title: 'Pressione alta' })]

  it('normalizes accents and searches cloud exercise snapshots over the full archive', () => {
    expect(normalizeTrainingText('  Passàggio ')).toBe('passaggio')
    expect(matchesTrainingArchive(sessions[1], { query: 'passaggio', today: '2026-10-14' })).toBe(true)
    expect(matchesTrainingArchive(sessions[1], { theme: 'pressione', today: '2026-10-14' })).toBe(true)
  })

  it('applies status/date filtering before stable ordering and page slicing', () => {
    const filtered = sessions.filter(item => matchesTrainingArchive(item, { status: 'planned', from: '2026-10-01', today: '2026-10-14' }))
    expect(sortTrainingArchive(filtered, 'upcoming', '2026-10-14').map(item => item.id)).toEqual(['b', 'c'])
    expect(paginateTrainingArchive(filtered, 1, 1)).toEqual({ total: 2, sessions: [sessions[1]] })
  })

  it('uses a real detail route and a full-page builder rather than the archive split pane', () => {
    const page = readFileSync('src/pages/TrainingPage.tsx', 'utf8')
    const app = readFileSync('src/App.tsx', 'utf8')
    expect(page).toContain('getCloudTrainingArchive(')
    expect(page).toContain('className="training-next-session"')
    expect(page).toContain('function TrainingSessionDetail')
    expect(page).toContain('className="page training-builder-workspace"')
    expect(page).not.toContain('training-hub-grid')
    expect(app).toContain('path="training/:id" element={<PermissionGuard permission="training.view"><TrainingPage')
  })
})
