import type { StaffContextData } from '../cloud/staffRepository'
import type { Group, StaffRole } from '../types/staff'
export function groupRole(data: StaffContextData, userId: string, group: Group): StaffRole | undefined {
  if (data.organizationMemberships.some(item => item.userId === userId && item.organizationId === group.organizationId && item.active && item.role === 'admin')) return 'admin'
  if (!group.active) return undefined
  return data.memberships.find(item => item.groupId === group.id && item.organizationId === group.organizationId && item.userId === userId && item.active)?.role
}
