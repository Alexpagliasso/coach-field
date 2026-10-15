import { describe, expect, it } from 'vitest'
import type { ExerciseLibraryItem } from '../src/cloud/trainingCloudRepository'
import { u10Import } from '../src/data/u10TrainingImport'
import { planImportedExercises } from '../src/utils/trainingImportPlan'

const item = (name: string, overrides: Partial<ExerciseLibraryItem> = {}): ExerciseLibraryItem => ({ id: name, organizationId: 'org', name, objective: '', shortDescription: '', materials: [], tags: [], ...overrides })

describe('U10 authenticated import plan', () => {
  it('reuses only an exact normalized name or a prior import source key', () => {
    const planned = planImportedExercises([u10Import.advanced[0]], [item('RONDO 4V1')], u10Import.sourceCollection)
    expect(planned[0].existing?.id).toBe('RONDO 4V1')
    const fromPriorImport = planImportedExercises([u10Import.advanced[1]], [item('Altro nome', { sourceCollection: u10Import.sourceCollection, sourceId: 'advanced-due-contro-uno' })], u10Import.sourceCollection)
    expect(fromPriorImport[0].existing?.name).toBe('Altro nome')
  })

  it('flags similar names as possible duplicates without automatically reusing them', () => {
    const planned = planImportedExercises([u10Import.base[3]], [item('Partitella guidata 4v4')], u10Import.sourceCollection)
    expect(planned[0].existing).toBeUndefined()
    expect(planned[0].possibleDuplicates.map(candidate => candidate.name)).toEqual(['Partitella guidata 4v4'])
  })

  it('preserves the four advanced exercises and the complete 80-minute sequence', () => {
    expect(u10Import.advanced.map(exercise => exercise.name)).toEqual(['Rondo 4v1', 'Due contro uno', 'Tre contro due alternato', 'Conclusioni alla porta A9'])
    expect(u10Import.advanced.reduce((total, exercise) => total + exercise.durationMinutes, 0)).toBe(80)
    expect(u10Import.advanced[2].detailedDescription).toContain('10 azioni')
  })
})
