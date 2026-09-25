import { requireLocalPermission } from './localAccess'
import type { VoiceNote } from '../types/domain'
import { dbPromise } from './scopedDb'
import { makeId } from './db'

type SaveVoiceNoteInput = {
  playerId?: string
  sessionId: string
  phaseId?: string
  exerciseId?: string
  matchId?: string
  durationSeconds: number
  mimeType: string
  audio: Blob
}

export async function saveVoiceNote(input: SaveVoiceNoteInput) {
  requireLocalPermission('notes.create')
  const note: VoiceNote = {
    id: makeId(),
    createdAt: new Date().toISOString(),
    ...input,
  }
  await (await dbPromise).put('voiceNotes', note)
  return note
}

export async function getVoiceNotes() {
  const notes = await (await dbPromise).getAll('voiceNotes')
  return notes.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function getVoiceNotesByPlayer(playerId: string) {
  const notes = await (await dbPromise).getAllFromIndex('voiceNotes', 'by-player', playerId)
  return notes.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function deleteVoiceNote(id: string) {
  requireLocalPermission('notes.delete')
  await (await dbPromise).delete('voiceNotes', id)
}
