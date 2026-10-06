import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { ArrowRight, Building2, LogOut, RefreshCw, ShieldCheck, Users } from 'lucide-react'
import { APP_NAME } from '../brand'
import { useAuth } from '../auth/authContext'
import { useGroup } from '../groups/groupContext'
import { groupRole } from '../groups/access'
import { errorMessage, supabase } from '../lib/supabase'
import { Badge, Button, Card, EmptyState, ErrorState, Field, Input, LoadingState, PageHeader, buttonClass } from '../components/ui'

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
      <div><Badge variant="primary">Coach Field</Badge><h1 className="mt-5 max-w-3xl text-4xl font-black leading-tight tracking-tight sm:text-6xl">Il lavoro di squadra comincia sul campo.</h1><p className="mt-5 max-w-xl text-lg text-app-muted">Uno spazio condiviso per la società, gli allenatori e ogni persona che fa crescere il gruppo.</p></div>
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
  return <main className="grid min-h-screen place-items-center px-4 py-10"><div className="w-full max-w-md"><Link className="mb-6 inline-flex text-sm font-bold text-app-primary" to="/">← {APP_NAME}</Link><Card padding="lg"><Badge variant="primary"><ShieldCheck size={14} /> Area riservata</Badge><h1 className="mt-5 text-3xl font-black tracking-tight">Login staff</h1><p className="mt-2 text-app-muted">Accedi con l’account associato alla tua società.</p>
    {!supabase && <ErrorState message="Supabase non configurato. Imposta VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY." />}
    {(error || auth.error) && <ErrorState message={error || auth.error} />}
    <form className="mt-7 grid gap-5" onSubmit={async event => { event.preventDefault(); const form = new FormData(event.currentTarget); setBusy(true); setError(''); try { await auth.signIn(String(form.get('email')), String(form.get('password'))) } catch (reason) { setError(errorMessage(reason)) } finally { setBusy(false) } }}>
      <Field label="Email"><Input name="email" type="email" autoComplete="username" required /></Field>
      <Field label="Password"><Input name="password" type="password" autoComplete="current-password" required /></Field>
      <Button size="lg" loading={busy || auth.loading} disabled={!supabase}>Accedi</Button>
    </form></Card></div></main>
}

export function GroupSelectorPage() {
  const { availableGroups, data, loading, error, reload, switchGroup } = useGroup()
  const { user, signOut } = useAuth()
  const isAdmin = data.organizationMemberships.some(item => item.userId === user?.id && item.active)
  return <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-8 sm:px-6"><PageHeader eyebrow="Area staff" title="I tuoi gruppi" description="Scegli il gruppo con cui vuoi lavorare." actions={<div className="flex flex-wrap gap-2">{isAdmin && <Link className={buttonClass({ variant: 'secondary' })} to="/admin"><ShieldCheck size={17} /> Amministrazione</Link>}<Button variant="ghost" onClick={() => void signOut()}><LogOut size={17} /> Esci</Button></div>} />
    {loading && <LoadingState label="Caricamento gruppi…" />}{error && <ErrorState message={error} action={<Button variant="secondary" onClick={() => void reload()}>Riprova</Button>} />}
    {!loading && !error && availableGroups.length === 0 && <EmptyState icon={Users} title="Nessun gruppo assegnato" description="Chiedi a un amministratore di aggiungerti allo staff di un gruppo." />}
    <div className="grid gap-4 sm:grid-cols-2">{availableGroups.map(group => { const role = groupRole(data, user!.id, group); return <Card key={group.id} className="flex flex-col"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-app-muted">{data.organizations.find(item => item.id === group.organizationId)?.name || 'Società'}</p><h2 className="mt-2 text-2xl font-bold">{group.name}</h2></div><Badge variant={group.active ? 'success' : 'danger'}>{group.active ? 'Attivo' : 'Disattivato'}</Badge></div><p className="mt-2 text-app-muted">{group.season || 'Stagione non indicata'}</p><div className="mt-5 flex items-center justify-between gap-3"><Badge variant="primary">{role === 'admin' ? 'Amministratore' : role === 'coach' ? 'Allenatore' : 'Collaboratore'}</Badge><Button disabled={!group.active} onClick={() => switchGroup(group.id)}>Entra nel gruppo <ArrowRight size={17} /></Button></div></Card> })}</div>
    <div className="mt-6"><Button variant="ghost" disabled={loading} onClick={() => void reload()}><RefreshCw size={17} /> Aggiorna gruppi</Button></div>
  </main>
}
