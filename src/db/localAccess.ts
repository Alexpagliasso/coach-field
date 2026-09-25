import type { Permissions, Permission } from '../auth/permissions'
export type LocalAccess = { groupId: string; userId: string; permissions: Permissions }
let current: LocalAccess | undefined
export function setLocalAccess(value: LocalAccess) { current = value }
export function clearLocalAccess() { current = undefined }
export function captureLocalAccess() { if (!current) throw new Error('Dati locali non disponibili per questo gruppo.'); return current }
export function assertCurrentAccess(access: LocalAccess) { if (current !== access) throw new Error('Contesto cambiato. Riapri la pagina.'); return access }
export function requireLocalPermission(permission: Permission) { const access = captureLocalAccess(); if (!access.permissions[permission]) throw new Error('Permesso negato.'); return access }
export function matchesRequestedGroup(groupId?: string) { return !groupId || captureLocalAccess().groupId === groupId }
export function belongsToGroup(record: { groupId?: string } | undefined, groupId: string, boundGroupId?: string) {
  return Boolean(record && groupId === boundGroupId && (!record.groupId || record.groupId === groupId))
}
