import { describe, expect, it } from 'vitest'
import { createFieldTimer, pauseFieldTimer, resetFieldTimer, resumeFieldTimer, timerRemaining } from '../src/utils/fieldTimer'

describe('field timer', () => {
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
})
