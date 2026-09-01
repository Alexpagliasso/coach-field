import type { Observation, Player, TrainingSession, VoiceNote } from '../types/domain'
import type { Attendance } from '../types/domain'
import { dbPromise } from './db'

export type BackupPayload = {
  exportedAt: string
  players: Player[]
  observations: Observation[]
  session?: TrainingSession
  voiceNotes: Array<Omit<VoiceNote, 'audio'>>
  attendance?: Attendance[]
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

export async function restoreBackup(payload: BackupPayload) {
  const db = await dbPromise
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
