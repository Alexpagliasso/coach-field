import { openDB, type DBSchema } from 'idb'
import { PLAYER_SEED_VERSION, playersSeed } from '../data/playersSeed'
import { sessionSeed } from '../data/sessionSeed'
import type { AppMetaState, AppState, Attendance, Match, MatchPlayerEvaluation, Observation, Player, PlayerYear, TrainingSession, VoiceNote } from '../types/domain'

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
    value: AppState | AppMetaState
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
}

export const dbPromise = openDB<CoachFieldDb>('coach-field-db', 3, {
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
  },
})

export async function initializeDatabase() {
  const db = await dbPromise
  const [playerCount, session, appState, storedPlayerSeedVersion] = await Promise.all([
    db.count('players'),
    db.get('sessions', sessionSeed.id),
    db.get('appState', 'current'),
    db.get('appState', 'playerSeedVersion'),
  ])

  const needsPlayerSeedMigration =
    !storedPlayerSeedVersion ||
    !('value' in storedPlayerSeedVersion) ||
    storedPlayerSeedVersion.value < PLAYER_SEED_VERSION
  const needsSessionSeedMigration =
    !session ||
    session.phases.find((phase) => phase.id === 'phase-2')?.fields?.[0]?.specialRule?.title !== 'Assist = gol doppio'
  const needsAppStateSeed = !appState

  if (playerCount > 0 && !needsPlayerSeedMigration && !needsSessionSeedMigration && !needsAppStateSeed) {
    if (import.meta.env.DEV) {
      const players = await db.getAll('players')
      console.info(`[CoachField] Player seed version ${PLAYER_SEED_VERSION} - ${players.length} players`)
    }
    return
  }

  const [currentPlayers, observations, attendance] = needsPlayerSeedMigration
    ? await Promise.all([
      db.getAll('players'),
      db.getAll('observations'),
      db.getAll('attendance'),
    ])
    : [[], [], []]

  const tx = db.transaction(['players', 'sessions', 'appState', 'observations', 'attendance'], 'readwrite')
  const writes: Array<Promise<unknown>> = []

  if (playerCount === 0 || needsPlayerSeedMigration) {
    const currentPlayerIds = new Set(currentPlayers.map((player) => player.id))
    const realPlayerIds = new Set(playersSeed.map((player) => player.id))
    const isRealRosterAlreadyLoaded = currentPlayers.some((player) => realPlayerIds.has(player.id))
    const placeholderIds = currentPlayers
      .filter((player) => !realPlayerIds.has(player.id) && player.status !== 'guest')
      .map((player) => player.id)
    const placeholderIdSet = new Set(placeholderIds)

    writes.push(...placeholderIds.map((playerId) => tx.objectStore('players').delete(playerId)))
    if (isRealRosterAlreadyLoaded) {
      writes.push(...currentPlayers
        .filter((player) => realPlayerIds.has(player.id))
        .map((player) => tx.objectStore('players').put({
          ...player,
          rating: player.rating ?? null,
          idealRoles: Array.isArray(player.idealRoles) ? player.idealRoles : [],
          status: player.status ?? 'roster',
        })))
      const existingRealIds = new Set(currentPlayers.filter((player) => realPlayerIds.has(player.id)).map((player) => player.id))
      writes.push(...playersSeed
        .filter((player) => !existingRealIds.has(player.id))
        .map((player) => tx.objectStore('players').put(player)))
      writes.push(...currentPlayers
        .filter((player) => player.status === 'guest')
        .map((player) => tx.objectStore('players').put({
          ...player,
          rating: player.rating ?? null,
          idealRoles: Array.isArray(player.idealRoles) ? player.idealRoles : [],
          status: 'guest',
        })))
    } else {
      writes.push(...playersSeed.map((player) => tx.objectStore('players').put(player)))
    }

    if (placeholderIdSet.size > 0 || currentPlayerIds.size > 0) {
      writes.push(...observations
        .filter((observation) => placeholderIdSet.has(observation.playerId))
        .map((observation) => tx.objectStore('observations').delete(observation.id)))
      writes.push(...attendance
        .filter((item) => placeholderIdSet.has(item.playerId))
        .map((item) => tx.objectStore('attendance').delete(item.id)))
    }

    writes.push(tx.objectStore('appState').put({
      id: 'playerSeedVersion',
      key: 'playerSeedVersion',
      value: PLAYER_SEED_VERSION,
    }))
  }

  if (needsSessionSeedMigration) {
    writes.push(tx.objectStore('sessions').put(sessionSeed))
  }

  if (!appState) {
    writes.push(tx.objectStore('appState').put({
      id: 'current',
      sessionId: sessionSeed.id,
      currentPhaseId: sessionSeed.phases[0].id,
      timer: {
        phaseId: sessionSeed.phases[0].id,
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
