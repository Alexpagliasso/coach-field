import { requireLocalPermission } from './localAccess'
import type { AppMetaState, AppState } from '../types/domain'
import { dbPromise } from './scopedDb'

export async function getAppState() {
  return (await dbPromise).get('appState', 'current') as Promise<AppState | undefined>
}

export async function saveAppState(state: AppState) {
  requireLocalPermission('training.edit')
  await (await dbPromise).put('appState', state)
}

export async function getPlayerSeedVersion() {
  return (await dbPromise).get('appState', 'playerSeedVersion') as Promise<AppMetaState | undefined>
}
