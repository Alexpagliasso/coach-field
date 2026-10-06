import type { IDBPDatabase } from 'idb'
import { captureLocalAccess, requireLocalPermission, assertCurrentAccess, belongsToGroup } from './localAccess'
import { getLocalGroupBinding, type LocalGroupBinding } from './localGroupBinding'
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
  localGroupBinding?: LocalGroupBinding
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
    groupId: typeof record.groupId === 'string' ? record.groupId : undefined,
    playerId: typeof record.playerId === 'string' ? record.playerId : undefined,
    sessionId: String(record.sessionId ?? ''),
    phaseId: typeof record.phaseId === 'string' ? record.phaseId : undefined,
    exerciseId: typeof record.exerciseId === 'string' ? record.exerciseId : undefined,
    matchId: typeof record.matchId === 'string' ? record.matchId : undefined,
    subjectType: record.subjectType === 'team' || record.subjectType === 'player' ? record.subjectType : undefined,
    contextType: record.contextType === 'match' || record.contextType === 'training' || record.contextType === 'general' ? record.contextType : undefined,
    createdAt: String(record.createdAt ?? new Date().toISOString()),
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : undefined,
    status: record.status === 'inbox' || record.status === 'reviewed' || record.status === 'archived' ? record.status : undefined,
    durationSeconds: Number(record.durationSeconds ?? 0),
    mimeType: String(record.mimeType ?? audioRecord.mimeType ?? 'audio/webm'),
    audio: await dataUrlToBlob(data),
  }
}

export async function getLocalDataCounts() {
  if (!captureLocalAccess().permissions['data.manage']) return {}
  const access = await assertBackupAccess()
  const db = await dbPromise
  const genericDb = db as unknown as GenericDatabase
  const storeNames = Array.from(genericDb.objectStoreNames)
  const pairs = await Promise.all(storeNames.map(async (storeName) => [storeName, (await genericDb.getAll(storeName)).filter(row => belongsToGroup(row as { groupId?: string }, access.groupId, access.groupId)).length] as const))
  assertCurrentAccess(access)
  return Object.fromEntries(pairs)
}

export async function exportCoachFieldData(): Promise<CoachFieldExport> {
  const access = await assertBackupAccess()
  const db = await dbPromise
  const genericDb = db as unknown as GenericDatabase
  const storeNames = Array.from(genericDb.objectStoreNames)
  const data: CoachFieldExport['data'] = {}
  const counts: CoachFieldExport['counts'] = {}

  for (const storeName of storeNames) {
    const rows = (await genericDb.getAll(storeName)).filter(row => belongsToGroup(row as { groupId?: string }, access.groupId, access.groupId))
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

  assertCurrentAccess(access)
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
  const access = await assertBackupAccess()
  const db = await dbPromise
  const [players, observations, sessions, voiceNotes, attendance] = await Promise.all([
    db.getAll('players'),
    db.getAll('observations'),
    db.getAll('sessions'),
    db.getAll('voiceNotes'),
    db.getAll('attendance'),
  ])
  const visible = <T extends { groupId?: string }>(rows: T[]) => rows.filter(row => belongsToGroup(row, access.groupId, access.groupId))
  const binding = await getLocalGroupBinding()
  assertCurrentAccess(access)
  return {
    localGroupBinding: binding,
    exportedAt: new Date().toISOString(),
    players: visible(players),
    observations: visible(observations),
    session: visible(sessions)[0],
    voiceNotes: visible(voiceNotes).map((note) => ({
      id: note.id,
      groupId: note.groupId,
      playerId: note.playerId,
      sessionId: note.sessionId,
      phaseId: note.phaseId,
      exerciseId: note.exerciseId,
      matchId: note.matchId,
      subjectType: note.subjectType,
      contextType: note.contextType,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
      status: note.status,
      durationSeconds: note.durationSeconds,
      mimeType: note.mimeType,
    })),
    attendance: visible(attendance),
  }
}

async function assertBackupAccess() {
  const access = requireLocalPermission('data.manage')
  const binding = await getLocalGroupBinding()
  assertCurrentAccess(access)
  if (binding?.groupId !== access.groupId) throw new Error('Backup non disponibile per questo gruppo.')
  return access
}

export async function restoreBackup(payload: BackupPayload | CoachFieldExport) {
  const access = await assertBackupAccess()
  if (!payload || typeof payload !== 'object') throw new Error('Backup non valido.')
  const db = await dbPromise as unknown as IDBPDatabase
  const stores = Array.from(db.objectStoreNames)
  const rows: Record<string, unknown[]> = {}
  if (isCoachFieldExport(payload)) {
    if (payload.app !== 'Coach Field' || payload.backupVersion !== 1 || !payload.data) throw new Error('Formato backup non supportato.')
    for (const name of stores) {
      const values = payload.data[name]
      if (values === undefined) continue
      if (!Array.isArray(values) || values.some(row => !row || typeof row !== 'object' || !('id' in row) || typeof row.id !== 'string')) throw new Error('Store backup non valido: ' + name)
      rows[name] = name === 'voiceNotes' ? await Promise.all(values.map(async value => {
        const note = await deserializeVoiceNote(value)
        if (!note) throw new Error('Audio backup non valido.')
        return note
      })) : values
    }
  } else {
    if (!Array.isArray(payload.players) || !Array.isArray(payload.observations)) throw new Error('Backup legacy non valido.')
    Object.assign(rows, { players: payload.players, observations: payload.observations, sessions: payload.session ? [payload.session] : [], attendance: payload.attendance ?? [] })
    if (payload.localGroupBinding) rows.appState = [payload.localGroupBinding]
  }
  const state = (rows.appState ?? []) as Array<{ id: string; groupId?: string }>
  const binding = state.find(row => row.id === 'localGroupBinding')
  if (binding && (!binding.groupId || binding.groupId !== access.groupId)) throw new Error('Il backup appartiene a un altro gruppo. Ripristino annullato.')
  for (const values of Object.values(rows)) for (const value of values) {
    if (!value || typeof value !== 'object' || !('id' in value) || typeof value.id !== 'string') throw new Error('Record non valido.')
    if ('groupId' in value && value.groupId && value.groupId !== access.groupId) throw new Error('Il backup contiene dati di un altro gruppo.')
  }
  // Allowlist metadata; never import arbitrary settings, sessions or credentials.
  rows.appState = state.filter(row => ['current', 'playerSeedVersion', 'localGroupBinding'].includes(row.id))
  assertCurrentAccess(access)
  const tx = db.transaction(Object.keys(rows), 'readwrite')
  for (const [name, values] of Object.entries(rows)) {
    await tx.objectStore(name).clear()
    for (const row of values) await tx.objectStore(name).put(row)
  }
  await tx.done
  if (isCoachFieldExport(payload) && typeof window !== 'undefined') {
    const theme = payload.data.theme
    if (theme && !Array.isArray(theme) && ['pitch', 'electric', 'purple', 'ice', 'light'].includes(theme.value)) {
      try { window.localStorage.setItem(THEME_STORAGE_KEY, theme.value) } catch { /* Storage may be unavailable. */ }
    }
  }
  // Backups without a binding require an explicit new association before displaying data.
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('local-data-restored'))
}
