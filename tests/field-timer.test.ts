import { afterEach, describe, expect, it, vi } from 'vitest'
import { createFieldTimer, pauseFieldTimer, readFieldModeState, readFieldNoteDraft, resetFieldTimer, resumeFieldTimer, timerRemaining, writeFieldModeState, writeFieldNoteDraft } from '../src/utils/fieldTimer'

describe('field timer', () => {
  afterEach(() => vi.unstubAllGlobals())
  it.each([5, 15, 25, 45])('sets %i minutes as exact seconds', minutes => {
    expect(createFieldTimer(minutes)).toEqual({ durationSeconds: minutes * 60, remainingSeconds: minutes * 60 })
  })

  it('derives remaining time from timestamps instead of interval ticks', () => {
    const running = resumeFieldTimer(createFieldTimer(10), 1_000)
    expect(timerRemaining(running, 61_000)).toBe(540)
    expect(timerRemaining(running, 601_000)).toBe(0)
  })
  it('pauses, resumes and resets without drift', () => {
    const paused = pauseFieldTimer(resumeFieldTimer(createFieldTimer(2), 10_000), 55_000)
    expect(paused.remainingSeconds).toBe(75)
    expect(timerRemaining(resumeFieldTimer(paused, 80_000), 100_000)).toBe(55)
    expect(resetFieldTimer(paused)).toEqual({ durationSeconds: 120, remainingSeconds: 120 })
  })
  it('persists independent exercise timers and restores the selected exercise', () => {
    const values = new Map<string, string>()
    vi.stubGlobal('sessionStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) })
    const first = pauseFieldTimer(resumeFieldTimer(createFieldTimer(5), 1_000), 31_000)
    const second = createFieldTimer(15)
    writeFieldModeState('session', { exerciseIndex: 1, timer: second, exerciseTimers: { 0: first, 1: second } })
    expect(readFieldModeState('session', 2)).toEqual({ exerciseIndex: 1, timer: second, exerciseTimers: { 0: first, 1: second } })
  })
  it('recovers and clears an unsaved field-note draft', () => {
    const values = new Map<string, string>()
    vi.stubGlobal('sessionStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) })
    writeFieldNoteDraft('session', 'Nota rapida')
    expect(readFieldNoteDraft('session')).toBe('Nota rapida')
    writeFieldNoteDraft('session', '')
    expect(readFieldNoteDraft('session')).toBe('')
  })
})
