import { beforeEach, describe, expect, it, vi } from 'vitest'

const { rpc, single } = vi.hoisted(() => ({ rpc: vi.fn(), single: vi.fn() }))

vi.mock('../src/lib/supabase', () => ({
  requireSupabase: () => ({ rpc }),
}))

import { archiveOrganizationPlayer, assignTeamRosterPlayersToWorkGroup, createWorkGroupRosterPlayer, deleteOrganizationPlayer, removeTeamRosterPlayer, setTeamRosterPlayerGroup } from '../src/cloud/playerCloudRepository'

describe('setTeamRosterPlayerGroup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rpc.mockReturnValue({ single })
  })

  it.each([
    ['assigned', 'assignment-1', null],
    ['changed', 'assignment-2', 'assignment-1'],
    ['removed', null, 'assignment-2'],
    ['unchanged', 'assignment-2', null],
  ] as const)('returns a typed %s RPC result', async (operation, assignmentId, previousAssignmentId) => {
    single.mockResolvedValue({
      data: { assignment_id: assignmentId, previous_assignment_id: previousAssignmentId, operation },
      error: null,
    })

    await expect(setTeamRosterPlayerGroup('membership-1', operation === 'removed' ? null : 'group-1')).resolves.toEqual({
      assignmentId,
      previousAssignmentId,
      operation,
    })
    expect(rpc).toHaveBeenCalledWith('set_team_roster_player_group', {
      p_team_player_membership_id: 'membership-1',
      p_group_id: operation === 'removed' ? null : 'group-1',
    })
  })

  it('propagates an RPC error without fallback writes', async () => {
    const rpcError = { message: 'Permission denied', code: '42501' }
    single.mockResolvedValue({ data: null, error: rpcError })

    await expect(setTeamRosterPlayerGroup('membership-1', 'group-1')).rejects.toBe(rpcError)
    expect(rpc).toHaveBeenCalledTimes(1)
  })
})

describe('player lifecycle RPCs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rpc.mockReturnValue({ single })
  })

  it('removes a membership through the dedicated RPC', async () => {
    single.mockResolvedValue({ data: { membership_id: 'membership-1', ended_assignment_count: 2, operation: 'removed' }, error: null })
    await expect(removeTeamRosterPlayer('membership-1')).resolves.toEqual({ membershipId: 'membership-1', endedAssignmentCount: 2, operation: 'removed' })
    expect(rpc).toHaveBeenCalledWith('remove_team_roster_player', { p_team_player_membership_id: 'membership-1' })
  })

  it('archives and deletes through organization-scoped RPCs', async () => {
    single
      .mockResolvedValueOnce({ data: { player_id: 'player-1', operation: 'archived' }, error: null })
      .mockResolvedValueOnce({ data: { player_id: 'player-1', deleted_membership_count: 1, deleted_assignment_count: 2, operation: 'deleted' }, error: null })
    await expect(archiveOrganizationPlayer('player-1', 'organization-1')).resolves.toEqual({ playerId: 'player-1', operation: 'archived' })
    await expect(deleteOrganizationPlayer('player-1', 'organization-1')).resolves.toEqual({ playerId: 'player-1', deletedMembershipCount: 1, deletedAssignmentCount: 2, operation: 'deleted' })
    expect(rpc).toHaveBeenNthCalledWith(1, 'archive_organization_player', { p_player_id: 'player-1', p_organization_id: 'organization-1' })
    expect(rpc).toHaveBeenNthCalledWith(2, 'delete_organization_player', { p_player_id: 'player-1', p_organization_id: 'organization-1' })
  })

  it('propagates a missing-RPC error without fallback deletes', async () => {
    const rpcError = { message: 'Could not find the function in the schema cache', code: 'PGRST202' }
    single.mockResolvedValue({ data: null, error: rpcError })
    await expect(deleteOrganizationPlayer('player-1', 'organization-1')).rejects.toBe(rpcError)
    expect(rpc).toHaveBeenCalledTimes(1)
  })
})

describe('workgroup roster creation', () => {
  beforeEach(() => { vi.clearAllMocks(); rpc.mockReturnValue({ single }) })
  it('uses one atomic cloud RPC tied to the current WorkGroup', async () => {
    single.mockResolvedValue({ data: { player_id: 'player-1', membership_id: 'membership-1', assignment_id: 'assignment-1' }, error: null })
    await expect(createWorkGroupRosterPlayer({ organizationId: 'org-1', teamId: 'team-1', groupId: 'group-a', firstName: 'Ada', lastName: 'Rossi', birthYear: 2016 }))
      .resolves.toEqual({ playerId: 'player-1', membershipId: 'membership-1', assignmentId: 'assignment-1' })
    expect(rpc).toHaveBeenCalledWith('create_workgroup_roster_player', expect.objectContaining({
      p_organization_id: 'org-1', p_team_id: 'team-1', p_group_id: 'group-a', p_first_name: 'Ada', p_last_name: 'Rossi', p_birth_year: 2016,
    }))
    expect(rpc.mock.calls[0][1]).not.toHaveProperty('p_player_id')
  })
})

describe('batch WorkGroup roster assignment', () => {
  beforeEach(() => { vi.clearAllMocks(); rpc.mockReturnValue({ single }) })
  it('assigns selected category memberships through the atomic RPC', async () => {
    single.mockResolvedValue({ data: { assigned_count: 2, moved_count: 1 }, error: null })
    await expect(assignTeamRosterPlayersToWorkGroup('group-a', ['membership-1', 'membership-2'])).resolves.toEqual({ assignedCount: 2, movedCount: 1 })
    expect(rpc).toHaveBeenCalledWith('assign_team_roster_players_to_workgroup', { p_group_id: 'group-a', p_team_player_membership_ids: ['membership-1', 'membership-2'] })
  })
})
