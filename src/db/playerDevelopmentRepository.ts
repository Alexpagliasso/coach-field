import { requireLocalPermission } from './localAccess'
import type { PlayerDevelopmentReview, PlayerObjective, PlayerObjectiveCategory, PlayerObjectiveEvidence, PlayerObjectiveEvidenceOutcome, PlayerObjectivePriority, PlayerObjectiveStatus, PlayerRating, PlayerRole } from '../types/domain'
import { dbPromise } from './scopedDb'
import { makeId } from './db'

export async function getPlayerObjectives(playerId: string) {
  const rows = await (await dbPromise).getAllFromIndex('playerObjectives', 'by-player', playerId)
  return rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function getActivePlayerObjectives(playerId: string) {
  return (await dbPromise).getAllFromIndex('playerObjectives', 'by-player-status', [playerId, 'active'])
}

export async function getAllActiveObjectives() {
  return (await dbPromise).getAllFromIndex('playerObjectives', 'by-status', 'active')
}

export async function createPlayerObjective(input: {
  playerId: string
  title: string
  description?: string
  category: PlayerObjectiveCategory
  priority: PlayerObjectivePriority
  sourceMatchId?: string
  sourceTrainingSessionId?: string
  notes?: string
}) {
  requireLocalPermission('development.edit')
  const now = new Date().toISOString()
  const objective: PlayerObjective = {
    id: makeId(),
    playerId: input.playerId,
    title: input.title.trim(),
    description: input.description?.trim() || undefined,
    category: input.category,
    priority: input.priority,
    status: 'active',
    sourceMatchId: input.sourceMatchId,
    sourceTrainingSessionId: input.sourceTrainingSessionId,
    notes: input.notes?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
  }
  await (await dbPromise).put('playerObjectives', objective)
  return objective
}

export async function updatePlayerObjective(id: string, patch: Partial<Omit<PlayerObjective, 'id' | 'playerId' | 'createdAt'>>) {
  requireLocalPermission('development.edit')
  const db = await dbPromise
  const current = await db.get('playerObjectives', id)
  if (!current) return undefined
  const status = patch.status ?? current.status
  const next: PlayerObjective = {
    ...current,
    ...patch,
    achievedAt: status === 'achieved' ? (current.achievedAt ?? new Date().toISOString()) : current.achievedAt,
    updatedAt: new Date().toISOString(),
  }
  await db.put('playerObjectives', next)
  return next
}

export async function setPlayerObjectiveStatus(id: string, status: PlayerObjectiveStatus) {
  return updatePlayerObjective(id, { status })
}

export async function getPlayerObjectiveEvidence(playerId: string) {
  const rows = await (await dbPromise).getAllFromIndex('playerObjectiveEvidence', 'by-player', playerId)
  return rows.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
}

export async function getEvidenceByObjective(objectiveId: string) {
  const rows = await (await dbPromise).getAllFromIndex('playerObjectiveEvidence', 'by-objective', objectiveId)
  return rows.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
}

export async function addPlayerObjectiveEvidence(input: {
  objectiveId: string
  playerId: string
  outcome: PlayerObjectiveEvidenceOutcome
  note?: string
  matchId?: string
  trainingSessionId?: string
  date?: string
}) {
  requireLocalPermission('development.edit')
  const now = new Date().toISOString()
  const evidence: PlayerObjectiveEvidence = {
    id: makeId(),
    objectiveId: input.objectiveId,
    playerId: input.playerId,
    outcome: input.outcome,
    note: input.note?.trim() || undefined,
    matchId: input.matchId,
    trainingSessionId: input.trainingSessionId,
    date: input.date ?? now.slice(0, 10),
    createdAt: now,
  }
  await (await dbPromise).put('playerObjectiveEvidence', evidence)
  return evidence
}

export async function getPlayerDevelopmentReviews(playerId: string) {
  const rows = await (await dbPromise).getAllFromIndex('playerDevelopmentReviews', 'by-player', playerId)
  return rows.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
}

export async function createPlayerDevelopmentReview(input: {
  playerId: string
  date: string
  overallRatingSnapshot?: PlayerRating
  strengths: string[]
  developmentAreas: string[]
  suggestedRoles: PlayerRole[]
  summary?: string
}) {
  requireLocalPermission('development.edit')
  const now = new Date().toISOString()
  const review: PlayerDevelopmentReview = {
    id: makeId(),
    playerId: input.playerId,
    date: input.date,
    overallRatingSnapshot: input.overallRatingSnapshot,
    strengths: input.strengths,
    developmentAreas: input.developmentAreas,
    suggestedRoles: input.suggestedRoles,
    summary: input.summary?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
  }
  await (await dbPromise).put('playerDevelopmentReviews', review)
  return review
}
