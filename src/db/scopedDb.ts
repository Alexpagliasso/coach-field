import { dbPromise as rawDb } from './db'
import { getLocalGroupBinding } from './localGroupBinding'
import { assertCurrentAccess, belongsToGroup, captureLocalAccess } from './localAccess'
import type { Permission } from '../auth/permissions'

const readPermission: Record<string, Permission> = {
  players: 'players.view', sessions: 'training.view', appState: 'training.view', attendance: 'attendance.view',
  matches: 'matches.view', matchPlayerEvaluations: 'matches.view', trainingTemplates: 'templates.view',
  trainingPlayerEvaluations: 'training.view', observations: 'notes.view', voiceNotes: 'notes.view',
  playerObjectives: 'development.view', playerObjectiveEvidence: 'development.view', playerDevelopmentReviews: 'development.view',
}
const writePermission: Record<string, Permission> = {
  sessions: 'training.edit', appState: 'training.edit', attendance: 'attendance.edit',
  matchPlayerEvaluations: 'matches.evaluate', trainingTemplates: 'templates.edit',
  trainingPlayerEvaluations: 'training.evaluate', playerObjectives: 'development.edit',
  playerObjectiveEvidence: 'development.edit', playerDevelopmentReviews: 'development.edit',
}
// idb exposes dynamic transaction/store methods. Keep dynamic dispatch confined to this adapter.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Dynamic = any
async function openScopedDatabase() {
  const access = captureLocalAccess()
  const db = await rawDb
  const binding = await getLocalGroupBinding()
  const check = () => {
    assertCurrentAccess(access)
    if (binding?.groupId !== access.groupId) throw new Error('Dataset locale non associato a questo gruppo.')
  }
  check()
  const visible = (row: Dynamic) => belongsToGroup(row, access.groupId, binding?.groupId)
  const wrap = (target: Dynamic, store?: string): Dynamic => new Proxy(target, {
    get(object, key) {
      if (key === 'store') return wrap(object.store, object.store.name)
      if (key === 'objectStore') return (name: string) => wrap(object.objectStore(name), name)
      const value = object[key]
      if (typeof value !== 'function') return value
      if (key === 'transaction') return (...args: Dynamic[]) => { check(); return wrap(value.apply(object, args)) }
      if (key === 'index') return (name: string) => wrap(value.call(object, name), store)
      return async (...args: Dynamic[]) => {
        check()
        const name = store ?? args[0]
        const params = store ? args : args.slice(1)
        const method = String(key)
        if (['get', 'getAll', 'getFromIndex', 'getAllFromIndex', 'count'].includes(method)) {
          if (!access.permissions[readPermission[name]]) return method.includes('All') ? [] : method === 'count' ? 0 : undefined
          const result = await value.apply(object, args)
          check()
          return Array.isArray(result) ? result.filter(visible) : method === 'count' ? result : visible(result) ? result : undefined
        }
        if (['put', 'add', 'delete', 'clear'].includes(method)) {
          if (method === 'clear') throw new Error('Usare il servizio backup per sostituire il dataset.')
          const rawStore = store ? object : db
          const id = method === 'delete' ? params[0] : params[0].id
          const existing = await (store ? rawStore.get(id) : rawStore.get(name, id))
          check()
          const required: Permission = name === 'players' ? (existing ? 'players.edit' : 'players.create')
            : name === 'matches' ? (existing ? 'matches.edit' : 'matches.create')
            : name === 'observations' || name === 'voiceNotes' ? (method === 'delete' ? 'notes.delete' : 'notes.create')
            : name === 'sessions' && !existing ? 'training.create' : writePermission[name]
          // Phase evaluation is authorized narrowly in its repository, without granting session editing.
          const evaluationWrite = name === 'sessions' && existing && method === 'put' && access.permissions['training.evaluate'] &&
            Object.keys(params[0]).every(field => ['plannedPhases', 'updatedAt', 'groupId'].includes(field) || JSON.stringify(params[0][field]) === JSON.stringify(existing[field]))
          if (!access.permissions[required] && !evaluationWrite) throw new Error('Permesso negato.')
          if (existing && !visible(existing)) throw new Error('Record appartenente a un altro gruppo.')
          if (method !== 'delete') {
            if (params[0].groupId && params[0].groupId !== access.groupId) throw new Error('Gruppo del record non valido.')
            const record = { ...params[0], groupId: access.groupId }
            if (store) args[0] = record; else args[1] = record
          }
        }
        return value.apply(object, args)
      }
    },
  })
  return wrap(db) as Awaited<typeof rawDb>
}
// Capture the active group for each repository call, rather than caching a global database handle.
export const dbPromise = { then: <T, U = never>(resolve: (db: Awaited<typeof rawDb>) => T | PromiseLike<T>, reject?: (reason: unknown) => U | PromiseLike<U>) => openScopedDatabase().then(resolve, reject) }
