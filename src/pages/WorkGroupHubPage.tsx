import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowLeft, ArrowRight, Plus, Settings } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/authContext'
import {
  createTeamRosterPlayer,
  getActiveGroupAssignments,
  getOrganizationPlayerArchiveEligibility,
  getTeamRoster,
  setTeamRosterPlayerGroup,
  type GroupPlayerAssignment,
  type TeamRosterEntry,
} from '../cloud/playerCloudRepository'
import { saveGroup } from '../cloud/staffRepository'
import { CategoryRoster } from '../components/CategoryRoster'
import { Button, Card, EmptyState, ErrorState, Field, Input, LoadingState, PageHeader, Select } from '../components/ui'
import { useGroup } from '../groups/groupContext'
import { errorMessage } from '../lib/supabase'
import { getCategoryBirthYearOptions, isAllowedCategoryBirthYear, resolveFootballCategory } from '../utils/categoryBirthYears'

export function WorkGroupHubPage() {
  const { organizationId, seasonId, teamId } = useParams()
  const { data, reload, switchGroup } = useGroup()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [groupOpen, setGroupOpen] = useState(false)
  const [playerOpen, setPlayerOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [roster, setRoster] = useState<TeamRosterEntry[]>([])
  const [assignments, setAssignments] = useState<GroupPlayerAssignment[]>([])
  const [archiveEligiblePlayerIds, setArchiveEligiblePlayerIds] = useState<Set<string>>(new Set())
  const [rosterLoading, setRosterLoading] = useState(false)
  const [rosterError, setRosterError] = useState('')
  const [assignmentTarget, setAssignmentTarget] = useState<TeamRosterEntry>()
  const [selectedGroupId, setSelectedGroupId] = useState('')
  const [removeOpen, setRemoveOpen] = useState(false)
  const lock = useRef(false)
  const organization = data.organizations.find(item => item.id === organizationId)
  const season = data.organizationSeasons.find(item => item.id === seasonId && item.organizationId === organizationId)
  const team = data.teams.find(item => item.id === teamId && item.organizationId === organizationId && item.seasonId === seasonId)
  const footballCategory = resolveFootballCategory(team?.name)
  const birthYearOptions = getCategoryBirthYearOptions(season?.name, footballCategory)
  const admin = Boolean(organizationId && data.organizationMemberships.some(item => item.organizationId === organizationId && item.userId === user?.id && item.active))
  const groups = data.groups.filter(group => group.teamId === teamId && (admin || data.memberships.some(item => item.groupId === group.id && item.userId === user?.id && item.active)))
  const activeTeamGroups = data.groups.filter(group => group.organizationId === organizationId && group.teamId === teamId && group.active)
  const parentRoute = `/app/organizations/${organizationId}/seasons/${seasonId}/teams/${teamId}`

  const loadRoster = useCallback(async () => {
    if (!teamId) return
    setRosterLoading(true)
    setRosterError('')
    try {
      const [nextRoster, nextAssignments] = await Promise.all([getTeamRoster(teamId), getActiveGroupAssignments(teamId)])
      const nextArchiveEligibility = admin && organizationId
        ? await getOrganizationPlayerArchiveEligibility(organizationId, nextRoster.map(entry => entry.player.id))
        : new Set<string>()
      setRoster(nextRoster)
      setAssignments(nextAssignments)
      setArchiveEligiblePlayerIds(nextArchiveEligibility)
    } catch (reason) { setRosterError(errorMessage(reason)) }
    finally { setRosterLoading(false) }
  }, [admin, organizationId, teamId])

  useEffect(() => { void loadRoster() }, [loadRoster])

  const closeGroupCreate = () => { setGroupOpen(false); setError(''); navigate(parentRoute) }
  const closePlayerCreate = () => { setPlayerOpen(false); setError(''); navigate(parentRoute) }
  const createGroup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!organization || !team || lock.current) return
    const name = String(new FormData(event.currentTarget).get('name')).trim()
    if (!name) { setError('Inserisci il nome del gruppo.'); return }
    lock.current = true; setBusy(true); setError('')
    try { await saveGroup({ organizationId: organization.id, teamId: team.id, name }); await reload(); setGroupOpen(false) }
    catch (reason) { setError(errorMessage(reason)) }
    finally { lock.current = false; setBusy(false) }
  }
  const createPlayer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!organization || !team || lock.current) return
    const form = new FormData(event.currentTarget)
    const firstName = String(form.get('firstName')).trim()
    const lastName = String(form.get('lastName')).trim()
    const birthYearValue = String(form.get('birthYear')).trim()
    const birthYear = birthYearValue ? Number(birthYearValue) : undefined
    if (!firstName || !lastName) { setError('Nome e cognome sono obbligatori.'); return }
    if (birthYear !== undefined && !isAllowedCategoryBirthYear(birthYear, birthYearOptions)) { setError('Anno di nascita non compatibile con stagione e categoria.'); return }
    lock.current = true; setBusy(true); setError('')
    try {
      await createTeamRosterPlayer({ organizationId: organization.id, teamId: team.id, firstName, lastName, birthYear })
      await loadRoster()
      setPlayerOpen(false)
    } catch (reason) { setError(errorMessage(reason)) }
    finally { lock.current = false; setBusy(false) }
  }
  const closeAssignment = () => {
    if (busy) return
    setAssignmentTarget(undefined); setRemoveOpen(false); setSelectedGroupId(''); setError('')
  }
  const openAssignment = (entry: TeamRosterEntry) => {
    const current = assignments.find(item => item.teamPlayerMembershipId === entry.membership.id)
    const selectableCurrentGroup = activeTeamGroups.some(group => group.id === current?.groupId) ? current?.groupId : ''
    setAssignmentTarget(entry); setSelectedGroupId(selectableCurrentGroup ?? ''); setRemoveOpen(false); setError('')
  }
  const saveAssignment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!assignmentTarget || !selectedGroupId || lock.current) return
    lock.current = true; setBusy(true); setError('')
    try {
      await setTeamRosterPlayerGroup(assignmentTarget.membership.id, selectedGroupId)
      await loadRoster()
      setAssignmentTarget(undefined); setSelectedGroupId('')
    } catch (reason) { setError(errorMessage(reason)) }
    finally { lock.current = false; setBusy(false) }
  }
  const removeAssignment = async () => {
    if (!assignmentTarget || lock.current) return
    lock.current = true; setBusy(true); setError('')
    try {
      await setTeamRosterPlayerGroup(assignmentTarget.membership.id, null)
      await loadRoster()
      setAssignmentTarget(undefined); setRemoveOpen(false); setSelectedGroupId('')
    } catch (reason) { setError(errorMessage(reason)) }
    finally { lock.current = false; setBusy(false) }
  }

  if (!organization || !season || !team) return <main className="gp-hub"><Link to={`/app/organizations/${organizationId}/seasons/${seasonId}`}>Categoria non disponibile</Link></main>

  return <main className="gp-hub hierarchy-page workgroup-command-hub">
    <PageHeader eyebrow={`${organization.name} · Stagione ${season.name}`} title={team.name} description="Rosa della categoria e gruppi di lavoro." actions={<Link className="inline-flex min-h-12 items-center gap-2 font-semibold" to={`/app/organizations/${organization.id}/seasons/${season.id}`}><ArrowLeft size={18} />Categorie</Link>} />

    <section className="mb-10 category-roster-section" aria-labelledby="category-roster-title">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><p className="eyebrow">Rosa completa · TeamPlayerMembership</p><h2 id="category-roster-title" className="mt-1 text-2xl font-bold">Rosa giocatori</h2><p className="mt-1 text-sm text-app-muted">Giocatori appartenenti a {team.name}, inclusi quelli non assegnati a un WorkGroup.</p></div>{admin && <Button variant="primary" onClick={() => { setPlayerOpen(true); setError('') }}><Plus size={18} />Aggiungi giocatore</Button>}</div>
      {rosterLoading ? <LoadingState label="Caricamento rosa…" /> : rosterError ? <ErrorState message={rosterError} action={<Button onClick={() => void loadRoster()}>Riprova</Button>} /> : roster.length === 0 ? <EmptyState title="Nessun giocatore nella rosa" description="Aggiungi il primo giocatore alla categoria." action={admin ? <Button variant="primary" onClick={() => { setPlayerOpen(true); setError('') }}>Aggiungi il primo giocatore</Button> : undefined} /> : <CategoryRoster roster={roster} assignments={assignments} groups={data.groups} teamName={team.name} organizationId={organization.id} admin={admin} archiveEligiblePlayerIds={archiveEligiblePlayerIds} onAssign={openAssignment} onRemoveFromGroup={(entry) => { openAssignment(entry); setRemoveOpen(true) }} onRefresh={loadRoster} />}
    </section>

    <section className="category-workgroups-section" aria-labelledby="workgroups-title">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><p className="eyebrow">Organizzazione operativa</p><h2 id="workgroups-title" className="mt-1 text-2xl font-bold">Gruppi della categoria</h2><p className="mt-1 text-sm text-app-muted">Suddivisioni interne della categoria e rispettive assegnazioni.</p></div>{admin && <Button variant="primary" onClick={() => { setGroupOpen(true); setError('') }}><Plus size={18} />Nuovo gruppo</Button>}</div>
      <div className="category-workgroups-grid">{groups.map(group => { const assigned = assignments.filter(item => item.groupId === group.id && item.status === 'active').length; return <Card key={group.id} className="category-workgroup-card" padding="sm"><div className="category-workgroup-card-top"><span className="eyebrow">WorkGroup</span><span>{assigned} {assigned === 1 ? 'giocatore' : 'giocatori'}</span></div><h3>{group.name}</h3><p>{team.name} · {group.active ? 'Attivo' : 'Non attivo'}</p><div className="flex flex-wrap gap-2"><Button size="sm" variant="primary" onClick={() => { switchGroup(group.id); navigate(`/app/${group.id}/dashboard`) }}>Apri gruppo <ArrowRight size={16} /></Button>{admin && <Button size="sm" onClick={() => navigate(`/app/${group.id}/settings`)}><Settings size={16} />Impostazioni</Button>}</div></Card> })}</div>
      {groups.length === 0 && <Card padding="lg"><p>Nessun gruppo disponibile.</p></Card>}
    </section>

    {assignmentTarget && <div className="sheet-backdrop" role="presentation"><section className="add-player-sheet" role="dialog" aria-modal="true" aria-labelledby="group-assignment-title"><div className="sheet-handle" /><header className="exercise-sheet-header"><div><button type="button" className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-app-muted" onClick={closeAssignment} disabled={busy}><ArrowLeft size={17} />Torna alla rosa</button><span className="eyebrow">WorkGroup · {team.name}</span><h1 id="group-assignment-title">{removeOpen ? 'Rimuovi dal gruppo' : assignments.some(item => item.teamPlayerMembershipId === assignmentTarget.membership.id) ? 'Cambia gruppo' : 'Assegna a gruppo'}</h1><p className="mt-2 text-sm text-app-muted">{assignmentTarget.player.firstName} {assignmentTarget.player.lastName}</p></div></header>{removeOpen ? <div className="add-player-scroll"><p>Confermi la rimozione dal WorkGroup attuale? La rosa della categoria non verrà modificata.</p>{error && <ErrorState message={error} />}<div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="ghost" onClick={closeAssignment} disabled={busy}>Annulla</Button><Button type="button" variant="danger" loading={busy} onClick={() => void removeAssignment()}>Conferma rimozione</Button></div></div> : <form className="add-player-scroll" onSubmit={saveAssignment}><Field label="WorkGroup"><Select value={selectedGroupId} onChange={event => setSelectedGroupId(event.target.value)} required autoFocus disabled={busy}><option value="">Seleziona un gruppo</option>{activeTeamGroups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}</Select></Field>{assignments.some(item => item.teamPlayerMembershipId === assignmentTarget.membership.id) && <p className="text-sm text-app-muted">Il salvataggio sostituirà l’assegnazione attuale. Conferma esplicitamente il cambio.</p>}{activeTeamGroups.length === 0 && <ErrorState message="Non ci sono WorkGroup attivi per questa categoria." />}{error && <ErrorState message={error} />}<div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="ghost" onClick={closeAssignment} disabled={busy}>Annulla</Button><Button variant="primary" loading={busy} disabled={!selectedGroupId || activeTeamGroups.length === 0}>{assignments.some(item => item.teamPlayerMembershipId === assignmentTarget.membership.id) ? 'Conferma cambio' : 'Assegna'}</Button></div></form>}</section></div>}

    {playerOpen && <div className="sheet-backdrop" role="presentation"><section className="add-player-sheet" role="dialog" aria-modal="true" aria-label="Aggiungi giocatore"><div className="sheet-handle" /><header className="exercise-sheet-header"><div><button type="button" className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-app-muted" onClick={closePlayerCreate} disabled={busy}><ArrowLeft size={17} />Torna a {team.name}</button><span className="eyebrow">Rosa · {team.name}</span><h1>Aggiungi giocatore</h1><p className="mt-2 text-sm text-app-muted">Il giocatore entrerà nella rosa della categoria, senza assegnazione automatica a un gruppo.</p></div></header><form className="add-player-scroll" onSubmit={createPlayer}><Field label="Nome"><Input name="firstName" required autoFocus disabled={busy} maxLength={120} /></Field><Field label="Cognome"><Input name="lastName" required disabled={busy} maxLength={120} /></Field><Field label="Anno di nascita" hint={birthYearOptions.length ? `Annate calcolate per ${footballCategory?.label} · ${footballCategory?.ageBand}, stagione ${season.name}.` : 'Annata non determinabile in modo affidabile per questa categoria: lascia il valore non indicato.'}><Select name="birthYear" defaultValue="" disabled={busy}><option value="">Non indicato</option>{birthYearOptions.map(option => <option key={option.year} value={option.year}>{option.label}</option>)}</Select></Field>{error && <ErrorState message={error} />}<div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="ghost" onClick={closePlayerCreate} disabled={busy}>Annulla</Button><Button variant="primary" loading={busy}>Crea giocatore</Button></div></form></section></div>}

    {groupOpen && <div className="sheet-backdrop" role="presentation"><section className="add-player-sheet" role="dialog" aria-modal="true" aria-label="Nuovo gruppo"><div className="sheet-handle" /><header className="exercise-sheet-header"><div><button type="button" className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-app-muted" onClick={closeGroupCreate} disabled={busy}><ArrowLeft size={17} />Torna a {team.name}</button><span className="eyebrow">{season.name} · {team.name}</span><h1>Nuovo gruppo</h1><p className="mt-2 text-sm text-app-muted">Definisci il nome interno del gruppo di lavoro.</p></div></header><form className="add-player-scroll" onSubmit={createGroup}><Field label="Nome gruppo"><Input name="name" placeholder="Rossi, Blu, Gruppo A…" required autoFocus disabled={busy} /></Field>{error && <ErrorState message={error} />}<div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="ghost" onClick={closeGroupCreate} disabled={busy}>Annulla</Button><Button variant="primary" loading={busy}>Crea gruppo</Button></div></form></section></div>}
  </main>
}
