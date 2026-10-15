import type { MatchLiveSnapshot, MatchPlayerStint } from '../cloud/matchLiveRepository'

export type PlayerMinutes = {
  playerId: string
  totalSeconds: number
  periodSeconds: Map<number, number>
  entries: number
  exits: number
  active: boolean
}

/**
 * Turns durable stints into display-only minutes. Open stints receive time
 * only while their period is the one reported by the authoritative snapshot.
 */
export function calculateMatchPlayerMinutes(
  playerIds: string[], stints: MatchPlayerStint[], snapshot: Pick<MatchLiveSnapshot, 'phase' | 'currentPeriod' | 'elapsedSeconds' | 'activePlayers'>,
): PlayerMinutes[] {
  const activeIds = new Set(snapshot.activePlayers.map(player => player.playerId))
  const rows = new Map(playerIds.map(playerId => [playerId, { playerId, totalSeconds: 0, periodSeconds: new Map<number, number>(), entries: 0, exits: 0, active: activeIds.has(playerId) }]))
  for (const stint of stints) {
    const row = rows.get(stint.playerId)
    if (!row) continue
    const end = stint.exitedElapsedSeconds ?? (stint.periodNumber === snapshot.currentPeriod && (snapshot.phase === 'running' || snapshot.phase === 'paused') ? snapshot.elapsedSeconds : stint.enteredElapsedSeconds)
    const duration = Math.max(0, end - stint.enteredElapsedSeconds)
    row.totalSeconds += duration
    row.periodSeconds.set(stint.periodNumber, (row.periodSeconds.get(stint.periodNumber) ?? 0) + duration)
    row.entries += 1
    if (stint.exitedElapsedSeconds !== null && stint.exitedElapsedSeconds !== undefined) row.exits += 1
  }
  return [...rows.values()].sort((a, b) => Number(b.active) - Number(a.active) || a.totalSeconds - b.totalSeconds || a.playerId.localeCompare(b.playerId))
}

export const formatMatchMinutes = (seconds: number) => `${Math.floor(Math.max(0, seconds) / 60)}′`
