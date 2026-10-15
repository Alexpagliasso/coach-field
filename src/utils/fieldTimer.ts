export type FieldTimer = { durationSeconds: number; remainingSeconds: number; startedAt?: number }

export function createFieldTimer(durationMinutes: number): FieldTimer { const durationSeconds = Math.max(1, Math.round(durationMinutes * 60)); return { durationSeconds, remainingSeconds: durationSeconds } }
export function timerRemaining(timer: FieldTimer, now = Date.now()) { return timer.startedAt ? Math.max(0, timer.remainingSeconds - Math.floor((now - timer.startedAt) / 1000)) : timer.remainingSeconds }
export function pauseFieldTimer(timer: FieldTimer, now = Date.now()): FieldTimer { return { ...timer, remainingSeconds: timerRemaining(timer, now), startedAt: undefined } }
export function resumeFieldTimer(timer: FieldTimer, now = Date.now()): FieldTimer { const remainingSeconds = timerRemaining(timer, now); return remainingSeconds > 0 ? { ...timer, remainingSeconds, startedAt: now } : { ...timer, remainingSeconds: 0, startedAt: undefined } }
export function resetFieldTimer(timer: FieldTimer): FieldTimer { return { durationSeconds: timer.durationSeconds, remainingSeconds: timer.durationSeconds } }
