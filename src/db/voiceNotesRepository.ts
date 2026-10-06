import { requireLocalPermission } from './localAccess'
import type { ObservationContextType, ObservationSubjectType, VoiceNote } from '../types/domain'
import { dbPromise } from './scopedDb'
import { makeId } from './db'

type SaveVoiceNoteInput = {
  playerId?: string
  sessionId: string
  phaseId?: string
  exerciseId?: string
  matchId?: string
  subjectType?: ObservationSubjectType
  contextType?: ObservationContextType
  durationSeconds: number
  mimeType: string
  audio: Blob
}

export async function saveVoiceNote(input: SaveVoiceNoteInput) {
  requireLocalPermission('notes.create')
  const note: VoiceNote = {
    id: makeId(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: input.subjectType ? 'inbox' : 'reviewed',
    ...input,
  }
  await (await dbPromise).put('voiceNotes', note)
  return note
}

export async function getVoiceNotes() {
  const notes = await (await dbPromise).getAll('voiceNotes')
  return notes.map(note => ({ ...note, status: note.status ?? 'reviewed', updatedAt: note.updatedAt ?? note.createdAt })).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function getVoiceNotesByPlayer(playerId: string) {
  const notes = await (await dbPromise).getAllFromIndex('voiceNotes', 'by-player', playerId)
  return notes.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function deleteVoiceNote(id: string) {
  requireLocalPermission('notes.delete')
  await (await dbPromise).delete('voiceNotes', id)
}

export async function updateVoiceNoteStatus(id: string, status: VoiceNote['status']) {
  requireLocalPermission('notes.create')
  const db = await dbPromise
  const current = await db.get('voiceNotes', id)
  if (!current || !status) return undefined
  const next = { ...current, status, updatedAt: new Date().toISOString() }
  await db.put('voiceNotes', next)
  return next
}
