export type StaffRole = 'admin' | 'coach' | 'collaborator'
export type Organization = { id: string; name: string; slug: string; logoUrl?: string; description?: string; createdAt: string; updatedAt: string }
export type Group = { id: string; organizationId: string; name: string; season?: string; description?: string; yearFrom?: number; yearTo?: number; publicVisible: boolean; active: boolean; createdAt: string; updatedAt: string }
export type UserProfile = { id: string; email: string; firstName?: string; lastName?: string; avatarUrl?: string; createdAt: string; updatedAt: string }
export type OrganizationMembership = { id: string; organizationId: string; userId: string; role: 'admin'; active: boolean }
export type GroupMembership = { id: string; organizationId: string; groupId: string; userId: string; role: 'coach' | 'collaborator'; active: boolean; createdAt: string; updatedAt: string }
export type CollaboratorPermission = { id: string; membershipId: string; permission: string; enabled: boolean; createdAt: string; updatedAt: string }
