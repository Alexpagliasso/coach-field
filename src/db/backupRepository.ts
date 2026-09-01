import type { Observation, Player, TrainingSession, VoiceNote } from '../types/domain'
import type { Attendance } from '../types/domain'
import { dbPromise } from './db'
import { THEME_STORAGE_KEY } from '../theme'

const BACKUP_VERSION = 1
const APP_VERSION = '0.0.0'

type SerializedValue =
  | string
  | number
  | boolean
  | null
  | SerializedValue[]
  | { [key: string]: SerializedValue }

type SerializedStore = SerializedValue[]

type GenericDatabase = {
  version: number
  objectStoreNames: DOMStringList
  getAll: (storeName: string) => Promise<unknown[]>
}

export type CoachFieldExport = {
  app: 'Coach Field'
  backupVersion: number
  exportedAt: string
  databaseVersion: number
  appVersion: string
  data: Record<string, SerializedStore | { key: 'theme'; value: string }>
  counts: Record<string, number>
}

export type BackupPayload = {
  exportedAt: string
  players: Player[]
  observations: Observation[]
  session?: TrainingSession
  voiceNotes: Array<Omit<VoiceNote, 'audio'>>
  attendance?: Attendance[]
}

function isCoachFieldExport(payload: BackupPayload | CoachFieldExport): payload is CoachFieldExport {
  return 'backupVersion' in payload && 'data' in payload
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('Blob read failed'))
    reader.readAsDataURL(blob)
  })
}

async function serializeForJson(value: unknown): Promise<SerializedValue> {
  if (value instanceof Blob) {
    return {
      encoding: 'base64',
      mimeType: value.type,
      data: await blobToDataUrl(value),
    }
  }

  if (value instanceof Date) return value.toISOString()

  if (Array.isArray(value)) {
    return Promise.all(value.map((item) => serializeForJson(item)))
  }

  if (value && typeof value === 'object') {
    const entries = await Promise.all(Object.entries(value).map(async ([key, item]) => [key, await serializeForJson(item)] as const))
    return Object.fromEntries(entries)
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null) {
    return value
  }

  return value === undefined ? null : String(value)
}

async function dataUrlToBlob(value: string) {
  const response = await fetch(value)
  return response.blob()
}

async function deserializeVoiceNote(value: SerializedValue): Promise<VoiceNote | undefined> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const record = value as Record<string, SerializedValue>
  const audio = record.audio
  if (!audio || typeof audio !== 'object' || Array.isArray(audio)) return undefined
  const audioRecord = audio as Record<string, SerializedValue>
  const data = audioRecord.data
  if (typeof data !== 'string') return undefined

  return {
    id: String(record.id ?? ''),
    playerId: typeof record.playerId === 'string' ? record.playerId : undefined,
    sessionId: String(record.sessionId ?? ''),
    phaseId: typeof record.phaseId === 'string' ? record.phaseId : undefined,
    exerciseId: typeof record.exerciseId === 'string' ? record.exerciseId : undefined,
    createdAt: String(record.createdAt ?? new Date().toISOString()),
    durationSeconds: Number(record.durationSeconds ?? 0),
    mimeType: String(record.mimeType ?? audioRecord.mimeType ?? 'audio/webm'),
    audio: await dataUrlToBlob(data),
  }
}

export async function getLocalDataCounts() {
  const db = await dbPromise
  const genericDb = db as unknown as GenericDatabase
  const storeNames = Array.from(genericDb.objectStoreNames)
  const pairs = await Promise.all(storeNames.map(async (storeName) => [storeName, (await genericDb.getAll(storeName)).length] as const))
  return Object.fromEntries(pairs)
}

export async function exportCoachFieldData(): Promise<CoachFieldExport> {
  const db = await dbPromise
  const genericDb = db as unknown as GenericDatabase
  const storeNames = Array.from(genericDb.objectStoreNames)
  const data: CoachFieldExport['data'] = {}
  const counts: CoachFieldExport['counts'] = {}

  for (const storeName of storeNames) {
    const rows = await genericDb.getAll(storeName)
    counts[storeName] = rows.length
    data[storeName] = await Promise.all(rows.map((row) => serializeForJson(row)))
  }

  try {
    const theme = window.localStorage.getItem(THEME_STORAGE_KEY)
    if (theme) {
      data.theme = { key: 'theme', value: theme }
      counts.theme = 1
    }
  } catch {
    counts.theme = 0
  }

  return {
    app: 'Coach Field',
    backupVersion: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    databaseVersion: genericDb.version,
    appVersion: APP_VERSION,
    data,
    counts,
  }
}

export async function createBackup(): Promise<BackupPayload> {
  const db = await dbPromise
  const [players, observations, sessions, voiceNotes, attendance] = await Promise.all([
    db.getAll('players'),
    db.getAll('observations'),
    db.getAll('sessions'),
    db.getAll('voiceNotes'),
    db.getAll('attendance'),
  ])
  return {
    exportedAt: new Date().toISOString(),
    players,
    observations,
    session: sessions[0],
    voiceNotes: voiceNotes.map((note) => ({
      id: note.id,
      playerId: note.playerId,
      sessionId: note.sessionId,
      phaseId: note.phaseId,
      exerciseId: note.exerciseId,
      createdAt: note.createdAt,
      durationSeconds: note.durationSeconds,
      mimeType: note.mimeType,
    })),
    attendance,
  }
}

export async function restoreBackup(payload: BackupPayload | CoachFieldExport) {
  const db = await dbPromise
  if (isCoachFieldExport(payload)) {
    const players = (payload.data.players ?? []) as Player[]
    const observations = (payload.data.observations ?? []) as Observation[]
    const sessions = (payload.data.sessions ?? []) as TrainingSession[]
    const attendance = (payload.data.attendance ?? []) as Attendance[]
    const voiceNotes = await Promise.all(((payload.data.voiceNotes ?? []) as SerializedValue[]).map(deserializeVoiceNote))
    const tx = db.transaction(['players', 'observations', 'sessions', 'attendance', 'voiceNotes'], 'readwrite')
    await tx.objectStore('players').clear()
    await tx.objectStore('observations').clear()
    await tx.objectStore('sessions').clear()
    await tx.objectStore('attendance').clear()
    await tx.objectStore('voiceNotes').clear()
    await Promise.all(players.map((player) => tx.objectStore('players').put(player)))
    await Promise.all(observations.map((observation) => tx.objectStore('observations').put(observation)))
    await Promise.all(sessions.map((session) => tx.objectStore('sessions').put(session)))
    await Promise.all(attendance.map((item) => tx.objectStore('attendance').put(item)))
    await Promise.all(voiceNotes.filter((note): note is VoiceNote => Boolean(note)).map((note) => tx.objectStore('voiceNotes').put(note)))
    await tx.done
    return
  }

  const tx = db.transaction(['players', 'observations', 'sessions', 'attendance'], 'readwrite')
  await tx.objectStore('players').clear()
  await tx.objectStore('observations').clear()
  await tx.objectStore('sessions').clear()
  await tx.objectStore('attendance').clear()
  await Promise.all(payload.players.map((player) => tx.objectStore('players').put(player)))
  await Promise.all(payload.observations.map((observation) => tx.objectStore('observations').put(observation)))
  await Promise.all((payload.attendance ?? []).map((item) => tx.objectStore('attendance').put(item)))
  if (payload.session) await tx.objectStore('sessions').put(payload.session)
  await tx.done
}
