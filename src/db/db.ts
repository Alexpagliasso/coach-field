import type { LocalGroupBinding } from './localGroupBinding'
import { openDB, type DBSchema } from 'idb'
const PLAYER_SEED_VERSION = 4 // Historical seed marker; private roster is no longer bundled.
import { sessionSeed } from '../data/sessionSeed'
import type { AppMetaState, AppState, Attendance, Match, MatchPlayerEvaluation, Observation, Player, PlayerDevelopmentReview, PlayerObjective, PlayerObjectiveEvidence, PlayerYear, TrainingPlayerEvaluation, TrainingSession, TrainingTemplate, TrainingTemplatePhase, VoiceNote } from '../types/domain'
import { legacySessionToPlannedPhases, snapshotExercise } from '../utils/training'

interface CoachFieldDb extends DBSchema {
  players: {
    key: string
    value: Player
    indexes: { 'by-year': PlayerYear }
  }
  sessions: {
    key: string
    value: TrainingSession
  }
  observations: {
    key: string
    value: Observation
    indexes: { 'by-player': string; 'by-created': string; 'by-phase': string }
  }
  voiceNotes: {
    key: string
    value: VoiceNote
    indexes: { 'by-player': string; 'by-created': string; 'by-phase': string; 'by-match': string }
  }
  appState: {
    key: string
    value: AppState | AppMetaState | LocalGroupBinding
  }
  attendance: {
    key: string
    value: Attendance
    indexes: { 'by-session': string; 'by-player': string }
  }
  matches: {
    key: string
    value: Match
    indexes: { 'by-date': string; 'by-status': string; 'by-type': string }
  }
  matchPlayerEvaluations: {
    key: string
    value: MatchPlayerEvaluation
    indexes: { 'by-match': string; 'by-player': string; 'by-match-player': [string, string] }
  }
  trainingTemplates: {
    key: string
    value: TrainingTemplate
    indexes: { 'by-updated': string }
  }
  trainingPlayerEvaluations: {
    key: string
    value: TrainingPlayerEvaluation
    indexes: { 'by-session': string; 'by-player': string; 'by-session-player': [string, string] }
  }
  playerObjectives: {
    key: string
    value: PlayerObjective
    indexes: { 'by-player': string; 'by-status': string; 'by-player-status': [string, string] }
  }
  playerObjectiveEvidence: {
    key: string
    value: PlayerObjectiveEvidence
    indexes: { 'by-objective': string; 'by-player': string; 'by-date': string }
  }
  playerDevelopmentReviews: {
    key: string
    value: PlayerDevelopmentReview
    indexes: { 'by-player': string; 'by-date': string }
  }
}

export const dbPromise = openDB<CoachFieldDb>('coach-field-db', 5, {
  upgrade(db, oldVersion, _newVersion, transaction) {
    if (oldVersion < 1) {
      const players = db.createObjectStore('players', { keyPath: 'id' })
      players.createIndex('by-year', 'year')

      db.createObjectStore('sessions', { keyPath: 'id' })

      const observations = db.createObjectStore('observations', { keyPath: 'id' })
      observations.createIndex('by-player', 'playerId')
      observations.createIndex('by-created', 'createdAt')
      observations.createIndex('by-phase', 'phaseId')

      const voiceNotes = db.createObjectStore('voiceNotes', { keyPath: 'id' })
      voiceNotes.createIndex('by-player', 'playerId')
      voiceNotes.createIndex('by-created', 'createdAt')
      voiceNotes.createIndex('by-phase', 'phaseId')

      db.createObjectStore('appState', { keyPath: 'id' })
    }

    if (oldVersion < 2) {
      const attendance = db.createObjectStore('attendance', { keyPath: 'id' })
      attendance.createIndex('by-session', 'sessionId')
      attendance.createIndex('by-player', 'playerId')
    }

    if (oldVersion < 3) {
      // V2 Matches migration: add only new stores/indexes and preserve all V1 data.
      const matches = db.createObjectStore('matches', { keyPath: 'id' })
      matches.createIndex('by-date', 'date')
      matches.createIndex('by-status', 'status')
      matches.createIndex('by-type', 'matchType')

      const matchPlayerEvaluations = db.createObjectStore('matchPlayerEvaluations', { keyPath: 'id' })
      matchPlayerEvaluations.createIndex('by-match', 'matchId')
      matchPlayerEvaluations.createIndex('by-player', 'playerId')
      matchPlayerEvaluations.createIndex('by-match-player', ['matchId', 'playerId'])

      if (db.objectStoreNames.contains('voiceNotes')) {
        const voiceNotes = transaction.objectStore('voiceNotes')
        if (!voiceNotes.indexNames.contains('by-match')) {
          voiceNotes.createIndex('by-match', 'matchId')
        }
      }
    }

    if (oldVersion < 4) {
      const trainingTemplates = db.createObjectStore('trainingTemplates', { keyPath: 'id' })
      trainingTemplates.createIndex('by-updated', 'updatedAt')

      const trainingPlayerEvaluations = db.createObjectStore('trainingPlayerEvaluations', { keyPath: 'id' })
      trainingPlayerEvaluations.createIndex('by-session', 'sessionId')
      trainingPlayerEvaluations.createIndex('by-player', 'playerId')
      trainingPlayerEvaluations.createIndex('by-session-player', ['sessionId', 'playerId'])
    }

    if (oldVersion < 5) {
      const playerObjectives = db.createObjectStore('playerObjectives', { keyPath: 'id' })
      playerObjectives.createIndex('by-player', 'playerId')
      playerObjectives.createIndex('by-status', 'status')
      playerObjectives.createIndex('by-player-status', ['playerId', 'status'])

      const playerObjectiveEvidence = db.createObjectStore('playerObjectiveEvidence', { keyPath: 'id' })
      playerObjectiveEvidence.createIndex('by-objective', 'objectiveId')
      playerObjectiveEvidence.createIndex('by-player', 'playerId')
      playerObjectiveEvidence.createIndex('by-date', 'date')

      const playerDevelopmentReviews = db.createObjectStore('playerDevelopmentReviews', { keyPath: 'id' })
      playerDevelopmentReviews.createIndex('by-player', 'playerId')
      playerDevelopmentReviews.createIndex('by-date', 'date')
    }
  },
})

export async function initializeDatabase() {
  const db = await dbPromise
  const [playerCount, session, appState, templateCount, sessions] = await Promise.all([
    db.count('players'),
    db.get('sessions', sessionSeed.id),
    db.get('appState', 'current'),
    db.count('trainingTemplates'),
    db.getAll('sessions'),
  ])

  // Recovery never replaces existing rosters or sessions with bundled seeds.
  const needsPlayerSeedMigration = playerCount === 0
  const needsSessionSeedMigration = !session && sessions.length === 0
  const needsAppStateSeed = !appState
  const needsTrainingTemplateSeed = templateCount === 0
  const needsSessionV3Migration = sessions.some((item) => !item.status || !item.date || !item.plannedPhases)

  if (playerCount > 0 && !needsPlayerSeedMigration && !needsSessionSeedMigration && !needsAppStateSeed && !needsTrainingTemplateSeed && !needsSessionV3Migration) {
    if (import.meta.env.DEV) {
      const players = await db.getAll('players')
      console.info(`[CoachField] Player seed version ${PLAYER_SEED_VERSION} - ${players.length} players`)
    }
    return
  }

  const tx = db.transaction(['players', 'sessions', 'appState', 'trainingTemplates'], 'readwrite')
  const writes: Array<Promise<unknown>> = []
  if (playerCount === 0) {
    writes.push(tx.objectStore('appState').put({ id: 'playerSeedVersion', key: 'playerSeedVersion', value: PLAYER_SEED_VERSION }))
  }

  if (needsSessionSeedMigration) {
    writes.push(tx.objectStore('sessions').put({
      ...sessionSeed,
      date: new Date().toISOString().slice(0, 10),
      status: 'planned',
      plannedPhases: legacySessionToPlannedPhases(sessionSeed),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }))
  }

  if (needsSessionV3Migration) {
    writes.push(...sessions
      .filter((item) => !(needsSessionSeedMigration && item.id === sessionSeed.id))
      .map((item) => tx.objectStore('sessions').put({
      ...item,
      date: item.date ?? new Date().toISOString().slice(0, 10),
      status: item.status ?? 'planned',
      phases: item.phases ?? [],
      plannedPhases: item.plannedPhases ?? legacySessionToPlannedPhases(item),
      createdAt: item.createdAt ?? new Date().toISOString(),
      updatedAt: item.updatedAt ?? new Date().toISOString(),
    })))
  }

  if (needsTrainingTemplateSeed) {
    const phases: TrainingTemplatePhase[] = sessionSeed.phases.map((phase, index) => {
      const exercise = phase.fields?.[0]
      return {
        id: makeId(),
        title: phase.title,
        durationMinutes: Math.max(0, phase.endMinute - phase.startMinute),
        exerciseId: exercise?.id,
        exerciseSnapshot: snapshotExercise(exercise),
        notes: phase.objective,
        order: index + 1,
      }
    })
    writes.push(tx.objectStore('trainingTemplates').put({
      id: 'template-first-training-2016-2017',
      title: sessionSeed.title,
      description: 'Template iniziale creato dalla seduta seedata.',
      ageGroup: '2016/2017',
      expectedDurationMinutes: sessionSeed.durationMinutes,
      minPlayers: 12,
      maxPlayers: 24,
      tags: ['Collaborazione', 'Transizione', 'Ampiezza'],
      phases,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }))
  }

  if (!appState) {
    const initialSession = sessions[0] ?? sessionSeed
    const initialPhaseId = initialSession.phases?.[0]?.id ?? initialSession.plannedPhases?.[0]?.id ?? ''
    writes.push(tx.objectStore('appState').put({
      id: 'current',
      sessionId: initialSession.id,
      currentPhaseId: initialPhaseId,
      timer: {
        phaseId: initialPhaseId,
        status: 'idle',
        elapsedBeforeSeconds: 0,
      },
    }))
  }

  await Promise.all([...writes, tx.done])

  if (import.meta.env.DEV) {
    const players = await db.getAll('players')
    console.info(`[CoachField] Player seed version ${PLAYER_SEED_VERSION} - ${players.length} players`)
  }
}

export const makeId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`
