import type { AppMetaState, AppState } from '../types/domain'
import { dbPromise } from './db'

export async function getAppState() {
  return (await dbPromise).get('appState', 'current') as Promise<AppState | undefined>
}

export async function saveAppState(state: AppState) {
  await (await dbPromise).put('appState', state)
}

export async function getPlayerSeedVersion() {
  return (await dbPromise).get('appState', 'playerSeedVersion') as Promise<AppMetaState | undefined>
}
