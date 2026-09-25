import type { StaffRole } from '../types/staff'

export const PERMISSIONS = [
  'players.view', 'players.create', 'players.edit', 'attendance.view', 'attendance.edit',
  'training.view', 'training.create', 'training.edit', 'training.evaluate',
  'matches.view', 'matches.create', 'matches.edit', 'matches.evaluate',
  'development.view', 'development.edit', 'templates.view', 'templates.edit',
  'notes.view', 'notes.create', 'notes.delete', 'staff.view', 'staff.manage', 'group.settings', 'data.manage',
] as const
export type Permission = typeof PERMISSIONS[number]
export type Permissions = Record<Permission, boolean>
export const NON_DELEGABLE: readonly Permission[] = ['staff.manage', 'group.settings', 'data.manage']
const collaboratorDefaults: readonly Permission[] = ['players.view', 'attendance.view', 'training.view', 'matches.view', 'templates.view', 'notes.view', 'notes.create']
export function resolvePermissions({ role, overrides = [] }: { role?: StaffRole; overrides?: readonly { permission: string; enabled: boolean }[] }): Permissions {
  return Object.fromEntries(PERMISSIONS.map(permission => [permission,
    role === 'admin' || role === 'coach' || (role === 'collaborator' && !NON_DELEGABLE.includes(permission) &&
      (overrides.find(item => item.permission === permission)?.enabled ?? collaboratorDefaults.includes(permission))),
  ])) as Permissions
}
