import type { StaffContextData } from '../cloud/staffRepository'
import type { Group } from '../types/staff'

export function resolveGroupHierarchy(data: StaffContextData, group?: Group) {
  const organization = data.organizations.find(item => item.id === group?.organizationId)
  const team = data.teams.find(item => item.id === group?.teamId && item.organizationId === group?.organizationId)
  const season = data.organizationSeasons.find(item => item.id === team?.seasonId && item.organizationId === organization?.id)
  const organizationPath = organization ? `/app/organizations/${organization.id}` : undefined
  const seasonPath = organizationPath && season ? `${organizationPath}/seasons/${season.id}` : undefined
  const categoryPath = seasonPath && team ? `${seasonPath}/teams/${team.id}` : undefined
  return { organization, season, team, organizationPath, seasonPath, categoryPath }
}
