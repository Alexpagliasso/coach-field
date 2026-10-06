import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Pencil, Plus, Power, Users } from 'lucide-react'
import { useAuth } from '../auth/authContext'
import { useGroup } from '../groups/groupContext'
import { saveGroup } from '../cloud/staffRepository'
import { errorMessage } from '../lib/supabase'
import type { Group } from '../types/staff'
import { Badge, Button, Card, EmptyState, ErrorState, Field, Input, LoadingState, PageHeader, Select, Textarea, buttonClass } from '../components/ui'
import { StaffPage } from './StaffPage'

function adminError(reason: unknown) {
  const message = errorMessage(reason)
  if (message.includes('42501') || /row-level security|policy/i.test(message)) return 'Non hai i permessi per modificare i gruppi di questa società. Verifica la membership amministratore e che l’hotfix RLS sia applicato.'
  if (message.includes('23505') || /duplicate/i.test(message)) return 'Esiste già un gruppo con questi dati.'
  return message
}

export function AdminPage() {
  const { user } = useAuth()
  const { data, loading, error: loadError, reload } = useGroup()
  const [editing, setEditing] = useState<Group | 'new'>()
  const [staffId, setStaffId] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const orgIds = data.organizationMemberships.filter(item => item.userId === user?.id && item.active).map(item => item.organizationId)
  const groups = data.groups.filter(item => orgIds.includes(item.organizationId))
  const organizations = data.organizations.filter(item => orgIds.includes(item.id))
  const run = async (operation: () => Promise<void>) => { setBusy(true); setError(''); try { await operation(); await reload(); setEditing(undefined) } catch (reason) { setError(adminError(reason)) } finally { setBusy(false) } }
  if (loading) return <main className="page"><LoadingState label="Caricamento amministrazione…" /></main>
  if (orgIds.length === 0) return <main className="page"><ErrorState message={loadError || 'Accesso riservato agli amministratori.'} /><Link className={buttonClass()} to="/app/groups"><ArrowLeft size={17} /> Torna ai gruppi</Link></main>
  const current = editing && editing !== 'new' ? editing : undefined
  return <main className="page mx-auto max-w-6xl"><PageHeader eyebrow="Configurazione" title="Amministrazione" description="Gestisci gruppi e staff delle società di cui sei amministratore." actions={<Link className={buttonClass({ variant: 'ghost' })} to="/app/groups"><ArrowLeft size={17} /> Gruppi</Link>} />
    {error && <ErrorState message={error} />}
    <section className="mb-10"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold">Gruppi</h2><p className="text-sm text-app-muted">{organizations.map(item => item.name).join(' · ')}</p></div><Button variant="primary" onClick={() => setEditing('new')}><Plus size={18} /> Nuovo gruppo</Button></div>
      {groups.length === 0 && !editing && <EmptyState title="Nessun gruppo" description="Crea il primo gruppo della società per iniziare." action={<Button onClick={() => setEditing('new')}>Nuovo gruppo</Button>} />}
      <div className="grid gap-4 md:grid-cols-2">{groups.map(group => <Card key={group.id}><div className="flex items-start justify-between gap-3"><div><h3 className="text-lg font-bold">{group.name}</h3><p className="mt-1 text-sm text-app-muted">{group.season || 'Stagione non indicata'}</p></div><Badge variant={group.active ? 'success' : 'danger'}>{group.active ? 'Attivo' : 'Disattivato'}</Badge></div><div className="mt-5 flex flex-wrap gap-2"><Button size="sm" onClick={() => setEditing(group)}><Pencil size={16} /> Modifica</Button><Button size="sm" variant={group.active ? 'danger' : 'success'} disabled={busy} onClick={() => void run(() => saveGroup({ ...group, active: !group.active }))}><Power size={16} /> {group.active ? 'Disattiva' : 'Riattiva'}</Button><Button size="sm" variant="ghost" onClick={() => setStaffId(group.id)}><Users size={16} /> Staff</Button></div></Card>)}</div>
    </section>
    {editing && <Card className="mb-10" padding="lg"><h2 className="mb-5 text-xl font-bold">{current ? `Modifica ${current.name}` : 'Nuovo gruppo'}</h2><form className="grid gap-5 sm:grid-cols-2" key={current?.id ?? 'new'} onSubmit={event => { event.preventDefault(); const form = new FormData(event.currentTarget); void run(() => saveGroup({ id: current?.id, organizationId: current?.organizationId ?? String(form.get('organizationId')), name: String(form.get('name')).trim(), season: String(form.get('season')), description: String(form.get('description')), yearFrom: form.get('yearFrom') ? Number(form.get('yearFrom')) : undefined, yearTo: form.get('yearTo') ? Number(form.get('yearTo')) : undefined, publicVisible: form.get('publicVisible') === 'on', active: current?.active ?? true })) }}>
      <Field label="Società"><Select name="organizationId" defaultValue={current?.organizationId ?? organizations[0]?.id} disabled={Boolean(current)}>{organizations.map(org => <option key={org.id} value={org.id}>{org.name}</option>)}</Select></Field><Field label="Nome"><Input name="name" defaultValue={current?.name} required /></Field><Field label="Stagione"><Input name="season" defaultValue={current?.season} placeholder="2026/27" /></Field><Field label="Anno da"><Input type="number" name="yearFrom" defaultValue={current?.yearFrom} /></Field><Field label="Anno a"><Input type="number" name="yearTo" defaultValue={current?.yearTo} /></Field><div className="sm:col-span-2"><Field label="Descrizione pubblicabile"><Textarea name="description" defaultValue={current?.description} /></Field></div><label className="flex min-h-12 items-center gap-3 text-sm font-semibold"><input className="size-5 accent-[var(--primary)]" type="checkbox" name="publicVisible" defaultChecked={current?.publicVisible} /> Visibile pubblicamente</label><div className="flex flex-wrap justify-end gap-2 sm:col-span-2"><Button type="button" variant="ghost" onClick={() => setEditing(undefined)}>Annulla</Button><Button variant="primary" loading={busy}>Salva gruppo</Button></div>
    </form></Card>}
    <section><h2 className="mb-4 text-xl font-bold">Staff</h2>{groups.find(group => group.id === staffId) ? <StaffPage key={staffId} group={groups.find(group => group.id === staffId)} /> : <EmptyState icon={Users} title="Scegli un gruppo" description="Apri lo staff di un gruppo per assegnare allenatori, collaboratori e permessi." />}</section>
  </main>
}
