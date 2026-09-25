import { requireSupabase } from '../lib/supabase'
import type { CollaboratorPermission, Group, GroupMembership, Organization, OrganizationMembership, UserProfile } from '../types/staff'

// Postgres uses snake_case; the application domain consistently uses camelCase.
export function fromRow<T>(row: unknown): T {
  return Object.fromEntries(Object.entries(row as Record<string, unknown>).map(([key, value]) => [key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase()), value])) as T
}
function toRow(row: object) { return Object.fromEntries(Object.entries(row).map(([key, value]) => [key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`), value])) }
export async function listRows<T>(table: string): Promise<T[]> {
  const { data, error } = await requireSupabase().from(table).select('*')
  if (error) throw error
  return (data ?? []).map(fromRow<T>)
}
export async function loadStaffContext() {
  const [organizations, groups, organizationMemberships, memberships, overrides] = await Promise.all([
    listRows<Organization>('organizations'), listRows<Group>('groups'), listRows<OrganizationMembership>('organization_memberships'),
    listRows<GroupMembership>('group_memberships'), listRows<CollaboratorPermission>('collaborator_permissions'),
  ])
  return { organizations, groups, organizationMemberships, memberships, overrides }
}
export type StaffContextData = Awaited<ReturnType<typeof loadStaffContext>>
export async function getProfile(id: string) {
  const { data, error } = await requireSupabase().from('profiles').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  if (!data) throw new Error('Profilo staff mancante. Contatta un amministratore.')
  return fromRow<UserProfile>(data)
}
export async function saveGroup(group: Partial<Group> & Pick<Group, 'organizationId' | 'name'>) {
  const { error } = await requireSupabase().from('groups').upsert(toRow(group))
  if (error) throw error
}
export async function assignStaff(group: Group, email: string, role: 'coach' | 'collaborator') {
  const { error } = await requireSupabase().rpc('assign_group_staff', { target_group: group.id, target_email: email.trim(), target_role: role })
  if (error) throw error
}
export async function updateMembership(id: string, active: boolean) {
  const { error } = await requireSupabase().from('group_memberships').update({ active }).eq('id', id)
  if (error) throw error
}
export async function setPermission(membershipId: string, permission: string, enabled: boolean) {
  const { error } = await requireSupabase().from('collaborator_permissions').upsert({ membership_id: membershipId, permission, enabled }, { onConflict: 'membership_id,permission' })
  if (error) throw error
}
