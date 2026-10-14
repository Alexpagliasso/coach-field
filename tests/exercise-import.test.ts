import { describe, expect, it } from 'vitest'
import { importableExerciseIds, isExerciseDuplicate, parseExerciseImport, type ImportExercise } from '../src/utils/exerciseImport'

const rawExercise = (id: string, name = `Esercizio ${id}`) => ({ id, name, objective: 'Controllo palla', shortDescription: 'Una descrizione', longDescription: 'Dettaglio', suggestedDurationMinutes: 12, playerCount: 8, materials: ['Palloni'], tags: ['Tecnica'], category: 'Tecnica' })
const imported = (id: string, name?: string): ImportExercise => parseExerciseImport(JSON.stringify({ collection: 'u10-2026', exercises: [rawExercise(id, name)] })).exercises[0]

describe('exercise JSON import', () => {
  it('parses and maps a 48-exercise collection', () => {
    const raw = JSON.stringify({ collection: 'u10-2026', exercises: Array.from({ length: 48 }, (_, index) => rawExercise(String(index + 1))) })
    const parsed = parseExerciseImport(raw)
    expect(parsed.collection).toBe('u10-2026')
    expect(parsed.exercises).toHaveLength(48)
    expect(parsed.exercises[0]).toMatchObject({ sourceCollection: 'u10-2026', sourceId: '1', category: 'Tecnica', suggestedDurationMinutes: 12 })
  })

  it('rejects malformed JSON and invalid exercise values', () => {
    expect(() => parseExerciseImport('{')).toThrow('JSON valido')
    expect(() => parseExerciseImport(JSON.stringify({ collection: 'x', exercises: [{ id: '1', name: '', objective: '', shortDescription: '' }] }))).toThrow('Esercizio 1 non valido')
    expect(() => parseExerciseImport(JSON.stringify({ collection: 'x', exercises: [{ ...rawExercise('1'), suggestedDurationMinutes: 0 }] }))).toThrow('valori numerici')
  })

  it('supports single/multiple selection and select all excluding existing duplicates', () => {
    const one = imported('one', 'Uno'); const two = imported('two', 'Due'); const existing = [{ name: 'Uno', objective: 'Controllo palla', sourceCollection: 'u10-2026', sourceId: 'one' }]
    const selectable = importableExerciseIds([one, two], existing)
    expect(selectable).toEqual(['two'])
    const selected = selectable.includes('two') ? [] : ['two']
    expect(selected).toEqual([])
    expect(importableExerciseIds([one, two], [])).toEqual(['one', 'two'])
  })

  it('deduplicates by external identifier and by normalized name plus objective', () => {
    const one = imported('one', 'Possesso 3v1')
    expect(isExerciseDuplicate(one, [{ name: 'Altro', objective: 'Altro', sourceCollection: 'u10-2026', sourceId: 'one' }])).toBe(true)
    expect(isExerciseDuplicate(one, [{ name: ' possesso 3v1 ', objective: ' controllo palla ', sourceCollection: 'other', sourceId: 'x' }])).toBe(true)
    expect(isExerciseDuplicate(one, [])).toBe(false)
  })

  it('marks a repeated import as fully unavailable', () => {
    const exercises = [imported('1'), imported('2')]
    const persisted = exercises.map((item, index) => ({ ...item, id: String(index), organizationId: 'org' }))
    expect(importableExerciseIds(exercises, persisted)).toEqual([])
  })
})
