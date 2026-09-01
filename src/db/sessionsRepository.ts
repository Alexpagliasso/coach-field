import { sessionSeed } from '../data/sessionSeed'
import type { TrainingSession } from '../types/domain'
import { dbPromise } from './db'

export async function getCurrentSession() {
  return (await dbPromise).get('sessions', sessionSeed.id)
}

export async function saveSession(session: TrainingSession) {
  await (await dbPromise).put('sessions', session)
}
