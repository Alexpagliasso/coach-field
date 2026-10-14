import { requireSupabase } from '../lib/supabase'
import type { CollaboratorPermission, Group, GroupMembership, Organization, OrganizationMembership, OrganizationSeason, Team, UserProfile } from '../types/staff'
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
  const [organizations, organizationSeasons, teams, groups, organizationMemberships, memberships, overrides] = await Promise.all([
    listRows<Organization>('organizations'), listRows<OrganizationSeason>('organization_seasons'), listRows<Team>('teams'),
    listRows<Group>('groups'), listRows<OrganizationMembership>('organization_memberships'), listRows<GroupMembership>('group_memberships'), listRows<CollaboratorPermission>('collaborator_permissions'),
  ])
  return { organizations, organizationSeasons, teams, groups, organizationMemberships, memberships, overrides }
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
