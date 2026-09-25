import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/authContext'
import { useGroup } from '../groups/groupContext'
import { saveGroup } from '../cloud/staffRepository'
import { errorMessage } from '../lib/supabase'
import type { Group } from '../types/staff'
import { StaffPage } from './StaffPage'
export function AdminPage() {
  const { user } = useAuth()
  const { data, loading, error: loadError, reload } = useGroup()
  const [editing, setEditing] = useState<Group | 'new'>()
  const [staffId, setStaffId] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const orgIds = data.organizationMemberships.filter(item => item.userId === user?.id && item.active).map(item => item.organizationId)
  const groups = data.groups.filter(item => orgIds.includes(item.organizationId))
  const run = async (operation: () => Promise<void>) => { setBusy(true); setError(''); try { await operation(); await reload(); setEditing(undefined) } catch (reason) { setError(errorMessage(reason)) } finally { setBusy(false) } }
  if (loading) return <p className="page">Caricamento amministrazione…</p>
  if (orgIds.length === 0) return <section className="page"><p role="alert">{loadError || 'Accesso riservato agli amministratori.'}</p><Link to="/app/groups">Gruppi</Link></section>
  const current = editing && editing !== 'new' ? editing : undefined
  return <main className="page access-page"><Link to="/app/groups">Torna ai gruppi</Link><h1>Amministrazione</h1>{error && <p role="alert">{error}</p>}
    <h2>Gruppi</h2><button onClick={() => setEditing('new')}>Nuovo gruppo</button>
    {groups.map(group => <article className="list-card" key={group.id}><div><strong>{group.name}</strong><p>{group.season} · {group.active ? 'Attivo' : 'Disattivato'}</p><button onClick={() => setEditing(group)}>Modifica</button><button disabled={busy} onClick={() => void run(() => saveGroup({ ...group, active: !group.active }))}>{group.active ? 'Disattiva' : 'Riattiva'}</button><button onClick={() => setStaffId(group.id)}>Staff</button></div></article>)}
    {editing && <form key={current?.id ?? 'new'} onSubmit={event => { event.preventDefault(); const form = new FormData(event.currentTarget); void run(() => saveGroup({ id: current?.id, organizationId: current?.organizationId ?? String(form.get('organizationId')), name: String(form.get('name')).trim(), season: String(form.get('season')), description: String(form.get('description')), yearFrom: form.get('yearFrom') ? Number(form.get('yearFrom')) : undefined, yearTo: form.get('yearTo') ? Number(form.get('yearTo')) : undefined, publicVisible: form.get('publicVisible') === 'on', active: current?.active ?? true })) }}>
      <label className="form-field">Società<select name="organizationId" defaultValue={current?.organizationId} disabled={Boolean(current)}>{data.organizations.filter(item => orgIds.includes(item.id)).map(org => <option key={org.id} value={org.id}>{org.name}</option>)}</select></label>
      <label className="form-field">Nome<input name="name" defaultValue={current?.name} required /></label>
      <label className="form-field">Stagione<input name="season" defaultValue={current?.season} /></label>
      <label className="form-field">Descrizione pubblicabile<textarea name="description" defaultValue={current?.description} /></label>
      <label className="form-field">Anno da<input type="number" name="yearFrom" defaultValue={current?.yearFrom} /></label>
      <label className="form-field">Anno a<input type="number" name="yearTo" defaultValue={current?.yearTo} /></label>
      <label><input type="checkbox" name="publicVisible" defaultChecked={current?.publicVisible} />Visibile pubblicamente</label>
      <button disabled={busy}>Salva gruppo</button><button type="button" onClick={() => setEditing(undefined)}>Annulla</button>
    </form>}
    <h2>Staff</h2>{groups.find(group => group.id === staffId) ? <StaffPage key={staffId} group={groups.find(group => group.id === staffId)} /> : <p>Seleziona Staff su un gruppo per assegnare allenatori e collaboratori.</p>}
  </main>
}
