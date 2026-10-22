export type FieldTimer = { durationSeconds: number; remainingSeconds: number; startedAt?: number }

export function createFieldTimer(durationMinutes: number): FieldTimer { const durationSeconds = Math.max(1, Math.round(durationMinutes * 60)); return { durationSeconds, remainingSeconds: durationSeconds } }
export function timerRemaining(timer: FieldTimer, now = Date.now()) { return timer.startedAt ? Math.max(0, timer.remainingSeconds - Math.floor((now - timer.startedAt) / 1000)) : timer.remainingSeconds }
export function pauseFieldTimer(timer: FieldTimer, now = Date.now()): FieldTimer { return { ...timer, remainingSeconds: timerRemaining(timer, now), startedAt: undefined } }
export function resumeFieldTimer(timer: FieldTimer, now = Date.now()): FieldTimer { const remainingSeconds = timerRemaining(timer, now); return remainingSeconds > 0 ? { ...timer, remainingSeconds, startedAt: now } : { ...timer, remainingSeconds: 0, startedAt: undefined } }
export function resetFieldTimer(timer: FieldTimer): FieldTimer { return { durationSeconds: timer.durationSeconds, remainingSeconds: timer.durationSeconds } }

export type PersistedFieldMode = { exerciseIndex: number; timer: FieldTimer }

export function readFieldModeState(sessionId: string, exerciseCount: number): PersistedFieldMode | undefined {
  try {
    const raw = sessionStorage.getItem(`growpitch:field-mode:${sessionId}`)
    if (!raw) return undefined
    const value = JSON.parse(raw) as PersistedFieldMode
    if (!Number.isInteger(value.exerciseIndex) || value.exerciseIndex < 0 || value.exerciseIndex >= exerciseCount) return undefined
    if (!Number.isFinite(value.timer?.durationSeconds) || !Number.isFinite(value.timer?.remainingSeconds)) return undefined
    return { exerciseIndex: value.exerciseIndex, timer: { ...value.timer, durationSeconds: Math.max(1, value.timer.durationSeconds), remainingSeconds: Math.max(0, value.timer.remainingSeconds) } }
  } catch { return undefined }
}

export function writeFieldModeState(sessionId: string, value: PersistedFieldMode) {
  try { sessionStorage.setItem(`growpitch:field-mode:${sessionId}`, JSON.stringify(value)) } catch { /* Storage limits must not block Field Mode. */ }
}
