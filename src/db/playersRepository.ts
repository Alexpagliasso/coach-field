import { dbPromise } from './db'
import type { Player, PlayerRating, PlayerRole } from '../types/domain'

export async function getPlayers() {
  const players = await (await dbPromise).getAll('players')
  return players.sort((a, b) => a.firstName.localeCompare(b.firstName))
}

export async function getPlayer(id: string) {
  return (await dbPromise).get('players', id)
}

export async function savePlayer(player: Player) {
  await (await dbPromise).put('players', player)
}

export async function promotePlayerToRoster(playerId: string) {
  const db = await dbPromise
  const player = await db.get('players', playerId)
  if (!player) return
  await db.put('players', { ...player, status: 'roster' })
}

export async function updatePlayerRating(playerId: string, rating: PlayerRating) {
  const db = await dbPromise
  const player = await db.get('players', playerId)
  if (!player) return
  await db.put('players', { ...player, rating })
}

export async function updatePlayerIdealRoles(playerId: string, idealRoles: PlayerRole[]) {
  const db = await dbPromise
  const player = await db.get('players', playerId)
  if (!player) return
  await db.put('players', { ...player, idealRoles })
}

export async function toggleGoalkeeperCandidate(playerId: string, value?: boolean) {
  const db = await dbPromise
  const player = await db.get('players', playerId)
  if (!player) return
  await db.put('players', {
    ...player,
    goalkeeperCandidate: value ?? !player.goalkeeperCandidate,
  })
}
