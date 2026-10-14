import { describe, expect, it } from 'vitest'
import { resolveGroupHierarchy } from '../src/groups/hierarchyNavigation'
import type { StaffContextData } from '../src/cloud/staffRepository'
import type { Group } from '../src/types/staff'

const group: Group = { id: 'group-1', organizationId: 'org-1', teamId: 'team-1', name: 'Rossi', publicVisible: false, active: true, createdAt: '', updatedAt: '' }
const data: StaffContextData = {
  organizations: [{ id: 'org-1', name: 'Grow FC', slug: 'grow-fc', createdAt: '', updatedAt: '' }],
  organizationSeasons: [{ id: 'season-1', organizationId: 'org-1', name: '2026/27', createdAt: '', updatedAt: '' }],
  teams: [{ id: 'team-1', organizationId: 'org-1', seasonId: 'season-1', name: 'Pulcini', createdAt: '', updatedAt: '' }],
  groups: [group], organizationMemberships: [], memberships: [], overrides: [],
}

describe('workspace hierarchy navigation', () => {
  it('builds the canonical WorkGroup to Category path from verified references', () => {
    expect(resolveGroupHierarchy(data, group)).toMatchObject({
      organizationPath: '/app/organizations/org-1',
      seasonPath: '/app/organizations/org-1/seasons/season-1',
      categoryPath: '/app/organizations/org-1/seasons/season-1/teams/team-1',
    })
  })

  it('does not invent a Category route for a legacy group', () => {
    expect(resolveGroupHierarchy(data, { ...group, id: 'legacy', teamId: undefined }).categoryPath).toBeUndefined()
  })

  it('rejects cross-organization team references', () => {
    const foreign = { ...data, teams: [{ ...data.teams[0], organizationId: 'other-org' }] }
    expect(resolveGroupHierarchy(foreign, group).categoryPath).toBeUndefined()
  })
})
