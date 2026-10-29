import { describe, expect, it } from 'vitest'
import { exportExercisesJson, exportSessionsJson, hasTrainingJsonErrors, parseTrainingJson } from '../src/utils/growpitchTrainingJson'

const exercise = { id: 'db-id', organizationId: 'org', name: 'Rondo 4v1', objective: 'Possesso', shortDescription: 'Mantieni palla.', detailedDescription: 'Quattro fuori.', suggestedDurationMinutes: 12, suggestedPlayerCount: 5, materials: ['Palloni'], tags: ['possesso'], category: 'possession-collaboration', sourceCollection: null, sourceId: null }

describe('growpitch-training/v1', () => {
  it('roundtrips every supported exercise field without persistent ids', () => {
    const exported = exportExercisesJson([exercise])
    const preview = parseTrainingJson(JSON.stringify(exported))
    expect(hasTrainingJsonErrors(preview)).toBe(false)
    expect(preview.document.exercises?.[0]).toMatchObject({ ref: 'exercise-1', name: exercise.name, detailedDescription: exercise.detailedDescription, materials: exercise.materials, category: exercise.category })
    expect(JSON.stringify(exported)).not.toContain('db-id')
    expect(JSON.stringify(exported)).not.toContain('organizationId')
  })

  it('preserves session snapshots and explicit existing references', () => {
    const document = exportSessionsJson([{ id: 'session-id', organizationId: 'org', groupId: 'group', sessionDate: '2026-10-29', title: 'Seduta', objective: 'Passaggio', plannedDurationMinutes: 60, coachNotes: 'Nota', status: 'planned', isHidden: false, exercises: [{ id: 'row-id', exerciseId: 'existing-id', position: 0, snapshotName: 'Rondo', snapshotObjective: 'Possesso', snapshotDescription: 'Regole', durationMinutes: 15, coachNotes: 'Correggi' }] }])
    const preview = parseTrainingJson(JSON.stringify(document))
    expect(hasTrainingJsonErrors(preview)).toBe(false)
    expect(preview.document.sessions?.[0].exercises[0]).toEqual({ existingExerciseId: 'existing-id', snapshotName: 'Rondo', snapshotObjective: 'Possesso', snapshotDescription: 'Regole', durationMinutes: 15, coachNotes: 'Correggi' })
    expect(JSON.stringify(document)).not.toContain('session-id')
  })

  it('reports paths for unknown fields, duplicate refs, broken refs and unsafe content', () => {
    const preview = parseTrainingJson(JSON.stringify({ format: 'growpitch-training/v1', mode: 'bundle', extra: true, exercises: [{ ref: 'x', name: '<script>alert(1)</script>', objective: '', shortDescription: '' }, { ref: 'x', name: 'Due', objective: '', shortDescription: '' }], sessions: [{ ref: 's', kind: 'planned', date: '2026-10-29', title: 'Seduta', objective: '', durationMinutes: 60, exercises: [{ exerciseRef: 'missing', snapshotName: 'X', snapshotObjective: '', snapshotDescription: '', durationMinutes: 10 }] }] }))
    expect(hasTrainingJsonErrors(preview)).toBe(true)
    expect(preview.issues.map(issue => issue.path)).toEqual(expect.arrayContaining(['$.extra', '$.exercises[0].name', '$.exercises[1].ref', '$.sessions[0].exercises[0].exerciseRef']))
  })

  it('rejects malformed and oversized input', () => {
    expect(() => parseTrainingJson('{')).toThrow('JSON valido')
    expect(() => parseTrainingJson(' '.repeat(1_000_001))).toThrow('1 MB')
  })
})
