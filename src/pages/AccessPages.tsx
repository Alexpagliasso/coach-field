import { useEffect, useRef, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { ArrowRight, Building2, LogOut, Plus, RefreshCw, ShieldCheck, Users } from 'lucide-react'
import { APP_NAME, APP_TAGLINE } from '../brand'
import { useAuth } from '../auth/authContext'
import { useGroup } from '../groups/groupContext'
import { groupRole } from '../groups/access'
import { errorMessage, supabase } from '../lib/supabase'
import { Badge, Button, Card, EmptyState, ErrorState, Field, Input, LoadingState, PageHeader, buttonClass } from '../components/ui'
import { bootstrapOrganization, saveGroup } from '../cloud/staffRepository'
import { isValidSeason } from '../utils/season'
import { TacticalBackdrop } from '../components/TacticalBackdrop'

type DirectoryGroup = { id: string; name: string; season: string; organization_name: string; description: string }

export function PublicHome() {
  const [groups, setGroups] = useState<DirectoryGroup[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(Boolean(supabase))
  useEffect(() => {
    if (!supabase) return
    let alive = true
    supabase.rpc('public_group_directory').then(({ data, error: requestError }) => {
      if (!alive) return
      if (requestError) setError('Elenco gruppi momentaneamente non disponibile.')
      else setGroups(data ?? [])
      setLoading(false)
    })
    return () => { alive = false }
  }, [])
  return <main className="mx-auto min-h-screen w-full max-w-6xl px-4 py-5 sm:px-6 lg:px-8">
    <header className="flex items-center justify-between border-b border-app-border pb-5">
      <strong className="text-lg tracking-tight">{APP_NAME}</strong>
      <Link className={buttonClass({ variant: 'secondary', size: 'sm' })} to="/login">Area staff <ArrowRight size={16} /></Link>
    </header>
    <section className="grid gap-8 py-16 md:grid-cols-[1.35fr_.65fr] md:items-center md:py-24">
      <div><Badge variant="primary">GrowPitch</Badge><h1 className="mt-5 max-w-3xl text-4xl font-black leading-tight tracking-tight sm:text-6xl">Grow players. Build the game.</h1><p className="mt-5 max-w-xl text-lg text-app-muted">Coaching e sviluppo nel calcio giovanile, dal campo al percorso.</p></div>
      <Card className="bg-app-primary text-app-primary-fg" padding="lg"><Users size={32} /><h2 className="mt-5 text-2xl font-bold">Una squadra, un solo spazio.</h2><p className="mt-2 opacity-85">Organizza attività, presenze, partite e comunicazioni durante tutta la stagione.</p></Card>
    </section>
    <section className="py-8" aria-labelledby="public-groups-title">
      <PageHeader eyebrow="Società" title="Gruppi" description="Scopri i gruppi che hanno scelto di rendere pubblico il proprio percorso." />
      {error && <ErrorState message={error} />}
      {loading && <LoadingState label="Caricamento gruppi…" />}
      {!loading && !error && groups.length === 0 && <EmptyState icon={Building2} title="Nessun gruppo pubblico" description="I gruppi pubblicati dalle società appariranno qui." />}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{groups.map(group => <Card key={group.id}><Badge>{group.season || 'Stagione'}</Badge><h3 className="mt-4 text-xl font-bold">{group.name}</h3><p className="mt-1 text-sm font-semibold text-app-primary">{group.organization_name}</p><p className="mt-3 text-sm leading-6 text-app-muted">{group.description || 'Un gruppo in crescita, dentro e fuori dal campo.'}</p></Card>)}</div>
    </section>
    <Card className="my-12 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between" padding="lg"><div><Badge variant="primary">Area riservata</Badge><h2 className="mt-3 text-2xl font-bold">Lavora con il tuo staff</h2><p className="mt-1 text-app-muted">Accedi ai gruppi che ti sono stati assegnati.</p></div><Link className={buttonClass({ variant: 'primary', size: 'lg' })} to="/login">Area staff <ArrowRight size={18} /></Link></Card>
  </main>
}

export function LoginPage() {
  const auth = useAuth()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  if (auth.isAuthenticated) return <Navigate to="/app/groups" replace />
  return <main className="login-experience"><section className="login-visual" aria-label="GrowPitch"><Link className="login-brand" to="/"><span>GP</span>{APP_NAME}</Link><div className="login-visual-copy"><Badge variant="primary">Metodo · campo · crescita</Badge><h1>{APP_TAGLINE}</h1><p>Un unico spazio operativo per trasformare ogni allenamento in un percorso di sviluppo.</p></div><div className="login-field-art"><TacticalBackdrop /><span className="login-route-note">Il piano. Il campo. Il prossimo passo.</span></div><small className="login-visual-foot">GrowPitch · coaching giovanile con metodo</small></section><section className="login-access"><div className="login-access-inner"><Link className="login-back" to="/">← Torna al sito</Link><Card className="login-card" padding="lg"><Badge variant="primary"><ShieldCheck size={14} /> Area riservata</Badge><h1 className="mt-5 text-3xl font-black tracking-tight">Bentornato, staff.</h1><p className="mt-2 text-app-muted">Accedi con l’account associato alla tua società.</p>
    {!supabase && <ErrorState message="Supabase non configurato. Imposta VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY." />}
    {(error || auth.error) && <ErrorState message={error || auth.error} />}
    <form className="mt-7 grid gap-5" onSubmit={async event => { event.preventDefault(); const form = new FormData(event.currentTarget); setBusy(true); setError(''); try { await auth.signIn(String(form.get('email')), String(form.get('password'))) } catch (reason) { setError(errorMessage(reason)) } finally { setBusy(false) } }}>
      <Field label="Email"><Input name="email" type="email" autoComplete="username" required /></Field>
      <Field label="Password"><Input name="password" type="password" autoComplete="current-password" required /></Field>
      <Button size="lg" loading={busy || auth.loading} disabled={!supabase}>Accedi</Button>
    </form></Card><p className="login-help">Le funzionalità disponibili dipendono dal tuo ruolo nel WorkGroup.</p></div></section></main>
}

export function GroupSelectorPage() {
  const { availableGroups, data, loading, error, reload, switchGroup } = useGroup()
  const { user, signOut } = useAuth()
  const [selectedOrganizationId, setSelectedOrganizationId] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [busy, setBusy] = useState(false)
  const submitting = useRef(false)
  const [creatingGroup, setCreatingGroup] = useState(false)
  const [groupError, setGroupError] = useState('')
  const [groupBusy, setGroupBusy] = useState(false)
  const groupSubmitting = useRef(false)
  const organizationIds = new Set([
    ...data.organizationMemberships.filter(item => item.userId === user?.id && item.active).map(item => item.organizationId),
    ...data.memberships.filter(item => item.userId === user?.id && item.active).map(item => item.organizationId),
  ])
  const organizations = data.organizations.filter(item => organizationIds.has(item.id))
  const selectedOrganization = organizations.find(item => item.id === selectedOrganizationId) ?? organizations[0]
  const visibleGroups = availableGroups.filter(group => !selectedOrganization || group.organizationId === selectedOrganization.id)
  const canCreateGroup = Boolean(selectedOrganization && data.organizationMemberships.some(item => item.organizationId === selectedOrganization.id && item.userId === user?.id && item.active && item.role === 'admin'))
  const isAdmin = data.organizationMemberships.some(item => item.userId === user?.id && item.active)
  return <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-8 sm:px-6"><PageHeader eyebrow="Area staff" title="Società e gruppi" description="Scegli la società e il gruppo con cui vuoi lavorare." actions={<div className="flex flex-wrap gap-2">{isAdmin && <Link className={buttonClass({ variant: 'secondary' })} to="/admin"><ShieldCheck size={17} /> Amministrazione</Link>}<Button variant="ghost" onClick={() => void signOut()}><LogOut size={17} /> Esci</Button></div>} />
    {loading && <LoadingState label="Caricamento gruppi…" />}{error && <ErrorState message={error} action={<Button variant="secondary" onClick={() => void reload()}>Riprova</Button>} />}
    {!loading && !error && <><section className="mb-8" aria-labelledby="organizations-title"><div className="mb-3 flex flex-wrap items-center justify-between gap-3"><div><h2 id="organizations-title" className="text-xl font-bold">Le tue società</h2><p className="mt-1 text-sm text-app-muted">Puoi amministrare o collaborare con più società.</p></div><Button variant="primary" onClick={() => { setCreating(true); setCreateError('') }}><Plus size={18} /> Crea società</Button></div>
      {creating && <Card className="mb-4" padding="lg"><form className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end" onSubmit={async event => { event.preventDefault(); if (submitting.current) return; const name = String(new FormData(event.currentTarget).get('name')).trim(); if (!name) { setCreateError('Inserisci il nome della società.'); return } submitting.current = true; setBusy(true); setCreateError(''); try { const organization = await bootstrapOrganization(name); await reload(); setSelectedOrganizationId(organization.id); setCreating(false) } catch (reason) { setCreateError(errorMessage(reason)) } finally { submitting.current = false; setBusy(false) } }}><Field label="Nome società"><Input name="name" autoFocus maxLength={120} disabled={busy} /></Field><div className="flex gap-2"><Button type="button" variant="ghost" disabled={busy} onClick={() => { setCreating(false); setCreateError('') }}>Annulla</Button><Button type="submit" variant="primary" loading={busy}>Crea società</Button></div></form>{createError && <ErrorState message={createError} />}</Card>}
      {organizations.length === 0 ? <EmptyState icon={Building2} title="Nessuna società" description="Crea la prima società per iniziare a configurare il tuo spazio." /> : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{organizations.map(organization => { const admin = data.organizationMemberships.some(item => item.organizationId === organization.id && item.userId === user?.id && item.active); const membership = data.memberships.find(item => item.organizationId === organization.id && item.userId === user?.id && item.active); const role = admin ? 'Amministratore' : membership?.role === 'coach' ? 'Allenatore' : 'Collaboratore'; const selected = organization.id === selectedOrganization?.id; return <button type="button" className={`min-h-20 rounded-app border p-4 text-left transition ${selected ? 'border-app-primary bg-app-primary/10 shadow-[var(--shadow-card)]' : 'border-app-border bg-app-surface hover:border-app-primary'}`} aria-pressed={selected} onClick={() => setSelectedOrganizationId(organization.id)} key={organization.id}><span className="block font-bold text-app-text">{organization.name}</span><span className="mt-2 inline-flex text-xs font-bold uppercase tracking-wide text-app-muted">{role}</span></button> })}</div>}
    </section>
    {selectedOrganization && <section aria-labelledby="organization-groups-title"><div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-app-primary">{selectedOrganization.name}</p><h2 id="organization-groups-title" className="mt-2 text-xl font-bold">Gruppi</h2></div>{canCreateGroup && <Button variant="primary" onClick={() => { setCreatingGroup(true); setGroupError('') }}><Plus size={18} /> Crea gruppo</Button>}</div>
      {creatingGroup && canCreateGroup && <Card className="mb-4" padding="lg"><form className="grid gap-4 sm:grid-cols-2" aria-label="Crea gruppo" onSubmit={async event => { event.preventDefault(); if (groupSubmitting.current || !selectedOrganization) return; const form = new FormData(event.currentTarget); const name = String(form.get('name')).trim(); const season = String(form.get('season')).trim(); if (!name) { setGroupError('Inserisci il nome del gruppo.'); return } if (!isValidSeason(season)) { setGroupError('Inserisci una stagione valida nel formato YYYY/YY, ad esempio 2026/27.'); return } groupSubmitting.current = true; setGroupBusy(true); setGroupError(''); try { await saveGroup({ organizationId: selectedOrganization.id, name, season }); await reload(); setCreatingGroup(false) } catch (reason) { setGroupError(errorMessage(reason)) } finally { groupSubmitting.current = false; setGroupBusy(false) } }}><Field label="Nome gruppo"><Input name="name" maxLength={120} autoFocus disabled={groupBusy} required placeholder="Pulcini 2016-2017" /></Field><Field label="Stagione"><Input name="season" maxLength={30} disabled={groupBusy} placeholder="2026/27" /></Field><div className="flex flex-wrap justify-end gap-2 sm:col-span-2"><Button type="button" variant="ghost" disabled={groupBusy} onClick={() => { setCreatingGroup(false); setGroupError('') }}>Annulla</Button><Button type="submit" variant="primary" loading={groupBusy}>Crea gruppo</Button></div></form>{groupError && <ErrorState message={groupError} />}</Card>}
      {visibleGroups.length === 0 ? <EmptyState icon={Users} title="Nessun gruppo configurato" description="Questa società non ha ancora gruppi." /> : <div className="grid gap-4 sm:grid-cols-2">{visibleGroups.map(group => { const role = groupRole(data, user!.id, group); return <Card key={group.id} className="flex flex-col"><div className="flex items-start justify-between gap-3"><h3 className="text-2xl font-bold">{group.name}</h3><Badge variant={group.active ? 'success' : 'danger'}>{group.active ? 'Attivo' : 'Disattivato'}</Badge></div><p className="mt-2 text-app-muted">{group.season || 'Stagione non indicata'}</p><div className="mt-5 flex items-center justify-between gap-3"><Badge variant="primary">{role === 'admin' ? 'Amministratore' : role === 'coach' ? 'Allenatore' : 'Collaboratore'}</Badge><Button disabled={!group.active} onClick={() => switchGroup(group.id)}>Entra nel gruppo <ArrowRight size={17} /></Button></div></Card> })}</div>}</section>}
    </>}
    <div className="mt-6"><Button variant="ghost" disabled={loading} onClick={() => void reload()}><RefreshCw size={17} /> Aggiorna gruppi</Button></div>
  </main>
}
