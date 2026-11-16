export type FieldTimer = { durationSeconds: number; remainingSeconds: number; startedAt?: number }

export function createFieldTimer(durationMinutes: number): FieldTimer { const durationSeconds = Math.max(1, Math.round(durationMinutes * 60)); return { durationSeconds, remainingSeconds: durationSeconds } }
export function timerRemaining(timer: FieldTimer, now = Date.now()) { return timer.startedAt ? Math.max(0, timer.remainingSeconds - Math.floor((now - timer.startedAt) / 1000)) : timer.remainingSeconds }
export function pauseFieldTimer(timer: FieldTimer, now = Date.now()): FieldTimer { return { ...timer, remainingSeconds: timerRemaining(timer, now), startedAt: undefined } }
export function resumeFieldTimer(timer: FieldTimer, now = Date.now()): FieldTimer { const remainingSeconds = timerRemaining(timer, now); return remainingSeconds > 0 ? { ...timer, remainingSeconds, startedAt: now } : { ...timer, remainingSeconds: 0, startedAt: undefined } }
export function resetFieldTimer(timer: FieldTimer): FieldTimer { return { durationSeconds: timer.durationSeconds, remainingSeconds: timer.durationSeconds } }
export function resizeFieldTimer(timer: FieldTimer, durationMinutes: number, now = Date.now()): FieldTimer {
  const durationSeconds = Math.max(60, Math.round(durationMinutes * 60))
  const elapsedSeconds = Math.max(0, timer.durationSeconds - timerRemaining(timer, now))
  const remainingSeconds = Math.max(0, durationSeconds - elapsedSeconds)
  return { durationSeconds, remainingSeconds, startedAt: timer.startedAt && remainingSeconds > 0 ? now : undefined }
}

export type PersistedFieldMode = { exerciseIndex: number; timer: FieldTimer; exerciseTimers?: Record<number, FieldTimer> }

export function readFieldModeState(sessionId: string, exerciseCount: number): PersistedFieldMode | undefined {
  try {
    const raw = sessionStorage.getItem(`growpitch:field-mode:${sessionId}`)
    if (!raw) return undefined
    const value = JSON.parse(raw) as PersistedFieldMode
    if (!Number.isInteger(value.exerciseIndex) || value.exerciseIndex < 0 || value.exerciseIndex >= exerciseCount) return undefined
    if (!Number.isFinite(value.timer?.durationSeconds) || !Number.isFinite(value.timer?.remainingSeconds)) return undefined
    const normalize = (timer: FieldTimer): FieldTimer => ({ ...timer, durationSeconds: Math.max(1, timer.durationSeconds), remainingSeconds: Math.max(0, timer.remainingSeconds) })
    const exerciseTimers = Object.fromEntries(Object.entries(value.exerciseTimers ?? {}).filter(([key, timer]) => Number(key) >= 0 && Number(key) < exerciseCount && Number.isFinite(timer?.durationSeconds) && Number.isFinite(timer?.remainingSeconds)).map(([key, timer]) => [Number(key), normalize(timer)]))
    return { exerciseIndex: value.exerciseIndex, timer: normalize(value.timer), exerciseTimers }
  } catch { return undefined }
}

export function writeFieldModeState(sessionId: string, value: PersistedFieldMode) {
  try { sessionStorage.setItem(`growpitch:field-mode:${sessionId}`, JSON.stringify(value)) } catch { /* Storage limits must not block Field Mode. */ }
}

export function readFieldNoteDraft(sessionId: string) {
  try { return sessionStorage.getItem(`growpitch:field-note-draft:${sessionId}`) ?? '' } catch { return '' }
}

export function writeFieldNoteDraft(sessionId: string, value: string) {
  try { const key = `growpitch:field-note-draft:${sessionId}`; if (value) sessionStorage.setItem(key, value); else sessionStorage.removeItem(key) } catch { /* Draft recovery must not block Field Mode. */ }
}
