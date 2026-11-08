import { requireSupabase } from '../lib/supabase'
import type { CollaboratorPermission, DemoViewerAccess, Group, GroupMembership, Organization, OrganizationMembership, OrganizationSeason, OrganizationStaffGroupAssignment, OrganizationStaffPerson, Team, UserProfile } from '../types/staff'
import { isValidSeason } from '../utils/season'

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
  const [organizations, organizationSeasons, teams, groups, organizationMemberships, memberships, overrides, demoViewerAccesses] = await Promise.all([
    listRows<Organization>('organizations'), listRows<OrganizationSeason>('organization_seasons'), listRows<Team>('teams'),
    listRows<Group>('groups'), listRows<OrganizationMembership>('organization_memberships'), listRows<GroupMembership>('group_memberships'), listRows<CollaboratorPermission>('collaborator_permissions'),
    listRows<DemoViewerAccess>('demo_viewer_access'),
  ])
  return { organizations, organizationSeasons, teams, groups, organizationMemberships, memberships, overrides, demoViewerAccesses }
}
export async function bootstrapOrganization(name: string) {
  const { data, error } = await requireSupabase().rpc('bootstrap_organization', { p_name: name }).single()
  if (error) throw error
  if (!data) throw new Error('Creazione organizzazione non riuscita.')
  return fromRow<Organization>(data)
}
export async function listOrganizationSeasons(organizationId: string) {
  const { data, error } = await requireSupabase().from('organization_seasons').select('*').eq('organization_id', organizationId).order('name')
  if (error) throw error
  return (data ?? []).map(fromRow<OrganizationSeason>)
}
export async function createOrganizationSeason(input: Pick<OrganizationSeason, 'organizationId' | 'name'>) {
  const organizationId = input.organizationId.trim()
  const name = input.name.trim()
  if (!organizationId) throw new Error('Societa non valida.')
  if (!isValidSeason(name)) throw new Error('Stagione non valida.')

  const client = requireSupabase()
  const { data: sessionData } = await client.auth.getSession()
  const { data: auth, error: authError } = await client.auth.getUser()
  if (authError || !auth.user) throw new Error('Sessione autenticata non disponibile. Accedi di nuovo e riprova.')

  const payload = { organization_id: organizationId, name }
  console.debug('[GrowPitch season create]', {
    sessionUserId: sessionData.session?.user?.id ?? null,
    getUserId: auth.user.id,
    hasAccessToken: Boolean(sessionData.session?.access_token),
    organizationId,
    seasonName: name,
  })
  console.debug('[GrowPitch season create:before-insert]', { organizationId, seasonName: name })
  const { data, error } = await client.from('organization_seasons').insert(payload).select('*').single()
  console.debug('[GrowPitch season create:insert-result]', error ? {
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
  } : { seasonId: data?.id ?? null, organizationId: data?.organization_id ?? null, seasonName: data?.name ?? null })
  if (error) throw error
  console.debug('[GrowPitch season create:after-insert]', { seasonId: data.id })
  return fromRow<OrganizationSeason>(data)
}
export async function listTeams(seasonId: string) {
  const { data, error } = await requireSupabase().from('teams').select('*').eq('season_id', seasonId).order('name')
  if (error) throw error
  return (data ?? []).map(fromRow<Team>)
}
export async function createTeam(input: Pick<Team, 'organizationId' | 'seasonId' | 'name'>) {
  const { data, error } = await requireSupabase().from('teams').insert(toRow(input)).select('*').single()
  if (error) throw error
  return fromRow<Team>(data)
}
export async function listOrganizationStaffPeople(organizationId: string) {
  const { data, error } = await requireSupabase().from('organization_staff_people').select('*').eq('organization_id', organizationId).order('last_name').order('first_name')
  if (error) throw error
  return (data ?? []).map(fromRow<OrganizationStaffPerson>)
}
export async function saveOrganizationStaffPerson(input: Pick<OrganizationStaffPerson, 'organizationId' | 'firstName' | 'lastName' | 'intendedRole'> & { id?: string }) {
  const payload = toRow({ organizationId: input.organizationId, firstName: input.firstName.trim(), lastName: input.lastName.trim(), intendedRole: input.intendedRole })
  const query = input.id
    ? requireSupabase().from('organization_staff_people').update(payload).eq('id', input.id).eq('organization_id', input.organizationId)
    : requireSupabase().from('organization_staff_people').insert(payload)
  const { data, error } = await query.select('*').single()
  if (error) throw error
  return fromRow<OrganizationStaffPerson>(data)
}
export async function listOrganizationStaffGroupAssignments(organizationId: string) {
  const { data, error } = await requireSupabase().from('organization_staff_group_assignments').select('*').eq('organization_id', organizationId).order('created_at')
  if (error) throw error
  return (data ?? []).map(fromRow<OrganizationStaffGroupAssignment>)
}
export async function saveOrganizationStaffGroupAssignment(input: Pick<OrganizationStaffGroupAssignment, 'organizationId' | 'staffPersonId' | 'groupId' | 'intendedRole'> & { id?: string }) {
  const { data, error } = await requireSupabase().rpc('save_staff_group_assignment', { p_id: input.id ?? null, p_organization_id: input.organizationId, p_staff_person_id: input.staffPersonId, p_group_id: input.groupId, p_role: input.intendedRole }).single()
  if (error) throw error
  return fromRow<OrganizationStaffGroupAssignment>(data)
}
export async function deleteOrganizationStaffGroupAssignment(input: Pick<OrganizationStaffGroupAssignment, 'id' | 'organizationId' | 'staffPersonId'>) {
  const { error } = await requireSupabase().rpc('delete_staff_group_assignment', { p_id: input.id, p_organization_id: input.organizationId, p_staff_person_id: input.staffPersonId })
  if (error) throw error
}
export async function createStaffAccountLinkInvitation(organizationId: string, staffPersonId: string) {
  const { data, error } = await requireSupabase().rpc('create_staff_account_link_invitation', { p_organization_id: organizationId, p_staff_person_id: staffPersonId })
  if (error) throw error
  return String(data)
}
export async function acceptStaffAccountLink(token: string) {
  const { data, error } = await requireSupabase().rpc('accept_staff_account_link', { p_token: token })
  if (error) throw error
  return String(data)
}
export async function revokeStaffAccountLink(organizationId: string, staffPersonId: string) {
  const { error } = await requireSupabase().rpc('revoke_staff_account_link', { p_organization_id: organizationId, p_staff_person_id: staffPersonId })
  if (error) throw error
}
export type StaffContextData = Awaited<ReturnType<typeof loadStaffContext>>
export async function getProfile(id: string) {
  const { data, error } = await requireSupabase().from('profiles').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  if (!data) throw new Error('Profilo staff mancante. Contatta un amministratore.')
  return fromRow<UserProfile>(data)
}
export async function saveGroup(group: Partial<Group> & Pick<Group, 'organizationId' | 'name'>) {
  const row = toRow(group)
  const query = group.id
    ? requireSupabase().from('groups').update(row).eq('id', group.id)
    : requireSupabase().from('groups').insert(row)
  const { error } = await query
  if (error) throw error
}
export type GroupDependencyAudit = {
  groupId: string; organizationId: string; groupName: string; legacySeason?: string | null
  teamId?: string | null; teamName?: string | null; seasonId?: string | null; seasonName?: string | null; active: boolean
  staffMemberships: number; playerMemberships: number; playerAssignments: number; trainingSessions: number
  matches: number; familyPublications: number; sourceMatchCallups: number; canDelete: boolean
}
export async function getOrganizationGroupDependencyAudit(organizationId: string) {
  const { data, error } = await requireSupabase().rpc('get_organization_group_dependency_audit', { p_organization_id: organizationId })
  if (error) throw error
  return (data ?? []).map(fromRow<GroupDependencyAudit>)
}
export async function getCurrentUserSuperadminStatus() {
  const { data, error } = await requireSupabase().rpc('current_user_is_superadmin')
  if (error) throw error
  return data === true
}
export async function deleteEmptyOrganizationGroup(input: { organizationId: string; groupId: string; confirmationName: string }) {
  const { data, error } = await requireSupabase().rpc('delete_empty_organization_group', {
    p_organization_id: input.organizationId,
    p_group_id: input.groupId,
    p_confirmation_name: input.confirmationName,
  })
  if (error) throw error
  return String(data)
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
