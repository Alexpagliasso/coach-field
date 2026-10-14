import { type ReactNode } from 'react'
import { Link, Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './authContext'
import { useGroup, usePermissions } from '../groups/groupContext'
import type { Permission } from './permissions'

export function ProtectedRoute() {
  const auth = useAuth()
  if (auth.loading) return <p className="page">Caricamento sessione…</p>
  if (auth.error && auth.user) return <section className="page"><p role="alert">{auth.error}</p><button onClick={() => void auth.signOut()}>Torna al login</button></section>
  return auth.isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />
}
export function GroupAccessGuard() {
  const { loading, error, activeGroup } = useGroup()
  if (loading) return <p className="page">Caricamento gruppi…</p>
  if (error) return <section className="page"><p role="alert">{error}</p><Link to="/app/groups">Torna ai gruppi</Link></section>
  return activeGroup ? <Outlet key={activeGroup.id} /> : <section className="page"><p>Gruppo non disponibile o accesso negato.</p><Link to="/app/groups">Scegli un gruppo</Link></section>
}
export function PermissionGuard({ permission, children }: { permission: Permission; children?: ReactNode }) {
  const { can } = usePermissions()
  return can(permission) ? children ?? <Outlet /> : <p className="page" role="alert">Permesso negato.</p>
}
