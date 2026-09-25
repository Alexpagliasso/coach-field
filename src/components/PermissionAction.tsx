import type { ReactNode } from 'react'
import type { Permission } from '../auth/permissions'
import { usePermissions } from '../groups/groupContext'
export function PermissionAction({ permission, children }: { permission: Permission; children: ReactNode }) {
  const { can } = usePermissions()
  return can(permission) ? children : null
}
