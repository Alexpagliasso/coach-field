import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { APP_NAME } from '../brand'
import { useAuth } from '../auth/authContext'
import { useGroup } from '../groups/groupContext'
import { groupRole } from '../groups/access'
import { errorMessage, supabase } from '../lib/supabase'
export function PublicHome() {
  const [groups, setGroups] = useState<Array<{ id: string; name: string; season: string; organization_name: string; description: string }>>([])
  const [error, setError] = useState('')
  useEffect(() => {
    if (!supabase) return
    let alive = true
    supabase.rpc('public_group_directory').then(({ data, error }) => {
      if (!alive) return
      if (error) setError('Elenco gruppi momentaneamente non disponibile.'); else setGroups(data ?? [])
    })
    return () => { alive = false }
  }, [])
  return <main className="page access-page"><header><strong>{APP_NAME}</strong><Link to="/login">AREA STAFF</Link></header>
    <section><h1>Il lavoro di squadra comincia sul campo.</h1><p>Uno spazio per la società e il suo staff tecnico.</p></section>
    <section><h2>Società</h2><p>Organizzazione, gruppi e percorsi sportivi.</p></section>
    <section><h2>Gruppi</h2>{error && <p role="status">{error}</p>}{groups.map(group => <article className="list-card" key={group.id}><div><strong>{group.name}</strong><p>{group.organization_name} · {group.season}</p><p>{group.description}</p></div></article>)}{groups.length === 0 && <p>Nessun gruppo pubblico da mostrare.</p>}</section>
    <section><h2>Area staff</h2><p>Accedi per lavorare con i gruppi assegnati.</p><Link className="primary-action" to="/login">AREA STAFF</Link></section>
  </main>
}
export function LoginPage() {
  const auth = useAuth()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  if (auth.isAuthenticated) return <Navigate to="/app/groups" replace />
  return <main className="page access-page"><Link to="/">{APP_NAME}</Link><h1>Login staff</h1>
    {!supabase && <p role="alert">Supabase non configurato. Impostare VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.</p>}
    {(error || auth.error) && <p role="alert">{error || auth.error}</p>}
    <form onSubmit={async event => { event.preventDefault(); const form = new FormData(event.currentTarget); setBusy(true); setError(''); try { await auth.signIn(String(form.get('email')), String(form.get('password'))) } catch (reason) { setError(errorMessage(reason)) } finally { setBusy(false) } }}>
      <label className="form-field">Email<input name="email" type="email" autoComplete="username" required /></label>
      <label className="form-field">Password<input name="password" type="password" autoComplete="current-password" required /></label>
      <button className="primary-action" disabled={busy || auth.loading || !supabase}>{busy ? 'Accesso…' : 'ACCEDI'}</button>
    </form>
  </main>
}
export function GroupSelectorPage() {
  const { availableGroups, data, loading, error, reload, switchGroup } = useGroup()
  const { user, signOut } = useAuth()
  const isAdmin = data.organizationMemberships.some(item => item.userId === user?.id && item.active)
  return <main className="page access-page"><h1>I tuoi gruppi</h1>
    <button onClick={() => void signOut()}>Esci</button>{isAdmin && <Link to="/admin">Amministrazione</Link>}
    {loading && <p>Caricamento gruppi…</p>}{error && <p role="alert">{error}</p>}
    {!loading && availableGroups.length === 0 && <p>Nessun gruppo assegnato. Contatta un amministratore.</p>}
    {availableGroups.map(group => <article className="list-card" key={group.id}><div><strong>{group.name}</strong><p>{group.season} · {groupRole(data, user!.id, group) === 'admin' ? 'Amministratore' : groupRole(data, user!.id, group) === 'coach' ? 'Allenatore' : 'Collaboratore'}{!group.active && ' · Disattivato'}</p><button onClick={() => switchGroup(group.id)}>ENTRA</button></div></article>)}
    <button disabled={loading} onClick={() => void reload()}>Aggiorna gruppi</button>
  </main>
}
