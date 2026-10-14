import { useRef, useState, type FormEvent } from 'react'
import { ArrowLeft, ArrowRight, Plus } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/authContext'
import { createOrganizationSeason } from '../cloud/staffRepository'
import { Button, Card, ErrorState, Field, PageHeader, Select } from '../components/ui'
import { useGroup } from '../groups/groupContext'
import { errorMessage } from '../lib/supabase'
import { formatSeasonName } from '../utils/season'

export function GroupHubPage() {
  const { organizationId } = useParams()
  const { data, reload, switchGroup } = useGroup()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [startYear, setStartYear] = useState(() => new Date().getFullYear())
  const lock = useRef(false)
  const organization = data.organizations.find(item => item.id === organizationId)
  const admin = Boolean(organizationId && data.organizationMemberships.some(item => item.organizationId === organizationId && item.userId === user?.id && item.active))
  const seasons = data.organizationSeasons.filter(item => item.organizationId === organizationId)
  const legacyGroups = data.groups.filter(group => group.organizationId === organizationId && !group.teamId && (admin || data.memberships.some(item => item.groupId === group.id && item.userId === user?.id && item.active)))
  const closeCreate = () => { setOpen(false); setError(''); navigate(`/app/organizations/${organization?.id ?? organizationId}`) }

  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!organization || lock.current) return
    const name = formatSeasonName(startYear)
    lock.current = true
    setBusy(true)
    setError('')
    try {
      const season = await createOrganizationSeason({ organizationId: organization.id, name })
      console.debug('[GrowPitch season create:before-refresh]', { seasonId: season.id })
      await reload()
      console.debug('[GrowPitch season create:refresh-result]', { seasonId: season.id, completed: true })
      setOpen(false)
      navigate(`/app/organizations/${organization.id}/seasons/${season.id}`)
    } catch (reason) {
      const code = typeof reason === 'object' && reason && 'code' in reason ? String(reason.code) : ''
      setError(code === '23505' ? `La stagione ${name} esiste gia.` : errorMessage(reason))
    }
    finally { lock.current = false; setBusy(false) }
  }

  if (!organization) return <main className="gp-hub"><Link to="/app/groups">Societa non disponibile</Link></main>
  return <main className="gp-hub hierarchy-page season-command-hub">
    <PageHeader eyebrow="Società · Struttura sportiva" title={organization.name} description="Esplora le stagioni disponibili e accedi alle categorie organizzate per annata sportiva." actions={<><Link className="inline-flex min-h-12 items-center gap-2 font-semibold" to="/app/groups"><ArrowLeft size={18} />Società</Link>{admin && <Button variant="primary" onClick={() => { setOpen(true); setError('') }}><Plus size={18} />Nuova stagione</Button>}</>} />
    <div className="gp-visual-grid">
      {seasons.map(season => { const categoryCount = data.teams.filter(team => team.seasonId === season.id).length; const groupCount = data.groups.filter(group => data.teams.some(team => team.id === group.teamId && team.seasonId === season.id)).length; return <Card key={season.id} className="gp-group-card command-hub-card" padding="lg"><div className="gp-cover small"><span>{season.name}</span></div><div><p className="eyebrow">Stagione sportiva</p><h2>{season.name}</h2></div><dl className="command-card-metrics"><div><dt>Categorie</dt><dd>{categoryCount}</dd></div><div><dt>WorkGroup</dt><dd>{groupCount}</dd></div></dl><Button variant="primary" onClick={() => navigate(`/app/organizations/${organization.id}/seasons/${season.id}`)}>Apri stagione <ArrowRight size={17} /></Button></Card> })}
    </div>
    {seasons.length === 0 && <Card className="gp-empty" padding="lg"><h2>Nessuna stagione disponibile</h2><p>Crea la prima stagione per organizzare categorie e WorkGroup senza modificare i gruppi legacy.</p>{admin && <Button variant="primary" onClick={() => setOpen(true)}>Crea stagione</Button>}</Card>}
    {legacyGroups.length > 0 && <section className="mt-8"><PageHeader eyebrow="Archivio esistente" title="Gruppi senza categoria" description="Questi gruppi legacy restano disponibili e non vengono modificati." /><div className="gp-visual-grid">{legacyGroups.map(group => <Card key={group.id} className="gp-group-card"><h2>{group.name}</h2><p>{group.season || 'Stagione non indicata'}</p><Button variant="primary" onClick={() => switchGroup(group.id)}>Entra <ArrowRight size={17} /></Button></Card>)}</div></section>}
    {open && <div className="sheet-backdrop" role="presentation"><section className="add-player-sheet" role="dialog" aria-modal="true" aria-label="Nuova stagione"><div className="sheet-handle" /><header className="exercise-sheet-header"><div><button type="button" className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-app-muted" onClick={closeCreate} disabled={busy}><ArrowLeft size={17} />Torna a {organization.name}</button><span className="eyebrow">{organization.name}</span><h1>Nuova stagione</h1><p className="mt-2 text-sm text-app-muted">Scegli l'anno di inizio: il nome della stagione viene generato automaticamente.</p></div></header><form className="add-player-scroll" onSubmit={create}><Field label="Anno di inizio"><Select value={startYear} onChange={event => setStartYear(Number(event.target.value))} disabled={busy}>{Array.from({ length: 8 }, (_, index) => new Date().getFullYear() + 5 - index).map(year => <option key={year} value={year}>{year}</option>)}</Select></Field><p className="rounded-xl border border-app-border bg-app-elevated px-4 py-3 text-sm font-semibold text-app-text">Stagione: {formatSeasonName(startYear)}</p>{error && <ErrorState message={error} />}<div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="ghost" onClick={closeCreate} disabled={busy}>Annulla</Button><Button variant="primary" loading={busy}>Crea stagione</Button></div></form></section></div>}
  </main>
}
