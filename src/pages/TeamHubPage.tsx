import { useRef, useState, type FormEvent } from 'react'
import { ArrowLeft, ArrowRight, Plus } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/authContext'
import { createTeam } from '../cloud/staffRepository'
import { Button, Card, ErrorState, Field, PageHeader, Select } from '../components/ui'
import { FOOTBALL_CATEGORIES, FOOTBALL_CATEGORY_STAGES } from '../data/footballCategories'
import { useGroup } from '../groups/groupContext'
import { errorMessage } from '../lib/supabase'

export function TeamHubPage() {
  const { organizationId, seasonId } = useParams()
  const { data, reload } = useGroup()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [categoryCode, setCategoryCode] = useState(FOOTBALL_CATEGORIES[0].code)
  const lock = useRef(false)
  const organization = data.organizations.find(item => item.id === organizationId)
  const season = data.organizationSeasons.find(item => item.id === seasonId && item.organizationId === organizationId)
  const admin = Boolean(organizationId && data.organizationMemberships.some(item => item.organizationId === organizationId && item.userId === user?.id && item.active))
  const teams = data.teams.filter(item => item.organizationId === organizationId && item.seasonId === seasonId)

  if (!organization || !season) return <main className="gp-hub"><Link to={`/app/organizations/${organizationId}`}>Stagione non disponibile</Link></main>

  const parentRoute = `/app/organizations/${organization.id}/seasons/${season.id}`
  const closeCreate = () => { setOpen(false); setError(''); navigate(parentRoute) }
  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (lock.current) return
    const category = FOOTBALL_CATEGORIES.find(item => item.code === categoryCode)
    if (!category) { setError('Seleziona una categoria valida.'); return }
    lock.current = true
    setBusy(true)
    setError('')
    try {
      const team = await createTeam({ organizationId: organization.id, seasonId: season.id, name: category.label })
      await reload()
      setOpen(false)
      navigate(`${parentRoute}/teams/${team.id}`)
    } catch (reason) { setError(errorMessage(reason)) }
    finally { lock.current = false; setBusy(false) }
  }

  return <main className="gp-hub hierarchy-page category-command-hub">
    <PageHeader eyebrow={`${organization.name} · ${season.name}`} title="Categorie" description="Ogni categoria raccoglie la rosa cloud e i WorkGroup operativi della stagione." actions={<><Link className="inline-flex min-h-12 items-center gap-2 font-semibold" to={`/app/organizations/${organization.id}`}><ArrowLeft size={18} />Stagioni</Link>{admin && <Button variant="primary" onClick={() => { setOpen(true); setError('') }}><Plus size={18} />Nuova categoria</Button>}</>} />
    <div className="gp-visual-grid">{teams.map(team => { const groups = data.groups.filter(group => group.teamId === team.id); return <Card key={team.id} className="gp-group-card command-hub-card" padding="lg"><div className="gp-cover small"><span>{team.name}</span></div><div><p className="eyebrow">Categoria</p><h2>{team.name}</h2></div><dl className="command-card-metrics"><div><dt>WorkGroup</dt><dd>{groups.length}</dd></div><div><dt>Attivi</dt><dd>{groups.filter(group => group.active).length}</dd></div></dl><Button variant="primary" onClick={() => navigate(`${parentRoute}/teams/${team.id}`)}>Gestisci categoria <ArrowRight size={17} /></Button></Card> })}</div>
    {teams.length === 0 && <Card className="gp-empty" padding="lg"><h2>Nessuna categoria disponibile</h2><p>Aggiungi la prima categoria della stagione per creare la rosa e i gruppi di lavoro.</p>{admin && <Button variant="primary" onClick={() => setOpen(true)}>Crea categoria</Button>}</Card>}
    {open && <div className="sheet-backdrop" role="presentation"><section className="add-player-sheet" role="dialog" aria-modal="true" aria-label="Nuova categoria"><div className="sheet-handle" /><header className="exercise-sheet-header"><div><button type="button" className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-app-muted" onClick={closeCreate} disabled={busy}><ArrowLeft size={17} />Torna a {season.name}</button><span className="eyebrow">{organization.name} · {season.name}</span><h1>Nuova categoria</h1><p className="mt-2 text-sm text-app-muted">Seleziona la categoria del team.</p></div></header><form className="add-player-scroll" onSubmit={create}><Field label="Categoria"><Select value={categoryCode} onChange={event => setCategoryCode(event.target.value)} disabled={busy} autoFocus>{FOOTBALL_CATEGORY_STAGES.map(group => <optgroup key={group.stage} label={group.label}>{FOOTBALL_CATEGORIES.filter(category => category.stage === group.stage).map(category => <option key={category.code} value={category.code}>{category.label} · {category.ageBand}</option>)}</optgroup>)}</Select></Field>{error && <ErrorState message={error} />}<div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="ghost" onClick={closeCreate} disabled={busy}>Annulla</Button><Button variant="primary" loading={busy}>Crea categoria</Button></div></form></section></div>}
  </main>
}
