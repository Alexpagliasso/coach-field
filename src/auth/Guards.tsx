import { useEffect, useState, type ReactNode } from 'react'
import { Link, Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './authContext'
import { useGroup, usePermissions } from '../groups/groupContext'
import type { Permission } from './permissions'
import { bindLocalDataset, getLocalGroupBinding, type LocalGroupBinding } from '../db/localGroupBinding'
import { clearLocalAccess, setLocalAccess } from '../db/localAccess'
import { initializeDatabase } from '../db/db'
import { errorMessage } from '../lib/supabase'

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
export function LocalDataGuard() {
  const { activeGroup, permissions } = useGroup()
  const { user } = useAuth()
  // Stable serialized permissions avoid opening/closing the dataset on unrelated renders.
  const permissionKey = JSON.stringify(permissions)
  const contextKey = `${activeGroup?.id}:${user?.id}:${permissionKey}`
  const [state, setState] = useState<{ ready: boolean; contextKey?: string; binding?: LocalGroupBinding; error?: string }>({ ready: false })
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let alive = true
    clearLocalAccess()
    getLocalGroupBinding().then(async binding => {
      if (!alive) return
      if (activeGroup && binding?.groupId === activeGroup.id && user) {
        await initializeDatabase()
        if (!alive) return
        setLocalAccess({ groupId: activeGroup.id, userId: user.id, permissions: JSON.parse(permissionKey) })
      }
      if (alive) setState({ ready: true, contextKey, binding })
    }).catch(error => { if (alive) setState({ ready: true, contextKey, error: errorMessage(error) }) })
    return () => { alive = false; clearLocalAccess() }
  }, [activeGroup, user, permissionKey, contextKey, revision])
  useEffect(() => {
    const restored = () => { clearLocalAccess(); setState({ ready: false }); setRevision(value => value + 1) }
    window.addEventListener('local-data-restored', restored)
    return () => window.removeEventListener('local-data-restored', restored)
  }, [])
  if (!state.ready || state.contextKey !== contextKey) return <p className="page">Apertura dati locali…</p>
  if (state.error) return <p className="page" role="alert">{state.error}</p>
  if (state.binding?.groupId === activeGroup?.id) return <Outlet />
  return <section className="page"><h2>Dati locali</h2>
    <p>{state.binding ? 'Nessun dato locale per questo gruppo. Il dataset del dispositivo appartiene a un altro gruppo.' : 'Dataset locale non associato. Eventuali dati esistenti saranno visibili solo nel gruppo scelto.'}</p>
    {!state.binding && permissions['group.settings'] && <button className="primary-action" onClick={async () => {
      if (!activeGroup || !user || !window.confirm(`Associare il dataset locale a ${activeGroup.name}? Verifica che sia la squadra corretta.`)) return
      try { await bindLocalDataset(activeGroup.id, user.id, permissions); setRevision(value => value + 1) }
      catch (error) { setState({ ready: true, contextKey, error: errorMessage(error) }) }
    }}>Associa al gruppo attuale</button>}
    <Link to="/app/groups">Non ora · Cambia gruppo</Link>
  </section>
}
