import { captureLocalAccess, requireLocalPermission } from './localAccess'
import type { Attendance, Player } from '../types/domain'
import { dbPromise } from './scopedDb'

const attendanceId = (sessionId: string, playerId: string) => `${sessionId}:${playerId}`

export async function getAttendanceBySession(sessionId: string) {
  const rows = await (await dbPromise).getAllFromIndex('attendance', 'by-session', sessionId)
  return rows.sort((a, b) => a.playerId.localeCompare(b.playerId))
}

export async function getAttendanceByPlayer(playerId: string) {
  return (await dbPromise).getAllFromIndex('attendance', 'by-player', playerId)
}

export async function ensureAttendanceForSession(sessionId: string, players: Player[]) {
  const db = await dbPromise
  const existing = await db.getAllFromIndex('attendance', 'by-session', sessionId)
  const existingIds = new Set(existing.map((item) => item.playerId))
  const missing = players.filter((player) => !existingIds.has(player.id))

  if (missing.length === 0 || !captureLocalAccess().permissions['attendance.edit']) return existing

  const tx = db.transaction('attendance', 'readwrite')
  await Promise.all(missing.map((player) => tx.store.put({
    id: attendanceId(sessionId, player.id),
    sessionId,
    playerId: player.id,
    present: player.status !== 'guest',
  })))
  await tx.done
  return getAttendanceBySession(sessionId)
}

export async function setPlayerAttendance(sessionId: string, playerId: string, present: boolean) {
  requireLocalPermission('attendance.edit')
  const row: Attendance = {
    id: attendanceId(sessionId, playerId),
    sessionId,
    playerId,
    present,
  }
  await (await dbPromise).put('attendance', row)
  return row
}

export async function setAllAttendance(sessionId: string, players: Player[], present: boolean) {
  requireLocalPermission('attendance.edit')
  const tx = (await dbPromise).transaction('attendance', 'readwrite')
  await Promise.all(players.map((player) => tx.store.put({
    id: attendanceId(sessionId, player.id),
    sessionId,
    playerId: player.id,
    present,
  })))
  await tx.done
}
