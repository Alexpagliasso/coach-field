import { createContext, useContext } from 'react'
import type { StaffContextData } from '../cloud/staffRepository'
import type { Group, GroupMembership, StaffRole } from '../types/staff'
import type { Permissions } from '../auth/permissions'
export type GroupState = { data: StaffContextData; loading: boolean; error: string; availableGroups: Group[]; activeGroup?: Group; membership?: GroupMembership; role?: StaffRole; permissions: Permissions; reload: () => Promise<void>; switchGroup: (id: string) => void }
export const GroupContext = createContext<GroupState | undefined>(undefined)
export function useGroup() { const value = useContext(GroupContext); if (!value) throw new Error('GroupProvider mancante'); return value }
export function usePermissions() { const { permissions, role } = useGroup(); return { can: (key: keyof Permissions) => permissions[key], role, isAdmin: role === 'admin', isCoach: role === 'coach', isCollaborator: role === 'collaborator' } }
