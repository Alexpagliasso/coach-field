import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, CalendarDays, Dumbbell, Mic2, Trophy } from 'lucide-react'
import { Link } from '../groups/navigation'
import { useGroup } from '../groups/groupContext'
import { getCloudTrainingSessionCounts, getCloudTrainingSessions, type CloudTrainingSession, type TrainingSessionCounts } from '../cloud/trainingCloudRepository'
import { getCloudMatches, type CloudMatch } from '../cloud/matchCloudRepository'
import { getWorkGroupRoster, type WorkGroupRosterEntry } from '../cloud/playerCloudRepository'
import { Button, ErrorState, LoadingState } from '../components/ui'
import { DashboardPanel, DashboardSectionHeading, DashboardStatTile } from '../components/DashboardPrimitives'
import { AttendanceTrend, CallupDistribution, MatchTrend, ObjectiveTagDistribution } from '../components/DashboardAnalytics'
import { getDashboardAttendanceTrend, getDashboardCallupDistribution, type AttendanceTrendPoint, type CallupDistributionPoint } from '../cloud/dashboardAnalyticsRepository'
import { aggregateTrainingObjectiveTags, getWorkGroupTrainingObjectiveTagAssociations, type TrainingObjectiveTagTotal } from '../cloud/trainingObjectiveTagsRepository'
import { localDateKey } from '../utils/calendar'
import { WorkGroupRosterPreview } from '../components/WorkGroupRosterPreview'
import { MatchdayCard } from '../components/MatchdayCard'
import { FamilyBoardPreview } from '../components/FamilyBoardPreview'

type AgendaItem = { type: 'training' | 'match'; date: string; title: string; id: string; time?: string; objective?: string; duration?: number; exerciseCount?: number }
const emptyCounts: TrainingSessionCounts = { total: 0, planned: 0, completed: 0 }

function scheduleLabel(item: AgendaItem) {
  const date = new Date(`${item.date}T12:00:00`).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })
  return item.time ? `${date} · ${item.time.slice(0, 5)}` : date
}
function destination(item: AgendaItem) { return item.type === 'training' ? `/training?session=${item.id}` : `/matches/${item.id}` }

export function GroupDashboardPage() {
  const { activeGroup, data } = useGroup()
  const [sessions, setSessions] = useState<CloudTrainingSession[]>([])
  const [counts, setCounts] = useState<TrainingSessionCounts>(emptyCounts)
  const [matches, setMatches] = useState<CloudMatch[]>([])
  const [roster, setRoster] = useState<WorkGroupRosterEntry[]>([])
  const [rosterLoading, setRosterLoading] = useState(true), [rosterError, setRosterError] = useState('')
  const [loading, setLoading] = useState(true), [error, setError] = useState('')
  const [attendanceTrend, setAttendanceTrend] = useState<AttendanceTrendPoint[]>([])
  const [callupDistribution, setCallupDistribution] = useState<CallupDistributionPoint[]>([])
  const [objectiveTagTotals, setObjectiveTagTotals] = useState<TrainingObjectiveTagTotal[]>([])
  const [analyticsLoading, setAnalyticsLoading] = useState(true), [analyticsError, setAnalyticsError] = useState('')
  const request = useRef(0), rosterRequest = useRef(0), analyticsRequest = useRef(0)
  const today = localDateKey(new Date())
  const debug = new URLSearchParams(window.location.search).get('debugTraining') === '1'

  const load = useCallback(async () => {
    if (!activeGroup) return
    const current = ++request.current
    setLoading(true); setError(''); setSessions([]); setCounts(emptyCounts); setMatches([])
    try {
      // Every item on this page is an authorized cloud read; no legacy fallback.
      const [cloudSessions, cloudCounts, cloudMatches] = await Promise.all([
        getCloudTrainingSessions(activeGroup.id), getCloudTrainingSessionCounts(activeGroup.id, today), getCloudMatches(activeGroup.id),
      ])
      if (current !== request.current) return
      setSessions(cloudSessions); setCounts(cloudCounts); setMatches(cloudMatches)
    } catch (cause) {
      if (current === request.current) setError(cause instanceof Error ? cause.message : 'Non siamo riusciti a caricare la dashboard.')
    } finally { if (current === request.current) setLoading(false) }
  }, [activeGroup?.id, today])
  useEffect(() => { void load() }, [load])

  const loadRoster = useCallback(async () => {
    if (!activeGroup) return
    const current = ++rosterRequest.current
    setRosterLoading(true); setRosterError(''); setRoster([])
    try {
      const nextRoster = await getWorkGroupRoster(activeGroup.id)
      if (current !== rosterRequest.current) return
      setRoster(nextRoster)
    } catch (cause) {
      if (current === rosterRequest.current) setRosterError(cause instanceof Error ? cause.message : 'Non siamo riusciti a caricare la rosa.')
    } finally { if (current === rosterRequest.current) setRosterLoading(false) }
  }, [activeGroup?.id])
  useEffect(() => { void loadRoster() }, [loadRoster])

  const loadAnalytics = useCallback(async () => {
    if (!activeGroup) return
    const current = ++analyticsRequest.current
    const from = new Date(); from.setDate(from.getDate() - 90)
    setAnalyticsLoading(true); setAnalyticsError(''); setAttendanceTrend([]); setCallupDistribution([]); setObjectiveTagTotals([])
    try {
      const [attendance, callups, objectiveAssociations] = await Promise.all([getDashboardAttendanceTrend(activeGroup.id), getDashboardCallupDistribution(activeGroup.id, localDateKey(from)), getWorkGroupTrainingObjectiveTagAssociations(activeGroup.id, { from: localDateKey(from), to: today })])
      if (current !== analyticsRequest.current) return
      setAttendanceTrend(attendance); setCallupDistribution(callups); setObjectiveTagTotals(aggregateTrainingObjectiveTags(objectiveAssociations))
    } catch (cause) {
      if (current === analyticsRequest.current) setAnalyticsError(cause instanceof Error ? cause.message : 'Non siamo riusciti a caricare le analisi.')
    } finally { if (current === analyticsRequest.current) setAnalyticsLoading(false) }
  }, [activeGroup?.id, today])
  useEffect(() => { void loadAnalytics() }, [loadAnalytics])

  const organization = data.organizations.find(item => item.id === activeGroup?.organizationId)
  const team = data.teams.find(item => item.id === activeGroup?.teamId)
  const season = data.organizationSeasons.find(item => item.id === team?.seasonId)
  const upcoming = useMemo<AgendaItem[]>(() => [
    ...sessions.filter(item => item.status !== 'completed' && item.sessionDate >= today).map(item => ({ type: 'training' as const, date: item.sessionDate, title: item.title, id: item.id, time: item.startTime ?? undefined, objective: item.objective, duration: item.plannedDurationMinutes, exerciseCount: item.exercises?.length ?? 0 })),
    ...matches.filter(item => item.status !== 'cancelled' && item.matchDate >= today).map(item => ({ type: 'match' as const, date: item.matchDate, title: `vs ${item.opponent}`, id: item.id, time: item.startTime ?? undefined })),
  ].sort((a, b) => (a.date + (a.time ?? '')).localeCompare(b.date + (b.time ?? ''))), [matches, sessions, today])
  const recent = useMemo<AgendaItem[]>(() => [
    ...sessions.filter(item => item.status === 'completed').map(item => ({ type: 'training' as const, date: item.sessionDate, title: item.title, id: item.id, time: item.startTime ?? undefined })),
    ...matches.filter(item => item.status === 'completed').map(item => ({ type: 'match' as const, date: item.matchDate, title: `vs ${item.opponent}`, id: item.id, time: item.startTime ?? undefined })),
  ].sort((a, b) => (b.date + (b.time ?? '')).localeCompare(a.date + (a.time ?? ''))).slice(0, 4), [matches, sessions])
  const nextActivity = upcoming[0]
  const registeredAttendance = attendanceTrend.filter(item => item.marked > 0)
  const attendanceAverage = registeredAttendance.length ? Math.round(registeredAttendance.reduce((sum, item) => sum + item.present / item.marked * 100, 0) / registeredAttendance.length) : undefined
  const completedMatches = matches.filter(item => item.status === 'completed').length
  const todayMatch = useMemo(() => matches
    .filter(item => item.matchDate === today && (item.status === 'scheduled' || item.status === 'live'))
    .sort((left, right) => Number(right.status === 'live') - Number(left.status === 'live') || (left.startTime ?? '').localeCompare(right.startTime ?? ''))[0], [matches, today])
  return <section className="page command-dashboard dashboard-v7">
    <header className="dashboard-v8-header"><div><p className="eyebrow">Dashboard WorkGroup</p><h1>{activeGroup?.name}</h1><p>{[team?.name, season?.name, organization?.name].filter(Boolean).join(' · ')}</p></div></header>

    {!loading && todayMatch && <MatchdayCard match={todayMatch} />}

    {debug && <aside className="mb-4 rounded-xl border border-app-border bg-app-elevated p-3 text-xs" data-testid="training-debug"><strong>Diagnostica dashboard cloud</strong><dl><dt>Route</dt><dd>{window.location.pathname}</dd><dt>WorkGroup</dt><dd>{activeGroup?.id ?? '—'}</dd><dt>Fonti</dt><dd>Supabase · training_sessions, matches, group_player_assignments</dd><dt>Sedute / partite / rosa ricevute</dt><dd>{sessions.length} / {matches.length} / {roster.length}</dd><dt>Errore</dt><dd>{error || rosterError || 'nessuno'}</dd></dl></aside>}
    {error && <ErrorState message={error} action={<Button size="sm" onClick={() => void load()}>Riprova</Button>} />}
    {loading ? <LoadingState label="Caricamento dashboard..." /> : <div className="dashboard-v7-grid">
      <DashboardPanel className="dashboard-v8-next" tone="accent"><div className="dashboard-v8-next-copy"><span className={`dashboard-v8-activity-icon ${nextActivity?.type ?? 'empty'}`}>{nextActivity?.type === 'match' ? <Trophy /> : nextActivity?.type === 'training' ? <Dumbbell /> : <CalendarDays />}</span><div><p className="eyebrow">Prossima attività</p>{nextActivity ? <><h2>{nextActivity.title}</h2><p>{scheduleLabel(nextActivity)}{nextActivity.type === 'training' && nextActivity.duration ? ` · ${nextActivity.duration} minuti` : ''}</p></> : <><h2>Agenda libera</h2><p>Nessuna attività programmata per i prossimi giorni.</p></>}</div></div><Link to={nextActivity ? destination(nextActivity) : '/training'} className="dashboard-v8-primary-link">{nextActivity ? 'Apri dettaglio' : 'Pianifica una seduta'} <ArrowRight size={17} /></Link></DashboardPanel>
      <section className="dashboard-v8-kpis" aria-label="Indicatori WorkGroup"><DashboardStatTile label="Giocatori" value={rosterLoading ? '—' : roster.length} detail="assegnati al gruppo" /><DashboardStatTile label="Presenza media" value={analyticsLoading || attendanceAverage == null ? '—' : `${attendanceAverage}%`} detail={attendanceAverage == null ? 'nessun registro' : `${registeredAttendance.length} sedute registrate`} /><DashboardStatTile label="Allenamenti" value={counts.completed} detail={`su ${counts.total} in archivio`} /><DashboardStatTile label="Partite" value={completedMatches} detail={`su ${matches.length} in archivio`} /></section>
      <DashboardPanel className="dashboard-v7-attendance" tone="accent"><DashboardSectionHeading eyebrow="Continuità" title="Presenze alle ultime sedute" />{analyticsLoading ? <LoadingState label="Caricamento presenze..." /> : analyticsError ? <ErrorState message={analyticsError} action={<Button size="sm" onClick={() => void loadAnalytics()}>Riprova</Button>} /> : <AttendanceTrend items={attendanceTrend} />}<p className="analytics-note">Percentuale = presenti / stati esplicitamente registrati. I non segnati non sono assenze.</p></DashboardPanel>
      <DashboardPanel className="dashboard-v7-results"><DashboardSectionHeading eyebrow="Andamento squadra" title="Gol nelle ultime partite concluse" /><MatchTrend matches={matches} /></DashboardPanel>
      <DashboardPanel className="dashboard-v8-upcoming"><DashboardSectionHeading eyebrow="Agenda" title="Prossimi appuntamenti" action={<Link to="/calendar" className="dashboard-text-link">Calendario <ArrowRight size={15} /></Link>} />{upcoming.length ? <div className="dashboard-v7-commitment-list">{upcoming.slice(0, 4).map(item => <div key={`${item.type}-${item.id}`} className={`dashboard-v7-commitment ${item.type}`}><span className="dashboard-v7-commitment-icon">{item.type === 'training' ? <Dumbbell size={17} /> : <Trophy size={17} />}</span><div><small>{item.type === 'training' ? 'Allenamento' : 'Partita'}</small><strong>{item.title}</strong><p>{scheduleLabel(item)}</p></div><Link to={destination(item)} aria-label={`Apri ${item.title}`}><ArrowRight size={17} /></Link></div>)}</div> : <div className="dashboard-v7-empty"><CalendarDays size={20} /><p>Nessun appuntamento futuro per questo WorkGroup.</p></div>}</DashboardPanel>
      {activeGroup && <FamilyBoardPreview groupId={activeGroup.id} />}
      <DashboardPanel className="dashboard-v7-callups"><DashboardSectionHeading eyebrow="Distribuzione" title="Convocazioni · 90 giorni" />{analyticsLoading ? <LoadingState label="Caricamento convocazioni..." /> : analyticsError ? <ErrorState message={analyticsError} action={<Button size="sm" onClick={() => void loadAnalytics()}>Riprova</Button>} /> : <CallupDistribution items={callupDistribution} />}<p className="analytics-note">Indicatore descrittivo, non un giudizio automatico sull’equità delle scelte.</p></DashboardPanel>
      <DashboardPanel className="dashboard-v7-objectives" tone="quiet"><DashboardSectionHeading eyebrow="Metodo" title="Obiettivi tecnici" />{analyticsLoading ? <LoadingState label="Caricamento obiettivi tecnici..." /> : analyticsError ? <ErrorState message={analyticsError} action={<Button size="sm" onClick={() => void loadAnalytics()}>Riprova</Button>} /> : <ObjectiveTagDistribution items={objectiveTagTotals} periodLabel="ultimi 90 giorni" />}</DashboardPanel>
      <DashboardPanel className="dashboard-v7-recent"><DashboardSectionHeading eyebrow="Registro" title="Attività recenti" action={<Link to="/training" className="dashboard-text-link">Archivio <ArrowRight size={15} /></Link>} />{recent.length ? <div className="dashboard-v7-feed">{recent.map(item => <Link key={`${item.type}-${item.id}`} to={destination(item)}><span className={`dashboard-feed-icon ${item.type}`}>{item.type === 'training' ? <Dumbbell size={16} /> : <Trophy size={16} />}</span><div><strong>{item.title}</strong><small>{scheduleLabel(item)} · {item.type === 'training' ? 'Allenamento completato' : 'Partita completata'}</small></div><ArrowRight size={16} /></Link>)}</div> : <div className="dashboard-v7-empty"><Mic2 size={20} /><p>Le ultime sedute e partite completate compariranno qui.</p></div>}</DashboardPanel>
      <DashboardPanel className="dashboard-v7-summary" tone="quiet"><DashboardSectionHeading eyebrow="Gruppo" title="Riepilogo gruppo" /><div className="dashboard-v7-stat-grid"><DashboardStatTile label="Giocatori" value={rosterLoading ? '—' : roster.length} detail="assegnati stabilmente" /><DashboardStatTile label="Allenamenti" value={counts.total} detail="sedute" /><DashboardStatTile label="Completati" value={counts.completed} detail="storico allenamenti" /><DashboardStatTile label="Partite" value={matches.length} detail="in archivio" /></div></DashboardPanel>
      <DashboardPanel className="dashboard-v7-roster"><DashboardSectionHeading eyebrow="Persone" title="Rosa del gruppo" action={<Link to="/players" className="dashboard-text-link">Vedi tutti <ArrowRight size={15} /></Link>} />{rosterLoading ? <LoadingState label="Caricamento rosa..." /> : rosterError ? <ErrorState message={rosterError} action={<Button size="sm" onClick={() => void loadRoster()}>Riprova</Button>} /> : <WorkGroupRosterPreview roster={roster} />}</DashboardPanel>
    </div>}
  </section>
}
