import type { FieldExercise, SessionPhase, TrainingExerciseSnapshot, TrainingSession, TrainingSessionPhase, TrainingTemplate, TrainingTemplatePhase } from '../types/domain'

export function snapshotExercise(exercise?: FieldExercise): TrainingExerciseSnapshot | undefined {
  if (!exercise) return undefined
  return {
    title: exercise.title || exercise.format,
    focus: exercise.focus,
    format: exercise.format,
    dimensions: exercise.dimensions,
    setup: exercise.setup ?? [],
    instructions: exercise.instructions ?? [],
    rules: exercise.rules ?? [],
    coachQuestions: exercise.coachQuestions ?? [],
  }
}

export function phaseDuration(phase: SessionPhase) {
  return Math.max(0, phase.endMinute - phase.startMinute)
}

export function legacyPhaseToSessionPhase(phase: SessionPhase, order: number): TrainingSessionPhase {
  const exercise = phase.fields?.[0]
  return {
    id: phase.id,
    title: phase.title,
    order,
    plannedDurationMinutes: phaseDuration(phase),
    actualDurationMinutes: undefined,
    exerciseId: exercise?.id,
    exerciseSnapshot: snapshotExercise(exercise),
    status: 'planned',
  }
}

export function legacySessionToPlannedPhases(session: TrainingSession): TrainingSessionPhase[] {
  if (session.plannedPhases?.length) {
    return [...session.plannedPhases].sort((a, b) => a.order - b.order)
  }
  return (session.phases ?? []).map((phase, index) => legacyPhaseToSessionPhase(phase, index + 1))
}

export function templatePhaseToSessionPhase(phase: TrainingTemplatePhase): TrainingSessionPhase {
  return {
    id: phase.id,
    title: phase.title,
    order: phase.order,
    plannedDurationMinutes: phase.durationMinutes,
    exerciseId: phase.exerciseId,
    exerciseSnapshot: phase.exerciseSnapshot,
    status: 'planned',
    coachNotes: phase.notes,
  }
}

export function templateToSessionPhases(template: TrainingTemplate) {
  return template.phases
    .map(templatePhaseToSessionPhase)
    .sort((a, b) => a.order - b.order)
}

export function sessionDateLabel(date?: string) {
  if (!date) return 'Data da definire'
  return new Intl.DateTimeFormat('it-IT', {
    day: '2-digit',
    month: 'short',
  }).format(new Date(`${date}T12:00:00`))
}

export function isToday(date?: string) {
  if (!date) return false
  return date === new Date().toISOString().slice(0, 10)
}
