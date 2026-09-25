import { describe, expect, it } from 'vitest'
import { NON_DELEGABLE, PERMISSIONS, resolvePermissions } from '../src/auth/permissions'
import { groupRole } from '../src/groups/access'
import type { StaffContextData } from '../src/cloud/staffRepository'
import type { Group } from '../src/types/staff'
describe('permissions', () => {
  it.each(['admin', 'coach'] as const)('%s has all group permissions', role => {
    expect(PERMISSIONS.every(permission => resolvePermissions({ role })[permission])).toBe(true)
  })
  it('defaults deny editing and development; allow basic reads and notes', () => {
    const permissions = resolvePermissions({ role: 'collaborator' })
    expect(permissions['players.view']).toBe(true)
    expect(permissions['notes.create']).toBe(true)
    expect(permissions['attendance.edit']).toBe(false)
    expect(permissions['development.view']).toBe(false)
    expect(Object.values(resolvePermissions({})).every(value => !value)).toBe(true)
  })
  it('supports positive and negative overrides but never structural delegation', () => {
    const permissions = resolvePermissions({ role: 'collaborator', overrides: [
      { permission: 'training.evaluate', enabled: true }, { permission: 'players.view', enabled: false },
      ...NON_DELEGABLE.map(permission => ({ permission, enabled: true })),
    ] })
    expect(permissions['training.evaluate']).toBe(true)
    expect(permissions['players.view']).toBe(false)
    expect(NON_DELEGABLE.every(permission => !permissions[permission])).toBe(true)
  })
})
describe('group access', () => {
  const group = { id: 'A', organizationId: 'org', active: true } as Group
  const data = { groups: [group], organizations: [], overrides: [], organizationMemberships: [], memberships: [{ id: 'm', groupId: 'A', organizationId: 'org', userId: 'u', role: 'coach', active: true }] } as StaffContextData
  it('denies another group and inactive membership/group', () => {
    expect(groupRole(data, 'u', group)).toBe('coach')
    expect(groupRole(data, 'u', { ...group, id: 'B' })).toBeUndefined()
    expect(groupRole(data, 'u', { ...group, active: false })).toBeUndefined()
    expect(groupRole({ ...data, memberships: [{ ...data.memberships[0], active: false }] }, 'u', group)).toBeUndefined()
  })
  it('admin accesses organization groups without group membership, including inactive groups', () => {
    const adminData = { ...data, memberships: [], organizationMemberships: [{ id: 'a', organizationId: 'org', userId: 'a', role: 'admin' as const, active: true }] }
    expect(groupRole(adminData, 'a', { ...group, active: false })).toBe('admin')
    expect(groupRole(adminData, 'a', { ...group, organizationId: 'other' })).toBeUndefined()
  })
})
