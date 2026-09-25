import { matchesRequestedGroup, requireLocalPermission } from './localAccess'
import type { Match, MatchStatus, MatchType, PlayerRating } from '../types/domain'
import { dbPromise } from './scopedDb'
import { makeId } from './db'

type CreateMatchInput = {
  date: string
  opponent: string
  competition?: string
  matchType: MatchType
  homeAway: Match['homeAway']
  location?: string
}

export async function createMatch(input: CreateMatchInput) {
  requireLocalPermission('matches.create')
  const now = new Date().toISOString()
  const match: Match = {
    id: makeId(),
    date: input.date,
    opponent: input.opponent.trim(),
    competition: input.competition?.trim() || undefined,
    matchType: input.matchType,
    homeAway: input.homeAway,
    location: input.location?.trim() || undefined,
    status: 'planned',
    createdAt: now,
    updatedAt: now,
  }
  await (await dbPromise).put('matches', match)
  return match
}

export async function getMatches(groupId?: string) {
  if (!matchesRequestedGroup(groupId)) return []
  const matches = await (await dbPromise).getAll('matches')
  return matches.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
}

export async function getMatchById(id: string) {
  return (await dbPromise).get('matches', id)
}

export async function updateMatch(id: string, patch: Partial<Omit<Match, 'id' | 'createdAt'>>) {
  requireLocalPermission('matches.edit')
  const db = await dbPromise
  const match = await db.get('matches', id)
  if (!match) return
  const next: Match = { ...match, ...patch, updatedAt: new Date().toISOString() }
  await db.put('matches', next)
  return next
}

export async function updateMatchScore(id: string, goalsFor?: number, goalsAgainst?: number) {
  return updateMatch(id, { goalsFor, goalsAgainst })
}

export async function updateMatchTeamRating(id: string, teamRating: PlayerRating) {
  return updateMatch(id, { teamRating })
}

export async function completeMatch(id: string) {
  return updateMatch(id, { status: 'completed' as MatchStatus })
}

export async function deleteMatch(id: string) {
  requireLocalPermission('matches.edit')
  const db = await dbPromise
  const evaluations = await db.getAllFromIndex('matchPlayerEvaluations', 'by-match', id)
  const tx = db.transaction(['matches', 'matchPlayerEvaluations'], 'readwrite')
  await Promise.all([
    tx.objectStore('matches').delete(id),
    ...evaluations.map((evaluation) => tx.objectStore('matchPlayerEvaluations').delete(evaluation.id)),
    tx.done,
  ])
}
