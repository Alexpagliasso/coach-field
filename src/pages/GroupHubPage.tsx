import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowLeft, ArrowRight, Plus, RefreshCw, ShieldAlert, Trash2, X } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/authContext'
import { createOrganizationSeason, deleteEmptyOrganizationGroup, getCurrentUserSuperadminStatus, getOrganizationGroupDependencyAudit, type GroupDependencyAudit } from '../cloud/staffRepository'
import { Badge, Button, Card, ErrorState, Field, Input, LoadingState, PageHeader, Select } from '../components/ui'
import { OrganizationStaffDirectory } from '../components/OrganizationStaffDirectory'
import { useGroup } from '../groups/groupContext'
import { errorMessage } from '../lib/supabase'
import { formatSeasonName } from '../utils/season'

export function GroupHubPage() {
  const { organizationId } = useParams()
  const { data, reload, switchGroup, activeGroup, availableGroups } = useGroup()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [startYear, setStartYear] = useState(() => new Date().getFullYear())
  const [groupAudit, setGroupAudit] = useState<GroupDependencyAudit[]>([])
  const [auditLoading, setAuditLoading] = useState(false)
  const [auditError, setAuditError] = useState('')
  const [superadmin, setSuperadmin] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<GroupDependencyAudit>()
  const [confirmationName, setConfirmationName] = useState('')
  const lock = useRef(false)
  const organization = data.organizations.find(item => item.id === organizationId)
  const admin = Boolean(organizationId && data.organizationMemberships.some(item => item.organizationId === organizationId && item.userId === user?.id && item.active))
  const seasons = data.organizationSeasons.filter(item => item.organizationId === organizationId)
  const legacyGroups = data.groups.filter(group => group.organizationId === organizationId && !group.teamId && (admin || data.memberships.some(item => item.groupId === group.id && item.userId === user?.id && item.active)))
  const closeCreate = () => { setOpen(false); setError(''); navigate(`/app/organizations/${organization?.id ?? organizationId}`) }
  const loadGroupAudit = useCallback(async () => {
    if (!admin || !organizationId) { setGroupAudit([]); return }
    setAuditLoading(true); setAuditError('')
    try { const [audit, privileged] = await Promise.all([getOrganizationGroupDependencyAudit(organizationId), getCurrentUserSuperadminStatus()]); setGroupAudit(audit); setSuperadmin(privileged) }
    catch (reason) { setAuditError(`${errorMessage(reason)} Verifica che la migration 029 sia stata applicata.`) }
    finally { setAuditLoading(false) }
  }, [admin, organizationId])
  useEffect(() => { const timer = window.setTimeout(() => void loadGroupAudit(), 0); return () => window.clearTimeout(timer) }, [loadGroupAudit])

  const removeGroup = async () => {
    if (!superadmin || !organization || !deleteTarget || confirmationName !== deleteTarget.groupName || lock.current) return
    lock.current = true; setBusy(true); setAuditError('')
    try {
      await deleteEmptyOrganizationGroup({ organizationId: organization.id, groupId: deleteTarget.groupId, confirmationName })
      const deletedActiveGroup = activeGroup?.id === deleteTarget.groupId
      const fallback = availableGroups.find(group => group.id !== deleteTarget.groupId && group.organizationId === organization.id)
      setDeleteTarget(undefined); setConfirmationName('')
      await reload(); await loadGroupAudit()
      if (deletedActiveGroup) navigate(fallback ? `/app/${fallback.id}/today` : `/app/organizations/${organization.id}`, { replace: true })
    } catch (reason) { await loadGroupAudit(); setAuditError(errorMessage(reason)) }
    finally { lock.current = false; setBusy(false) }
  }

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
    {admin && <OrganizationStaffDirectory organizationId={organization.id} organizationName={organization.name} groups={data.groups.filter(group => group.organizationId === organization.id)} />}
    {admin && <section className="mt-8" aria-labelledby="safe-groups-title"><div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><p className="eyebrow">Amministrazione sicura</p><h2 id="safe-groups-title" className="mt-1 text-2xl font-bold">Gestione WorkGroup</h2><p className="mt-1 text-sm text-app-muted">Controlla identità e dipendenze prima di rimuovere esclusivamente un gruppo vuoto.</p></div><Button onClick={() => void loadGroupAudit()} disabled={auditLoading}><RefreshCw size={16} />Aggiorna verifica</Button></div>
      {!superadmin && !auditLoading && !auditError && <p className="mb-3 text-sm text-app-muted">Puoi consultare le dipendenze come amministratore della società. L’eliminazione definitiva è riservata al Superadmin globale.</p>}{auditError && <ErrorState message={auditError} action={<Button onClick={() => void loadGroupAudit()}>Riprova</Button>} />}
      {auditLoading ? <LoadingState label="Verifica dipendenze WorkGroup…" /> : <div className="grid gap-3">{groupAudit.map(group => { const operational = group.playerMemberships + group.playerAssignments + group.trainingSessions + group.matches + group.familyPublications + group.sourceMatchCallups; return <Card key={group.groupId} className="grid gap-3" padding="sm"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold">{group.groupName}</h3><Badge variant={group.active ? 'success' : 'neutral'}>{group.active ? 'Attivo' : 'Non attivo'}</Badge></div><p className="mt-1 text-sm text-app-muted">{group.seasonName || group.legacySeason || 'Stagione non indicata'} · {group.teamName || 'Senza categoria'}</p><code className="mt-2 block break-all text-xs text-app-muted">{group.groupId}</code></div>{superadmin && <Button variant="danger" disabled={!group.canDelete || busy} onClick={() => { setDeleteTarget(group); setConfirmationName(''); setAuditError('') }}><Trash2 size={16} />Elimina gruppo vuoto</Button>}</div><dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4 lg:grid-cols-7"><div><dt>Giocatori legacy</dt><dd>{group.playerMemberships}</dd></div><div><dt>Assegnazioni</dt><dd>{group.playerAssignments}</dd></div><div><dt>Sedute</dt><dd>{group.trainingSessions}</dd></div><div><dt>Partite</dt><dd>{group.matches}</dd></div><div><dt>Pubblicazioni</dt><dd>{group.familyPublications}</dd></div><div><dt>Convocazioni sorgente</dt><dd>{group.sourceMatchCallups}</dd></div><div><dt>Membership staff</dt><dd>{group.staffMemberships}</dd></div></dl>{operational > 0 && <p className="flex items-center gap-2 text-sm text-app-danger"><ShieldAlert size={16} />Eliminazione bloccata: {operational} riferimenti operativi.</p>}</Card>})}{groupAudit.length === 0 && !auditError && <Card padding="lg"><p>Nessun WorkGroup presente nell’organizzazione.</p></Card>}</div>}
    </section>}
    {open && <div className="sheet-backdrop" role="presentation"><section className="add-player-sheet" role="dialog" aria-modal="true" aria-label="Nuova stagione"><div className="sheet-handle" /><header className="exercise-sheet-header"><div><button type="button" className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-app-muted" onClick={closeCreate} disabled={busy}><ArrowLeft size={17} />Torna a {organization.name}</button><span className="eyebrow">{organization.name}</span><h1>Nuova stagione</h1><p className="mt-2 text-sm text-app-muted">Scegli l'anno di inizio: il nome della stagione viene generato automaticamente.</p></div></header><form className="add-player-scroll" onSubmit={create}><Field label="Anno di inizio"><Select value={startYear} onChange={event => setStartYear(Number(event.target.value))} disabled={busy}>{Array.from({ length: 8 }, (_, index) => new Date().getFullYear() + 5 - index).map(year => <option key={year} value={year}>{year}</option>)}</Select></Field><p className="rounded-xl border border-app-border bg-app-elevated px-4 py-3 text-sm font-semibold text-app-text">Stagione: {formatSeasonName(startYear)}</p>{error && <ErrorState message={error} />}<div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="ghost" onClick={closeCreate} disabled={busy}>Annulla</Button><Button variant="primary" loading={busy}>Crea stagione</Button></div></form></section></div>}
    {superadmin && deleteTarget && <div className="sheet-backdrop" role="presentation"><section className="add-player-sheet" role="dialog" aria-modal="true" aria-labelledby="delete-group-title"><div className="sheet-handle" /><header className="exercise-sheet-header"><div><span className="eyebrow">Operazione Superadmin</span><h1 id="delete-group-title">Elimina WorkGroup vuoto</h1><p className="mt-2 text-sm text-app-muted">L’ID verificato è <code className="break-all">{deleteTarget.groupId}</code>.</p></div><Button size="icon" variant="ghost" aria-label="Chiudi" disabled={busy} onClick={() => setDeleteTarget(undefined)}><X size={18} /></Button></header><div className="add-player-scroll"><p>Le {deleteTarget.staffMemberships} membership staff tecniche saranno rimosse. Nessun giocatore, seduta, partita o pubblicazione verrà cancellato.</p><Field label={`Scrivi “${deleteTarget.groupName}” per confermare`}><Input value={confirmationName} onChange={event => setConfirmationName(event.target.value)} autoFocus disabled={busy} /></Field><div className="flex flex-wrap justify-end gap-2"><Button variant="ghost" onClick={() => setDeleteTarget(undefined)} disabled={busy}>Annulla</Button><Button variant="danger" loading={busy} disabled={confirmationName !== deleteTarget.groupName} onClick={() => void removeGroup()}>Elimina definitivamente</Button></div></div></section></div>}
  </main>
}
