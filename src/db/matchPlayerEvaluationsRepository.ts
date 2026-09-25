import { requireLocalPermission } from './localAccess'
import type { MatchPlayerEvaluation, PlayerRole } from '../types/domain'
import { dbPromise } from './scopedDb'
import { makeId } from './db'

export async function createMatchPlayerEvaluation(matchId: string, playerId: string) {
  requireLocalPermission('matches.evaluate')
  const now = new Date().toISOString()
  const evaluation: MatchPlayerEvaluation = {
    id: makeId(),
    matchId,
    playerId,
    selected: true,
    present: true,
    rolesPlayed: [],
    rating: null,
    positiveTags: [],
    attentionTags: [],
    createdAt: now,
    updatedAt: now,
  }
  await (await dbPromise).put('matchPlayerEvaluations', evaluation)
  return evaluation
}

export async function getMatchPlayerEvaluationById(id: string) {
  return (await dbPromise).get('matchPlayerEvaluations', id)
}

export async function getMatchPlayerEvaluations() {
  return (await dbPromise).getAll('matchPlayerEvaluations')
}

export async function getMatchPlayerEvaluationsByMatch(matchId: string) {
  const rows = await (await dbPromise).getAllFromIndex('matchPlayerEvaluations', 'by-match', matchId)
  return rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export async function getMatchPlayerEvaluationsByPlayer(playerId: string) {
  const rows = await (await dbPromise).getAllFromIndex('matchPlayerEvaluations', 'by-player', playerId)
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function getMatchPlayerEvaluationByMatchAndPlayer(matchId: string, playerId: string) {
  return (await dbPromise).getFromIndex('matchPlayerEvaluations', 'by-match-player', [matchId, playerId])
}

export async function upsertMatchPlayerEvaluation(matchId: string, playerId: string, patch: Partial<Omit<MatchPlayerEvaluation, 'id' | 'matchId' | 'playerId' | 'createdAt'>>) {
  requireLocalPermission('matches.evaluate')
  const db = await dbPromise
  const existing = await db.getFromIndex('matchPlayerEvaluations', 'by-match-player', [matchId, playerId])
  const now = new Date().toISOString()
  const next: MatchPlayerEvaluation = existing
    ? { ...existing, ...patch, updatedAt: now }
    : {
      id: makeId(),
      matchId,
      playerId,
      selected: false,
      present: false,
      rolesPlayed: [],
      rating: null,
      positiveTags: [],
      attentionTags: [],
      createdAt: now,
      updatedAt: now,
      ...patch,
    }
  await db.put('matchPlayerEvaluations', next)
  return next
}

export async function updateMatchPlayerEvaluation(id: string, patch: Partial<Omit<MatchPlayerEvaluation, 'id' | 'matchId' | 'playerId' | 'createdAt'>>) {
  requireLocalPermission('matches.evaluate')
  const db = await dbPromise
  const evaluation = await db.get('matchPlayerEvaluations', id)
  if (!evaluation) return
  const next: MatchPlayerEvaluation = { ...evaluation, ...patch, updatedAt: new Date().toISOString() }
  await db.put('matchPlayerEvaluations', next)
  return next
}

export async function deleteMatchPlayerEvaluation(id: string) {
  requireLocalPermission('matches.evaluate')
  await (await dbPromise).delete('matchPlayerEvaluations', id)
}

export async function setAllMatchPlayers(matchId: string, playerIds: string[], selected: boolean) {
  requireLocalPermission('matches.evaluate')
  const db = await dbPromise
  const existing = await db.getAllFromIndex('matchPlayerEvaluations', 'by-match', matchId)
  const existingByPlayer = new Map(existing.map((evaluation) => [evaluation.playerId, evaluation]))
  const now = new Date().toISOString()
  const tx = db.transaction('matchPlayerEvaluations', 'readwrite')
  await Promise.all(playerIds.map((playerId) => {
    const current = existingByPlayer.get(playerId)
    const next: MatchPlayerEvaluation = current
      ? { ...current, selected, present: selected, updatedAt: now }
      : {
        id: makeId(),
        matchId,
        playerId,
        selected,
        present: selected,
        rolesPlayed: [],
        rating: null,
        positiveTags: [],
        attentionTags: [],
        createdAt: now,
        updatedAt: now,
      }
    return tx.store.put(next)
  }))
  await tx.done
}

export function toggleRoleList(roles: PlayerRole[], role: PlayerRole) {
  return roles.includes(role) ? roles.filter((item) => item !== role) : [...roles, role]
}
