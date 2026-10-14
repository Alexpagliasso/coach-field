import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDownUp, CalendarDays, ChevronLeft, ChevronRight, Plus, Search, Trophy } from 'lucide-react'
import { Link } from '../groups/navigation'
import { useGroup } from '../groups/groupContext'
import { getCloudMatches, type CloudMatch, type CloudMatchStatus } from '../cloud/matchCloudRepository'
import { CloudMatchEditor } from '../components/CloudMatchEditor'
import { PermissionAction } from '../components/PermissionAction'
import { Badge, Button, Card, EmptyState, ErrorState, Input, LoadingState, Select } from '../components/ui'
import { matchesMatchArchive, paginateMatchArchive, sortMatchArchive, type MatchArchiveSort } from '../utils/matchArchive'

const statuses: Array<[CloudMatchStatus | 'all', string]> = [['all', 'Tutti gli stati'], ['scheduled', 'Programmate'], ['live', 'In corso'], ['completed', 'Completate'], ['cancelled', 'Annullate']]
const sorts: Array<[MatchArchiveSort, string]> = [['recent', 'Più recenti'], ['oldest', 'Meno recenti'], ['upcoming', 'Prossime partite'], ['opponent', 'Avversario']]
const labelStatus = (status: CloudMatchStatus) => status === 'scheduled' ? 'Programmata' : status === 'live' ? 'In corso' : status === 'completed' ? 'Completata' : 'Annullata'
const score = (match: CloudMatch) => match.ourScore === null || match.ourScore === undefined ? 'Da giocare' : `${match.ourScore} – ${match.opponentScore}`
const dateLabel = (match: CloudMatch) => `${new Date(`${match.matchDate}T12:00:00`).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}${match.startTime ? ` · ${match.startTime.slice(0, 5)}` : ''}`

function MatchArchiveCard({ match }: { match: CloudMatch }) {
  const tone = match.status === 'completed' ? 'success' : match.status === 'cancelled' ? 'danger' : match.status === 'live' ? 'warning' : 'primary'
  return <Link to={`/matches/${match.id}`} className="match-archive-card"><Card padding="sm"><div className="match-archive-card-main"><div className="match-archive-date"><CalendarDays size={16} /><span>{dateLabel(match)}</span></div><Badge variant={tone}>{match.status === 'completed' ? score(match) : labelStatus(match.status)}</Badge><div className="match-archive-title"><strong>vs {match.opponent}</strong><small>{match.homeAway === 'home' ? 'Casa' : 'Trasferta'}{match.location ? ` · ${match.location}` : ''}</small></div>{match.competition && <span className="match-archive-competition">{match.competition}</span>}</div></Card></Link>
}

export function MatchesPage() {
  const { activeGroup } = useGroup()
  const [matches, setMatches] = useState<CloudMatch[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState('')
  const [query, setQuery] = useState(''), [status, setStatus] = useState<CloudMatchStatus | 'all'>('all'), [from, setFrom] = useState(''), [to, setTo] = useState(''), [sort, setSort] = useState<MatchArchiveSort>('recent'), [page, setPage] = useState(1), [editor, setEditor] = useState<CloudMatch>()
  const request = useRef(0), pageSize = 12
  const load = useCallback(async () => {
    if (!activeGroup) return
    const current = ++request.current
    setLoading(true); setError(''); setMatches([])
    try {
      const result = await getCloudMatches(activeGroup.id)
      if (current !== request.current) return
      setMatches(result)
    } catch (reason) {
      if (current === request.current) setError(reason instanceof Error ? reason.message : 'Impossibile caricare le partite cloud.')
    } finally { if (current === request.current) setLoading(false) }
  }, [activeGroup?.id])
  useEffect(() => { setPage(1); void load() }, [load])
  const reset = (action: () => void) => { action(); setPage(1) }
  const today = new Date().toISOString().slice(0, 10)
  const filtered = useMemo(() => sortMatchArchive(matches.filter(item => matchesMatchArchive(item, { query, status, from, to })), sort, today), [from, matches, query, sort, status, to, today])
  const archive = useMemo(() => paginateMatchArchive(filtered, page, pageSize), [filtered, page])
  const next = useMemo(() => sortMatchArchive(matches.filter(match => match.matchDate >= today && (match.status === 'scheduled' || match.status === 'live')), 'upcoming', today)[0], [matches, today])
  const invalidRange = Boolean(from && to && from > to)
  return <section className="page matches-command-page match-archive-page">
    <header className="matches-archive-header"><div><span className="eyebrow">Match Center · Supabase</span><h1>Partite</h1><p>{activeGroup?.name ?? 'WorkGroup'} · archivio, convocazioni e risultati cloud.</p></div><PermissionAction permission="matches.create"><Button variant="primary" onClick={() => setEditor({} as CloudMatch)}><Plus size={17} />Nuova partita</Button></PermissionAction></header>
    {next && <Link to={`/matches/${next.id}`} className="match-next-card"><div><span className="eyebrow">Prossima partita</span><strong>vs {next.opponent}</strong><small>{dateLabel(next)} · {next.homeAway === 'home' ? 'Casa' : 'Trasferta'}</small></div><Trophy aria-hidden="true" /></Link>}
    <section className="match-archive-controls" aria-label="Ricerca e filtri partite"><label className="search-field"><Search size={17} /><input value={query} onChange={event => reset(() => setQuery(event.target.value))} placeholder="Avversario o competizione" /></label><Select value={status} onChange={event => reset(() => setStatus(event.target.value as CloudMatchStatus | 'all'))} aria-label="Stato partita">{statuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select><Select value={sort} onChange={event => reset(() => setSort(event.target.value as MatchArchiveSort))} aria-label="Ordina partite">{sorts.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select><Input type="date" value={from} onChange={event => reset(() => setFrom(event.target.value))} aria-label="Da data" /><Input type="date" value={to} onChange={event => reset(() => setTo(event.target.value))} aria-label="A data" /><Button size="sm" variant="ghost" onClick={() => { setQuery(''); setStatus('all'); setFrom(''); setTo(''); setSort('recent'); setPage(1) }}><ArrowDownUp size={15} />Azzera</Button></section>
    {invalidRange && <ErrorState message="La data iniziale deve precedere la data finale." />}
    {error && <ErrorState message={error} action={<Button size="sm" onClick={() => void load()}>Riprova</Button>} />}
    {loading ? <LoadingState label="Caricamento archivio partite cloud..." /> : archive.total === 0 ? <EmptyState icon={Trophy} title="Nessuna partita cloud" description="Prova a modificare i filtri oppure crea la prima partita per questo WorkGroup." /> : <><div className="match-archive-summary"><span>{archive.total} partite</span><span>Pagina {archive.page} di {archive.pages}</span></div><section className="match-archive-list" aria-label="Archivio partite">{archive.matches.map(match => <MatchArchiveCard key={match.id} match={match} />)}</section><nav className="match-archive-pagination" aria-label="Paginazione partite"><span>{(archive.page - 1) * pageSize + 1}–{Math.min(archive.page * pageSize, archive.total)} di {archive.total}</span><div><Button size="sm" disabled={archive.page === 1} onClick={() => setPage(current => current - 1)}><ChevronLeft size={15} />Precedente</Button><Button size="sm" disabled={archive.page >= archive.pages} onClick={() => setPage(current => current + 1)}>Successiva<ChevronRight size={15} /></Button></div></nav></>}
    {editor && activeGroup && <CloudMatchEditor match={editor.id ? editor : undefined} organizationId={activeGroup.organizationId} groupId={activeGroup.id} onClose={() => setEditor(undefined)} onSaved={() => { setEditor(undefined); void load() }} />}
  </section>
}
