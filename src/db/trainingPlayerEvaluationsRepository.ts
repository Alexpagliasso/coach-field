import { requireLocalPermission } from './localAccess'
import type { TrainingPlayerEvaluation } from '../types/domain'
import { dbPromise } from './scopedDb'
import { makeId } from './db'

export async function getTrainingPlayerEvaluations() {
  const evaluations = await (await dbPromise).getAll('trainingPlayerEvaluations')
  return evaluations.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function getTrainingPlayerEvaluationsBySession(sessionId: string) {
  const evaluations = await (await dbPromise).getAllFromIndex('trainingPlayerEvaluations', 'by-session', sessionId)
  return evaluations.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export async function getTrainingPlayerEvaluationsByPlayer(playerId: string) {
  const evaluations = await (await dbPromise).getAllFromIndex('trainingPlayerEvaluations', 'by-player', playerId)
  return evaluations.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function getTrainingPlayerEvaluationBySessionAndPlayer(sessionId: string, playerId: string) {
  return (await dbPromise).getFromIndex('trainingPlayerEvaluations', 'by-session-player', [sessionId, playerId])
}

export async function upsertTrainingPlayerEvaluation(
  sessionId: string,
  playerId: string,
  patch: Partial<Omit<TrainingPlayerEvaluation, 'id' | 'sessionId' | 'playerId' | 'createdAt'>>,
) {
  requireLocalPermission('training.evaluate')
  const db = await dbPromise
  const existing = await db.getFromIndex('trainingPlayerEvaluations', 'by-session-player', [sessionId, playerId])
  const now = new Date().toISOString()
  const next: TrainingPlayerEvaluation = existing
    ? { ...existing, ...patch, updatedAt: now }
    : {
      id: makeId(),
      sessionId,
      playerId,
      rating: null,
      rolesTried: [],
      positiveTags: [],
      attentionTags: [],
      createdAt: now,
      updatedAt: now,
      ...patch,
    }
  await db.put('trainingPlayerEvaluations', next)
  return next
}

export async function updateTrainingPlayerEvaluation(
  id: string,
  patch: Partial<Omit<TrainingPlayerEvaluation, 'id' | 'sessionId' | 'playerId' | 'createdAt'>>,
) {
  const db = await dbPromise
  const current = await db.get('trainingPlayerEvaluations', id)
  if (!current) return undefined
  const next: TrainingPlayerEvaluation = { ...current, ...patch, updatedAt: new Date().toISOString() }
  await db.put('trainingPlayerEvaluations', next)
  return next
}
