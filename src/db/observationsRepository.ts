import { requireLocalPermission } from './localAccess'
import type { Observation, ObservationCategory } from '../types/domain'
import { dbPromise } from './scopedDb'
import { makeId } from './db'

type AddObservationInput = {
  playerId: string
  sessionId: string
  phaseId?: string
  category: ObservationCategory
  value: 'positive' | 'attention'
  note?: string
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
  return observations.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function getObservationsByPlayer(playerId: string) {
  const observations = await (await dbPromise).getAllFromIndex('observations', 'by-player', playerId)
  return observations.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function deleteObservation(id: string) {
  requireLocalPermission('notes.delete')
  await (await dbPromise).delete('observations', id)
}
