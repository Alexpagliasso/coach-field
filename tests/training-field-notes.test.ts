import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const repository = readFileSync(new URL('../src/cloud/trainingFieldNotesRepository.ts', import.meta.url), 'utf8')
const migration = readFileSync(new URL('../supabase/migrations/202610160021_training_session_field_notes.sql', import.meta.url), 'utf8')

describe('training field notes persistence contract', () => {
  it('scopes reads and writes to a training session and optional exercise position', () => {
    expect(repository).toContain("from('training_session_field_notes')")
    expect(repository).toContain("eq('training_session_id', trainingSessionId)")
    expect(repository).toContain('exercise_position: input.exercisePosition ?? null')
  })
  it('keeps organization and training permission checks in the database migration', () => {
    expect(migration).toContain('organization_id')
    expect(migration).toContain("private.has_training_permission(s.group_id, 'training.view')")
    expect(migration).toContain("private.has_training_permission(s.group_id, 'training.edit')")
  })
})
