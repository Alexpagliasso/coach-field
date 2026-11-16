import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const fieldMode = readFileSync('src/components/FieldModeExperience.tsx', 'utf8')
const notes = readFileSync('src/cloud/trainingFieldNotesRepository.ts', 'utf8')

describe('GP-UX-05 Field Mode', () => {
  it('keeps WorkGroup context, exercise progress and timestamp timers', () => {
    expect(fieldMode).toContain("data.groups.find(group => group.id === session.groupId)")
    expect(fieldMode).toContain('Esercizio {index + 1} di {exercises.length}')
    expect(fieldMode).toContain('timerRemaining(timer)')
    expect(fieldMode).toContain('pauseFieldTimer(current)')
    expect(fieldMode).toContain('exerciseTimers')
  })
  it('protects drafts and distinguishes exercise from general session notes', () => {
    expect(fieldMode).toContain('readFieldNoteDraft(session.id)')
    expect(fieldMode).toContain('writeFieldNoteDraft(session.id, draft)')
    expect(fieldMode).toContain("noteScope === 'exercise'")
    expect(fieldMode).toContain('Seduta generale')
    expect(notes).toContain('exercise_position: input.exercisePosition ?? null')
  })
  it('preserves permissions and avoids imaginary media', () => {
    expect(fieldMode).toContain("can('training.edit')")
    expect(fieldMode).toContain('disabled={isDemoViewer}')
    expect(fieldMode).not.toContain('<img')
    expect(fieldMode).not.toContain('setInterval(() => setTimer')
  })
})
