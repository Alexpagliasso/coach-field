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
  createdAt: string
  durationSeconds: number
  mimeType: string
  audio: Blob
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
  title: string
  durationMinutes: number
  phases: SessionPhase[]
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
