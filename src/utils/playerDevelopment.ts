import type { Attendance, Match, MatchPlayerEvaluation, Observation, PlayerDevelopmentReview, PlayerObjective, PlayerObjectiveEvidence, PlayerRole, TrainingPlayerEvaluation, TrainingSession, VoiceNote } from '../types/domain'

export type DevelopmentTimelineKind = 'match' | 'training' | 'objective' | 'review' | 'observation'

export type DevelopmentTimelineItem = {
  id: string
  kind: DevelopmentTimelineKind
  date: string
  title: string
  subtitle?: string
  note?: string
  ratingLabel?: string
  roles?: PlayerRole[]
}

export function ratingLabel(value: number | null | undefined) {
  if (value === null || value === undefined) return undefined
  return `${String(value).replace('.', ',')} / 5`
}

export function averageRating(items: Array<{ rating: number | null }>) {
  const rated = items.filter((item) => item.rating !== null)
  if (rated.length === 0) return undefined
  return rated.reduce((sum, item) => sum + (item.rating ?? 0), 0) / rated.length
}

export function buildRoleHistory(matchEvaluations: MatchPlayerEvaluation[], trainingEvaluations: TrainingPlayerEvaluation[], reviews: PlayerDevelopmentReview[]) {
  const roles = new Map<PlayerRole, { role: PlayerRole; matches: number; trainings: number; reviews: number }>()
  const ensure = (role: PlayerRole) => {
    const current = roles.get(role) ?? { role, matches: 0, trainings: 0, reviews: 0 }
    roles.set(role, current)
    return current
  }
  matchEvaluations.forEach((evaluation) => evaluation.rolesPlayed.forEach((role) => { ensure(role).matches += 1 }))
  trainingEvaluations.forEach((evaluation) => evaluation.rolesTried.forEach((role) => { ensure(role).trainings += 1 }))
  reviews.forEach((review) => review.suggestedRoles.forEach((role) => { ensure(role).reviews += 1 }))
  return [...roles.values()].sort((a, b) => (b.matches + b.trainings + b.reviews) - (a.matches + a.trainings + a.reviews))
}

export function buildDevelopmentTimeline(input: {
  matches: Array<{ evaluation: MatchPlayerEvaluation; match: Match }>
  trainings: Array<{ evaluation: TrainingPlayerEvaluation; session: TrainingSession }>
  observations: Observation[]
  objectives: PlayerObjective[]
  evidence: PlayerObjectiveEvidence[]
  reviews: PlayerDevelopmentReview[]
  voiceNotes: VoiceNote[]
}): DevelopmentTimelineItem[] {
  const objectiveById = new Map(input.objectives.map((objective) => [objective.id, objective]))
  const items: DevelopmentTimelineItem[] = [
    ...input.matches.map(({ evaluation, match }) => ({
      id: `match:${evaluation.id}`,
      kind: 'match' as const,
      date: match.date,
      title: `Partita vs ${match.opponent}`,
      subtitle: match.competition,
      note: evaluation.note,
      ratingLabel: ratingLabel(evaluation.rating),
      roles: evaluation.rolesPlayed,
    })),
    ...input.trainings.map(({ evaluation, session }) => ({
      id: `training:${evaluation.id}`,
      kind: 'training' as const,
      date: session.date ?? evaluation.createdAt.slice(0, 10),
      title: session.title,
      subtitle: 'Allenamento',
      note: evaluation.note,
      ratingLabel: ratingLabel(evaluation.rating),
      roles: evaluation.rolesTried,
    })),
    ...input.observations.map((observation) => ({
      id: `observation:${observation.id}`,
      kind: 'observation' as const,
      date: observation.createdAt.slice(0, 10),
      title: observation.value === 'positive' ? 'Osservazione positiva' : 'Punto attenzione',
      subtitle: observation.category,
      note: observation.note,
    })),
    ...input.objectives.map((objective) => ({
      id: `objective:${objective.id}`,
      kind: 'objective' as const,
      date: objective.createdAt.slice(0, 10),
      title: objective.title,
      subtitle: `Obiettivo · ${objective.status}`,
      note: objective.description,
    })),
    ...input.evidence.map((item) => ({
      id: `evidence:${item.id}`,
      kind: 'objective' as const,
      date: item.date,
      title: objectiveById.get(item.objectiveId)?.title ?? 'Evidenza obiettivo',
      subtitle: `Evidenza · ${item.outcome}`,
      note: item.note,
    })),
    ...input.reviews.map((review) => ({
      id: `review:${review.id}`,
      kind: 'review' as const,
      date: review.date,
      title: 'Development review',
      subtitle: ratingLabel(review.overallRatingSnapshot),
      note: review.summary,
      roles: review.suggestedRoles,
    })),
    ...input.voiceNotes.map((voice) => ({
      id: `voice:${voice.id}`,
      kind: 'observation' as const,
      date: voice.createdAt.slice(0, 10),
      title: 'Nota vocale',
      subtitle: `${voice.durationSeconds}s`,
    })),
  ]
  return items.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
}

export function buildDevelopmentStats(input: {
  matchEvaluations: MatchPlayerEvaluation[]
  trainingEvaluations: TrainingPlayerEvaluation[]
  attendance: Attendance[]
  objectives: PlayerObjective[]
  reviews: PlayerDevelopmentReview[]
}) {
  const latestMatches = input.matchEvaluations.filter((item) => item.rating !== null).slice(0, 5)
  const latestTrainings = input.trainingEvaluations.filter((item) => item.rating !== null).slice(0, 5)
  const present = input.attendance.filter((item) => item.present).length
  return {
    lastFiveMatchAverage: averageRating(latestMatches),
    lastFiveTrainingAverage: averageRating(latestTrainings),
    present,
    attendanceTotal: input.attendance.length,
    activeObjectives: input.objectives.filter((objective) => objective.status === 'active').length,
    achievedObjectives: input.objectives.filter((objective) => objective.status === 'achieved').length,
    latestReview: input.reviews[0],
  }
}
