import { dbPromise } from './db'
import type { Permissions } from '../auth/permissions'
export type LocalGroupBinding = { id: 'localGroupBinding'; groupId: string; boundAt: string; boundBy: string }
export async function getLocalGroupBinding() { return (await dbPromise).get('appState', 'localGroupBinding') as Promise<LocalGroupBinding | undefined> }
// The caller must have group.settings. A single read/write transaction prevents competing tabs rebinding.
export async function bindLocalDataset(groupId: string, userId: string, permissions: Permissions) {
  if (!permissions['group.settings']) throw new Error('Permesso negato.')
  if (!groupId || !userId) throw new Error('Gruppo o utente mancante.')
  const tx = (await dbPromise).transaction('appState', 'readwrite')
  const existing = await tx.store.get('localGroupBinding') as LocalGroupBinding | undefined
  if (existing && existing.groupId !== groupId) {
    tx.abort()
    await tx.done.catch(() => undefined)
    throw new Error('Il dataset è già associato a un altro gruppo.')
  }
  await tx.store.put({ id: 'localGroupBinding', groupId, boundAt: new Date().toISOString(), boundBy: userId })
  await tx.done
}
