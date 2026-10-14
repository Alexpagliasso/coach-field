import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Dumbbell, Trophy } from 'lucide-react'
import { Link } from '../groups/navigation'
import { useGroup } from '../groups/groupContext'
import { getCloudTrainingSessionsInRange, type CloudTrainingSession } from '../cloud/trainingCloudRepository'
import { getCloudMatches, type CloudMatch } from '../cloud/matchCloudRepository'
import { Button, ErrorState, LoadingState } from '../components/ui'
import { localDateKey, mondayFirstOffset } from '../utils/calendar'

type CalendarFilter = 'all' | 'training' | 'match'
type Event = { id: string; date: string; time?: string; type: 'training' | 'match'; title: string; to: string }
const monthBounds = (month: Date) => {
  const year = month.getFullYear(); const number = String(month.getMonth() + 1).padStart(2, '0')
  return { from: `${year}-${number}-01`, to: `${year}-${number}-${String(new Date(year, month.getMonth() + 1, 0).getDate()).padStart(2, '0')}` }
}

export function CalendarPage() {
  const { activeGroup } = useGroup()
  const [sessions, setSessions] = useState<CloudTrainingSession[]>([])
  const [matches, setMatches] = useState<CloudMatch[]>([])
  const [loading, setLoading] = useState(true), [error, setError] = useState('')
  const [month, setMonth] = useState(() => { const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), 1) })
  const [filter, setFilter] = useState<CalendarFilter>('all')
  const request = useRef(0)
  const { from: monthStart, to: monthEnd } = monthBounds(month)
  const debug = new URLSearchParams(window.location.search).get('debugTraining') === '1'
  const load = useCallback(async () => {
    if (!activeGroup) return
    const current = ++request.current
    setLoading(true); setError(''); setSessions([]); setMatches([])
    try {
      const [cloudSessions, cloudMatches] = await Promise.all([
        getCloudTrainingSessionsInRange(activeGroup.id, monthStart, monthEnd),
        getCloudMatches(activeGroup.id, monthStart, monthEnd),
      ])
      if (current !== request.current) return
      setSessions(cloudSessions); setMatches(cloudMatches)
    } catch (cause) {
      if (current === request.current) setError(cause instanceof Error ? cause.message : 'Impossibile caricare il calendario cloud.')
    } finally { if (current === request.current) setLoading(false) }
  }, [activeGroup?.id, monthStart, monthEnd])
  useEffect(() => { void load() }, [load])
  const days = useMemo<Array<Date | null>>(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1); const last = new Date(month.getFullYear(), month.getMonth() + 1, 0)
    return [...Array.from({ length: mondayFirstOffset(first) }, () => null), ...Array.from({ length: last.getDate() }, (_, index) => new Date(month.getFullYear(), month.getMonth(), index + 1))]
  }, [month])
  const agenda = useMemo<Event[]>(() => [
    ...(filter !== 'match' ? sessions.map(item => ({ id: item.id, date: item.sessionDate, time: item.startTime ?? undefined, type: 'training' as const, title: item.title, to: `/training?session=${item.id}` })) : []),
    ...(filter !== 'training' ? matches.map(item => ({ id: item.id, date: item.matchDate, time: item.startTime ?? undefined, type: 'match' as const, title: `vs ${item.opponent}`, to: `/matches/${item.id}` })) : []),
  ].sort((a, b) => (a.date + (a.time ?? '')).localeCompare(b.date + (b.time ?? ''))), [filter, matches, sessions])
  const eventsFor = (key: string) => agenda.filter(item => item.date === key)
  const title = month.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })
  return <section className="page calendar-command-page">
    <header className="page-header"><span className="eyebrow">{activeGroup?.name} · Agenda cloud</span><h1>Calendario</h1><p>Allenamenti e partite cloud del WorkGroup, organizzati nel tempo.</p></header>
    {debug && <aside className="mb-4 rounded-xl border border-app-border bg-app-elevated p-3 text-xs" data-testid="training-debug"><strong>Diagnostica calendario cloud</strong><dl><dt>Route</dt><dd>{window.location.pathname}</dd><dt>WorkGroup</dt><dd>{activeGroup?.id ?? '—'}</dd><dt>Fonte</dt><dd>Supabase · training_sessions, matches</dd><dt>Intervallo</dt><dd>{monthStart} → {monthEnd}</dd><dt>Sedute ricevute / eventi allenamento</dt><dd>{sessions.length} / {agenda.filter(item => item.type === 'training').length}</dd><dt>Partite ricevute / eventi partita</dt><dd>{matches.length} / {agenda.filter(item => item.type === 'match').length}</dd><dt>Errore</dt><dd>{error || 'nessuno'}</dd></dl></aside>}
    {error && <ErrorState message={error} action={<Button size="sm" onClick={() => void load()}>Riprova</Button>} />}
    {loading ? <LoadingState label="Caricamento calendario cloud..." /> : <><div className="calendar-toolbar"><div className="calendar-month-control"><button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="Mese precedente"><ChevronLeft /></button><div><span>Periodo</span><strong>{title}</strong></div><button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="Mese successivo"><ChevronRight /></button></div><button type="button" className="calendar-today" onClick={() => { const now = new Date(); setMonth(new Date(now.getFullYear(), now.getMonth(), 1)) }}>Oggi</button><div className="calendar-filters" role="group" aria-label="Filtra eventi">{([['all', 'Tutti'], ['training', 'Allenamenti'], ['match', 'Partite']] as const).map(([value, label]) => <button key={value} type="button" className={filter === value ? 'active' : ''} onClick={() => setFilter(value)} aria-pressed={filter === value}>{label}</button>)}</div></div><div className="calendar-month-grid" aria-label={`Calendario ${title}`}><div className="calendar-weekdays">{['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map(day => <span key={day}>{day}</span>)}</div><div className="calendar-days">{days.map((day, index) => day ? <article key={localDateKey(day)} className={localDateKey(day) === localDateKey(new Date()) ? 'today' : ''}><time dateTime={localDateKey(day)}>{day.getDate()}</time><div>{eventsFor(localDateKey(day)).map(event => <Link key={`${event.type}-${event.id}`} to={event.to} className={event.type}>{event.type === 'training' ? <Dumbbell /> : <Trophy />}<span>{event.time ? `${event.time.slice(0, 5)} · ` : ''}{event.title}</span></Link>)}</div></article> : <i key={`blank-${index}`} />)}</div></div><section className="calendar-mobile-agenda" aria-labelledby="mobile-agenda-title"><div className="calendar-agenda-heading"><div><span className="eyebrow">Vista agenda</span><h2 id="mobile-agenda-title">{month.toLocaleDateString('it-IT', { month: 'long' })}</h2></div><CalendarDays /></div><div>{agenda.map(event => <Link key={`${event.type}-${event.id}`} to={event.to}><time dateTime={event.date}><strong>{Number(event.date.slice(8, 10))}</strong><span>{new Date(`${event.date}T12:00:00`).toLocaleDateString('it-IT', { weekday: 'short' })}</span></time><i className={event.type}>{event.type === 'training' ? <Dumbbell /> : <Trophy />}</i><span><strong>{event.title}</strong><small>{event.type === 'training' ? `Allenamento${event.time ? ` · ${event.time.slice(0, 5)}` : ''}` : `Partita${event.time ? ` · ${event.time.slice(0, 5)}` : ''}`}</small></span><ChevronRight /></Link>)}{agenda.length === 0 && <p className="empty-state">Nessuna attività in questo mese.</p>}</div></section></>}
  </section>
}
