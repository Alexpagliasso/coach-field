import { matchesRequestedGroup, requireLocalPermission } from './localAccess'
import { dbPromise } from './scopedDb'
import type { Player, PlayerRating, PlayerRole } from '../types/domain'

export async function getPlayers(groupId?: string) {
  if (!matchesRequestedGroup(groupId)) return []
  const players = await (await dbPromise).getAll('players')
  return players.sort((a, b) => a.firstName.localeCompare(b.firstName))
}

export async function getPlayer(id: string, groupId?: string) {
  if (!matchesRequestedGroup(groupId)) return undefined
  return (await dbPromise).get('players', id)
}

export async function savePlayer(player: Player) {
  const db = await dbPromise
  const existing = await db.get('players', player.id)
  requireLocalPermission(existing ? 'players.edit' : 'players.create')
  await db.put('players', player)
}

export async function promotePlayerToRoster(playerId: string) {
  requireLocalPermission('players.edit')
  const db = await dbPromise
  const player = await db.get('players', playerId)
  if (!player) return
  await db.put('players', { ...player, status: 'roster' })
}

export async function updatePlayerRating(playerId: string, rating: PlayerRating) {
  requireLocalPermission('players.edit')
  const db = await dbPromise
  const player = await db.get('players', playerId)
  if (!player) return
  await db.put('players', { ...player, rating })
}

export async function updatePlayerIdealRoles(playerId: string, idealRoles: PlayerRole[]) {
  requireLocalPermission('players.edit')
  const db = await dbPromise
  const player = await db.get('players', playerId)
  if (!player) return
  await db.put('players', { ...player, idealRoles })
}

export async function toggleGoalkeeperCandidate(playerId: string, value?: boolean) {
  requireLocalPermission('players.edit')
  const db = await dbPromise
  const player = await db.get('players', playerId)
  if (!player) return
  await db.put('players', {
    ...player,
    goalkeeperCandidate: value ?? !player.goalkeeperCandidate,
  })
}
