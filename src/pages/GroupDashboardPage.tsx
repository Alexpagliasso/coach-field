import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, CalendarDays, Dumbbell, Mic2, Trophy, Users } from 'lucide-react'
import { Link } from '../groups/navigation'
import { useGroup } from '../groups/groupContext'
import { getCloudTrainingSessionCounts, getCloudTrainingSessions, type CloudTrainingSession, type TrainingSessionCounts } from '../cloud/trainingCloudRepository'
import { getCloudMatches, type CloudMatch } from '../cloud/matchCloudRepository'
import { getWorkGroupRoster, type WorkGroupRosterEntry } from '../cloud/playerCloudRepository'
import { Badge, Button, Card, ErrorState, LoadingState } from '../components/ui'
import { localDateKey } from '../utils/calendar'
import { WorkGroupRosterPreview } from '../components/WorkGroupRosterPreview'

type AgendaItem = { type: 'training' | 'match'; date: string; title: string; id: string; time?: string; objective?: string; duration?: number; exerciseCount?: number }
const emptyCounts: TrainingSessionCounts = { total: 0, planned: 0, completed: 0 }

export function GroupDashboardPage() {
  const { activeGroup, data } = useGroup()
  const [sessions, setSessions] = useState<CloudTrainingSession[]>([])
  const [counts, setCounts] = useState<TrainingSessionCounts>(emptyCounts)
  const [matches, setMatches] = useState<CloudMatch[]>([])
  const [roster, setRoster] = useState<WorkGroupRosterEntry[]>([])
  const [rosterLoading, setRosterLoading] = useState(true), [rosterError, setRosterError] = useState('')
  const [loading, setLoading] = useState(true), [error, setError] = useState('')
  const request = useRef(0), rosterRequest = useRef(0)
  const today = localDateKey(new Date())
  const debug = new URLSearchParams(window.location.search).get('debugTraining') === '1'
  const load = useCallback(async () => {
    if (!activeGroup) return
    const current = ++request.current
    setLoading(true); setError(''); setSessions([]); setCounts(emptyCounts); setMatches([])
    try {
      // Training and matches remain separate cloud sources. A failed request is
      // visible to the coach; it never falls back to IndexedDB.
      const [cloudSessions, cloudCounts, cloudMatches] = await Promise.all([
        getCloudTrainingSessions(activeGroup.id),
        getCloudTrainingSessionCounts(activeGroup.id, today),
        getCloudMatches(activeGroup.id, today),
      ])
      if (current !== request.current) return
      setSessions(cloudSessions); setCounts(cloudCounts); setMatches(cloudMatches)
    } catch (cause) {
      if (current === request.current) setError(cause instanceof Error ? cause.message : 'Impossibile caricare la dashboard cloud.')
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
      if (current === rosterRequest.current) setRosterError(cause instanceof Error ? cause.message : 'Impossibile caricare la rosa cloud.')
    } finally { if (current === rosterRequest.current) setRosterLoading(false) }
  }, [activeGroup?.id])
  useEffect(() => { void loadRoster() }, [loadRoster])
  const organization = data.organizations.find(item => item.id === activeGroup?.organizationId)
  const team = data.teams.find(item => item.id === activeGroup?.teamId)
  const agenda = useMemo<AgendaItem[]>(() => [
    ...sessions.filter(item => item.status !== 'completed' && item.sessionDate >= today).map(item => ({ type: 'training' as const, date: item.sessionDate, title: item.title, id: item.id, time: item.startTime ?? undefined, objective: item.objective, duration: item.plannedDurationMinutes, exerciseCount: item.exercises?.length ?? 0 })),
    ...matches.filter(item => item.status !== 'cancelled').map(item => ({ type: 'match' as const, date: item.matchDate, title: `vs ${item.opponent}`, id: item.id, time: item.startTime ?? undefined })),
  ].sort((a, b) => (a.date + (a.time ?? '')).localeCompare(b.date + (b.time ?? ''))), [matches, sessions, today])
  const nextTraining = agenda.find(item => item.type === 'training')
  const nextMatch = agenda.find(item => item.type === 'match')
  return <section className="page command-dashboard">
    <header className="command-dashboard-hero"><div><Badge variant="primary">Command center</Badge><p>Workspace operativo · Cloud</p><h1>{activeGroup?.name}</h1><span>{organization?.name}{team ? ` · ${team.name}` : ''} · Allenamenti e partite sincronizzati con il WorkGroup.</span></div><div className="command-hero-mark" aria-hidden="true"><span>GP</span><i /></div></header>
    {debug && <aside className="mb-4 rounded-xl border border-app-border bg-app-elevated p-3 text-xs" data-testid="training-debug"><strong>Diagnostica dashboard cloud</strong><dl><dt>Route</dt><dd>{window.location.pathname}</dd><dt>WorkGroup</dt><dd>{activeGroup?.id ?? '—'}</dd><dt>Fonti</dt><dd>Supabase · training_sessions, matches, group_player_assignments</dd><dt>Sedute / partite / rosa ricevute</dt><dd>{sessions.length} / {matches.length} / {roster.length}</dd><dt>Errore</dt><dd>{error || rosterError || 'nessuno'}</dd></dl></aside>}
    {error && <ErrorState message={error} action={<Button size="sm" onClick={() => void load()}>Riprova</Button>} />}
    {loading ? <LoadingState label="Caricamento dashboard cloud..." /> : <><div className="dashboard-command-grid"><Card className="dashboard-next" padding="lg"><div className="dashboard-card-heading"><div><span className="eyebrow">Prossimo allenamento</span><h2>{nextTraining?.title ?? 'Agenda libera'}</h2></div><Dumbbell size={22} /></div>{nextTraining ? <><p>{new Date(`${nextTraining.date}T12:00:00`).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}{nextTraining.time ? ` · ${nextTraining.time.slice(0, 5)}` : ''}</p><small>{nextTraining.objective || 'Obiettivo da definire'} · {nextTraining.duration} min · {nextTraining.exerciseCount} esercizi</small><Link className="dashboard-inline-action" to={`/training?session=${nextTraining.id}`}>Apri allenamento <ArrowRight size={17} /></Link></> : <><p>Non ci sono allenamenti futuri per questo WorkGroup.</p><Link className="dashboard-inline-action" to="/training">Pianifica allenamento <ArrowRight size={17} /></Link></>}</Card><Card className="dashboard-next" padding="lg"><div className="dashboard-card-heading"><div><span className="eyebrow">Prossima partita</span><h2>{nextMatch?.title ?? 'Nessuna partita'}</h2></div><Trophy size={22} /></div>{nextMatch ? <><p>{new Date(`${nextMatch.date}T12:00:00`).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}{nextMatch.time ? ` · ${nextMatch.time.slice(0, 5)}` : ''}</p><small>Partita cloud del WorkGroup attivo.</small><Link className="dashboard-inline-action" to={`/matches/${nextMatch.id}`}>Apri partita <ArrowRight size={17} /></Link></> : <><p>Non ci sono partite future per questo WorkGroup.</p><Link className="dashboard-inline-action" to="/matches">Gestisci partite <ArrowRight size={17} /></Link></>}</Card><Card className="dashboard-roster" padding="lg"><div className="dashboard-card-heading"><div><span className="eyebrow">Rosa WorkGroup</span><h2>{rosterLoading ? 'Caricamento...' : `${roster.length} giocatori`}</h2></div><Users size={22} /></div>{rosterLoading ? <LoadingState label="Caricamento rosa cloud..." /> : rosterError ? <ErrorState message={rosterError} action={<Button size="sm" onClick={() => void loadRoster()}>Riprova</Button>} /> : <><WorkGroupRosterPreview roster={roster} /><Link className="dashboard-inline-action" to="/players">Vedi tutti <ArrowRight size={17} /></Link></>}</Card><Card className="dashboard-agenda" padding="lg"><div className="dashboard-card-heading"><div><span className="eyebrow">Agenda</span><h2>In arrivo</h2></div><CalendarDays size={22} /></div><div className="dashboard-agenda-list">{agenda.slice(0, 4).map(item => <Link key={`${item.type}-${item.id}`} to={item.type === 'training' ? `/training?session=${item.id}` : `/matches/${item.id}`}><span className={item.type}>{item.type === 'training' ? <Dumbbell size={17} /> : <Trophy size={17} />}</span><div><strong>{item.title}</strong><small>{new Date(`${item.date}T12:00:00`).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}{item.time ? ` · ${item.time.slice(0, 5)}` : ''}</small></div><ArrowRight size={16} /></Link>)}{agenda.length === 0 && <p className="dashboard-empty-copy">Nessuna attività programmata.</p>}</div><Link className="dashboard-inline-action" to="/calendar">Calendario completo <ArrowRight size={17} /></Link></Card><div className="dashboard-stat-grid"><article><span>Allenamenti</span><strong>{counts.total}</strong><small>cloud nel WorkGroup</small></article><article><span>Partite</span><strong>{matches.length}</strong><small>cloud in programma</small></article><article><span>Completate</span><strong>{counts.completed}</strong><small>sedute cloud</small></article></div></div><section className="dashboard-quick-section"><div><span className="eyebrow">Accessi rapidi</span><h2>Vai al lavoro</h2></div><div className="dashboard-quick-grid"><Link to="/training"><Dumbbell /><span><strong>Allenamenti</strong><small>Costruisci la seduta</small></span><ArrowRight /></Link><Link to="/matches"><Trophy /><span><strong>Partite</strong><small>Gestisci convocazioni</small></span><ArrowRight /></Link><Link to="/calendar"><CalendarDays /><span><strong>Calendario</strong><small>Vedi l'agenda</small></span><ArrowRight /></Link><Link to="/players"><Users /><span><strong>Giocatori</strong><small>Consulta lo sviluppo</small></span><ArrowRight /></Link><Link to="/notes"><Mic2 /><span><strong>Osservazioni</strong><small>Cattura dal campo</small></span><ArrowRight /></Link></div></section></>}
  </section>
}
