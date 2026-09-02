export type PlayerRating =
  | 0.5
  | 1
  | 1.5
  | 2
  | 2.5
  | 3
  | 3.5
  | 4
  | 4.5
  | 5
  | null

export type PlayerRole = 'POR' | 'DIF' | 'CEN' | 'ATT' | 'JOLLY'
export type PlayerYear = 2016 | 2017 | 'other'
export type PlayerStatus = 'roster' | 'guest'
export type MatchType = 'league' | 'tournament' | 'friendly' | 'other'
export type HomeAway = 'home' | 'away' | 'neutral'
export type MatchStatus = 'planned' | 'completed'
export type TrainingSessionStatus = 'planned' | 'in_progress' | 'completed'
export type TrainingPhaseStatus = 'planned' | 'completed' | 'skipped' | 'modified'
export type PlayerObjectiveStatus = 'active' | 'achieved' | 'paused' | 'archived'
export type PlayerObjectiveCategory = 'technical' | 'tactical' | 'physical' | 'mental' | 'relational' | 'goalkeeper' | 'other'
export type PlayerObjectivePriority = 'low' | 'medium' | 'high'
export type PlayerObjectiveEvidenceOutcome = 'positive' | 'mixed' | 'attention'

export type Player = {
  id: string
  firstName: string
  lastName: string
  year: PlayerYear
  previousRoles: string[]
  rating: PlayerRating
  idealRoles: PlayerRole[]
  goalkeeperCandidate: boolean
  status?: PlayerStatus
}

export type ObservationCategory =
  | 'technique'
  | 'game'
  | 'attitude'
  | 'relationship'
  | 'goalkeeper'

export type Observation = {
  id: string
  playerId: string
  sessionId: string
  phaseId?: string
  category: ObservationCategory
  value: 'positive' | 'attention'
  note?: string
  createdAt: string
}

export type VoiceNote = {
  id: string
  playerId?: string
  sessionId: string
  phaseId?: string
  exerciseId?: string
  matchId?: string
  createdAt: string
  durationSeconds: number
  mimeType: string
  audio: Blob
}

export type Match = {
  id: string
  date: string
  opponent: string
  competition?: string
  matchType: MatchType
  homeAway: HomeAway
  location?: string
  goalsFor?: number
  goalsAgainst?: number
  teamRating?: PlayerRating
  teamNotes?: string
  trainingTakeaways?: string
  status: MatchStatus
  createdAt: string
  updatedAt: string
}

export type MatchPlayerEvaluation = {
  id: string
  matchId: string
  playerId: string
  selected: boolean
  present: boolean
  starter?: boolean
  rolesPlayed: PlayerRole[]
  rating: PlayerRating
  note?: string
  positiveTags?: string[]
  attentionTags?: string[]
  createdAt: string
  updatedAt: string
}

export type FieldExercise = {
  id: string
  field: 1 | 2 | 3
  title: string
  format: string
  focus: string
  durationMinutes?: number
  players?: number
  dimensions?: string
  equipment?: string[]
  objective?: string[]
  specialRule?: {
    title: string
    description: string
    why?: string
  }
  setup: string[]
  instructions: string[]
  rules?: string[]
  variation?: {
    title: string
    description: string
    purpose?: string
  }
  observe: Array<{
    title: string
    items: string[]
  }>
  coachQuestions: string[]
  positiveSignals: string[]
  attentionSignals: string[]
}

export type TrainingExerciseSnapshot = {
  title: string
  focus?: string
  format?: string
  dimensions?: string
  setup?: string[]
  instructions?: string[]
  rules?: string[]
  coachQuestions?: string[]
}

export type SessionPhase = {
  id: string
  title: string
  startMinute: number
  endMinute: number
  description?: string[]
  sequence?: string[]
  objective?: string
  observe?: string[]
  fields?: FieldExercise[]
  sections?: Array<{ title: string; items: string[] }>
  questions?: string[]
}

export type TrainingSession = {
  id: string
  date?: string
  startTime?: string
  title: string
  templateId?: string
  durationMinutes: number
  status?: TrainingSessionStatus
  phases: SessionPhase[]
  plannedPhases?: TrainingSessionPhase[]
  generalNotes?: string
  takeaways?: string
  createdAt?: string
  updatedAt?: string
}

export type TrainingTemplatePhase = {
  id: string
  title: string
  durationMinutes: number
  exerciseId?: string
  exerciseSnapshot?: TrainingExerciseSnapshot
  notes?: string
  order: number
}

export type TrainingTemplate = {
  id: string
  title: string
  description?: string
  ageGroup?: string
  expectedDurationMinutes: number
  minPlayers?: number
  maxPlayers?: number
  tags: string[]
  phases: TrainingTemplatePhase[]
  createdAt: string
  updatedAt: string
}

export type TrainingSessionPhase = {
  id: string
  title: string
  order: number
  plannedDurationMinutes?: number
  actualDurationMinutes?: number
  exerciseId?: string
  exerciseSnapshot?: TrainingExerciseSnapshot
  status: TrainingPhaseStatus
  coachRating?: PlayerRating
  coachNotes?: string
  variationUsed?: string
}

export type TrainingPlayerEvaluation = {
  id: string
  sessionId: string
  playerId: string
  rating: PlayerRating
  rolesTried: PlayerRole[]
  note?: string
  positiveTags?: string[]
  attentionTags?: string[]
  createdAt: string
  updatedAt: string
}

export type PlayerObjective = {
  id: string
  playerId: string
  title: string
  description?: string
  category: PlayerObjectiveCategory
  priority: PlayerObjectivePriority
  status: PlayerObjectiveStatus
  createdAt: string
  updatedAt: string
  achievedAt?: string
  sourceMatchId?: string
  sourceTrainingSessionId?: string
  notes?: string
}

export type PlayerObjectiveEvidence = {
  id: string
  objectiveId: string
  playerId: string
  date: string
  outcome: PlayerObjectiveEvidenceOutcome
  note?: string
  matchId?: string
  trainingSessionId?: string
  createdAt: string
}

export type PlayerDevelopmentReview = {
  id: string
  playerId: string
  date: string
  overallRatingSnapshot?: PlayerRating
  strengths: string[]
  developmentAreas: string[]
  suggestedRoles: PlayerRole[]
  summary?: string
  createdAt: string
  updatedAt: string
}

export type TimerState = {
  phaseId: string
  status: 'idle' | 'running' | 'paused' | 'finished'
  startedAt?: string
  elapsedBeforeSeconds: number
}

export type AppState = {
  id: 'current'
  sessionId: string
  currentPhaseId: string
  timer: TimerState
}

export type AppMetaState = {
  id: 'playerSeedVersion'
  key: 'playerSeedVersion'
  value: number
}

export type Attendance = {
  id: string
  sessionId: string
  playerId: string
  present: boolean
}
