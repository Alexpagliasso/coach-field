import { requireLocalPermission } from './localAccess'
import type { CorrectionResponse, LegacyObservationCategory, Observation, ObservationCategory, ObservationContextType, ObservationSentiment, ObservationStatus, ObservationSubjectType } from '../types/domain'
import { dbPromise } from './scopedDb'
import { makeId } from './db'

type AddObservationInput = {
  playerId: string
  sessionId: string
  phaseId?: string
  category: LegacyObservationCategory
  value: 'positive' | 'attention'
  note?: string
}


export type CreateObservationInput = {
  text: string
  subjectType: ObservationSubjectType
  playerId?: string
  contextType: ObservationContextType
  matchId?: string
  sessionId?: string
  phaseId?: string
  exerciseId?: string
  category?: ObservationCategory
  sentiment?: ObservationSentiment
  correction?: string
  response?: CorrectionResponse
}

const legacyCategory: Record<LegacyObservationCategory, ObservationCategory> = {
  technique: 'technical', game: 'tactical', attitude: 'attitude', relationship: 'behaviour', goalkeeper: 'technical',
}

export function normalizeObservation(item: Observation): Observation {
  const category = item.category && item.category in legacyCategory ? legacyCategory[item.category as LegacyObservationCategory] : item.category
  return {
    ...item,
    text: item.text ?? item.note ?? '',
    subjectType: item.subjectType ?? (item.playerId ? 'player' : 'team'),
    contextType: item.contextType ?? (item.matchId ? 'match' : item.sessionId ? 'training' : 'general'),
    category,
    sentiment: item.sentiment ?? (item.value === 'positive' ? 'positive' : item.value === 'attention' ? 'concern' : undefined),
    status: item.status ?? 'reviewed',
    updatedAt: item.updatedAt ?? item.createdAt,
  }
}

export async function createObservation(input: CreateObservationInput) {
  requireLocalPermission('notes.create')
  const text = input.text.trim()
  if (!text) throw new Error('Scrivi una osservazione.')
  if (input.subjectType === 'player' && !input.playerId) throw new Error('Seleziona un giocatore.')
  if (input.contextType === 'match' && !input.matchId) throw new Error('Partita mancante.')
  if (input.contextType === 'training' && !input.sessionId) throw new Error('Allenamento mancante.')
  const now = new Date().toISOString()
  const observation: Observation = { id: makeId(), createdAt: now, updatedAt: now, status: 'inbox', ...input, text }
  await (await dbPromise).put('observations', observation)
  return observation
}

export async function addObservation(input: AddObservationInput) {
  requireLocalPermission('notes.create')
  const observation: Observation = {
    id: makeId(),
    createdAt: new Date().toISOString(),
    ...input,
  }
  await (await dbPromise).put('observations', observation)
  return observation
}

export async function getObservations() {
  const observations = await (await dbPromise).getAll('observations')
  return observations.map(normalizeObservation).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function getObservationsByPlayer(playerId: string) {
  const observations = await (await dbPromise).getAllFromIndex('observations', 'by-player', playerId)
  return observations.map(normalizeObservation).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function updateObservationStatus(id: string, status: ObservationStatus) {
  requireLocalPermission('notes.create')
  const db = await dbPromise
  const current = await db.get('observations', id)
  if (!current) return undefined
  const next = { ...current, status, updatedAt: new Date().toISOString() }
  await db.put('observations', next)
  return normalizeObservation(next)
}

export async function deleteObservation(id: string) {
  requireLocalPermission('notes.delete')
  await (await dbPromise).delete('observations', id)
}
