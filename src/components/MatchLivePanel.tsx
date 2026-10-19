import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, ArrowRightLeft, Check, Clock3, Goal, Pause, Play, RotateCcw, Trophy, Undo2, Users } from 'lucide-react'
import type { CloudMatch, CloudMatchCallup } from '../cloud/matchCloudRepository'
import { getCloudMatchCallups } from '../cloud/matchCloudRepository'
import {
  completeCloudMatchLive, finishCloudMatchPeriod, getCloudMatchLiveReport, getCloudMatchLiveSnapshot, getCloudMatchPlayerStints,
  pauseCloudMatchLive, recordCloudMatchGoal, resumeCloudMatchLive, startCloudMatchLive,
  startCloudNextMatchPeriod, substituteCloudMatchPlayer, voidCloudMatchGoal,
  type MatchLiveEvent, type MatchLiveReport, type MatchLiveSnapshot, type MatchPlayerStint,
} from '../cloud/matchLiveRepository'
import { errorMessage } from '../lib/supabase'
import { DialogSheet } from './DialogSheet'
import { Badge, Button, EmptyState, ErrorState, Input, LoadingState } from './ui'
import { calculateMatchPlayerMinutes, formatMatchMinutes } from '../utils/matchLiveMinutes'

type Props = { match: CloudMatch; editable: boolean; onMatchChanged?: (match: CloudMatch) => void }
type Sheet = 'our-goal' | 'opponent-goal' | 'substitution' | undefined

const slots = (formation: CloudMatch['initialFormation']) => formation === '3-2-1'
  ? [['goalkeeper', 50, 88], ['defender-left', 20, 68], ['defender-center', 50, 68], ['defender-right', 80, 68], ['midfielder-left', 33, 42], ['midfielder-right', 67, 42], ['forward', 50, 18]] as const
  : [['goalkeeper', 50, 88], ['defender-left', 30, 68], ['defender-right', 70, 68], ['midfielder-left', 20, 42], ['midfielder-center', 50, 42], ['midfielder-right', 80, 42], ['forward', 50, 18]] as const

const phaseLabel = (phase: MatchLiveSnapshot['phase']) => ({ ready: 'Pronta', running: 'In corso', paused: 'In pausa', interval: 'Intervallo', completed: 'Conclusa' })[phase]
const formatTime = (seconds = 0) => `${Math.floor(Math.max(0, seconds) / 60).toString().padStart(2, '0')}:${(Math.max(0, seconds) % 60).toString().padStart(2, '0')}`
const eventLabel = (event: MatchLiveEvent, names: Map<string, string>) => {
  const minute = event.elapsedSeconds === null || event.elapsedSeconds === undefined ? '' : ` · ${formatTime(event.elapsedSeconds)}`
  if (event.type === 'goal') return event.scoringTeam === 'ours' ? `Gol nostro${event.scorerPlayerId ? ` · ${names.get(event.scorerPlayerId) ?? 'Marcatore'}` : ''}${minute}` : `Gol avversario${event.opponentJerseyNumber !== null && event.opponentJerseyNumber !== undefined ? ` · #${event.opponentJerseyNumber}` : ''}${minute}`
  if (event.type === 'substitution') return `Cambio: ${names.get(event.playerOutId ?? '') ?? 'Giocatore'} → ${names.get(event.playerInId ?? '') ?? 'Giocatore'}${minute}`
  return ({ period_started: 'Inizio tempo', paused: 'Pausa', resumed: 'Ripresa', period_completed: 'Fine tempo', goal_voided: 'Gol annullato', match_completed: 'Partita conclusa' })[event.type] + minute
}

/** Operational field-side screen. The database snapshot remains the sole live source of truth. */
export function MatchLivePanel({ match, editable, onMatchChanged }: Props) {
  const [snapshot, setSnapshot] = useState<MatchLiveSnapshot>(), [report, setReport] = useState<MatchLiveReport>(), [stints, setStints] = useState<MatchPlayerStint[]>([]), [displayElapsed, setDisplayElapsed] = useState(0)
  const [callups, setCallups] = useState<CloudMatchCallup[]>([]), [loading, setLoading] = useState(true), [saving, setSaving] = useState(false), [error, setError] = useState('')
  const [sheet, setSheet] = useState<Sheet>(), [scorerId, setScorerId] = useState<string | undefined>(), [jersey, setJersey] = useState(''), [outId, setOutId] = useState<string | undefined>(), [inId, setInId] = useState<string | undefined>()
  const [retry, setRetry] = useState<(() => void) | undefined>()
  const [sortByMinutes, setSortByMinutes] = useState(false)
  const version = useRef(0), clockAnchor = useRef({ elapsed: 0, sampledAt: 0, phase: 'ready' as MatchLiveSnapshot['phase'] })
  const load = useCallback(async () => {
    const current = ++version.current
    setLoading(true); setError('')
    try {
      const [nextSnapshot, nextReport, nextCallups, nextStints] = await Promise.all([getCloudMatchLiveSnapshot(match.id), getCloudMatchLiveReport(match.id), getCloudMatchCallups(match.id), getCloudMatchPlayerStints(match.id)])
      if (current !== version.current) return
      clockAnchor.current = { elapsed: nextSnapshot.elapsedSeconds, sampledAt: Date.now(), phase: nextSnapshot.phase }
      setSnapshot(nextSnapshot); setReport(nextReport); setCallups(nextCallups); setStints(nextStints); setDisplayElapsed(nextSnapshot.elapsedSeconds)
      if (nextSnapshot.phase === 'completed') onMatchChanged?.({ ...match, status: 'completed', ourScore: nextReport.globalScore.ours, opponentScore: nextReport.globalScore.opponent })
      else if (nextSnapshot.phase !== 'ready') onMatchChanged?.({ ...match, status: 'live', ourScore: nextReport.globalScore.ours, opponentScore: nextReport.globalScore.opponent })
    } catch (reason) { if (current === version.current) setError(`Modalità live non disponibile: ${errorMessage(reason)}`) } finally { if (current === version.current) setLoading(false) }
  }, [match, onMatchChanged])
  useEffect(() => { void load() }, [load])
  useEffect(() => {
    if (!snapshot) return
    const tick = () => setDisplayElapsed(clockAnchor.current.phase === 'running' ? clockAnchor.current.elapsed + Math.floor((Date.now() - clockAnchor.current.sampledAt) / 1000) : clockAnchor.current.elapsed)
    tick()
    const id = window.setInterval(tick, 1000)
    const visible = () => { if (document.visibilityState === 'visible') tick() }
    document.addEventListener('visibilitychange', visible)
    return () => { window.clearInterval(id); document.removeEventListener('visibilitychange', visible) }
  }, [snapshot])
  useEffect(() => {
    if (snapshot?.phase === 'completed') return
    const sync = () => void load()
    const id = window.setInterval(sync, 15_000)
    const visible = () => { if (document.visibilityState === 'visible') sync() }
    document.addEventListener('visibilitychange', visible)
    return () => { window.clearInterval(id); document.removeEventListener('visibilitychange', visible) }
  }, [snapshot?.phase, load])

  const byId = useMemo(() => new Map(callups.filter(item => item.player).map(item => [item.playerId, `${item.player!.firstName} ${item.player!.lastName}`])), [callups])
  const active = snapshot?.activePlayers ?? []
  const activeIds = new Set(active.map(item => item.playerId))
  const eligible = callups.filter(item => item.status === 'called' || item.status === 'confirmed')
  const bench = eligible.filter(item => !activeIds.has(item.playerId))
  const currentPeriod = report?.periods.find(period => period.period === snapshot?.currentPeriod)
  const expected = match.periodDurationMinutes * 60
  const remaining = Math.max(0, expected - displayElapsed), excess = Math.max(0, displayElapsed - expected)
  const progress = expected ? Math.min(100, displayElapsed / expected * 100) : 0
  const playerMinutes = snapshot ? calculateMatchPlayerMinutes(eligible.map(item => item.playerId), stints, { ...snapshot, elapsedSeconds: displayElapsed }) : []
  const rotationRows = [...playerMinutes].sort((a, b) => sortByMinutes ? a.totalSeconds - b.totalSeconds || a.playerId.localeCompare(b.playerId) : Number(b.active) - Number(a.active) || a.totalSeconds - b.totalSeconds || a.playerId.localeCompare(b.playerId))
  const canAct = editable && !saving && snapshot?.phase !== 'completed' && match.status !== 'cancelled'

  const mutate = async (operation: (requestId: ReturnType<typeof crypto.randomUUID>) => Promise<unknown>, confirmation?: string, existingId?: ReturnType<typeof crypto.randomUUID>) => {
    if (!canAct || (confirmation && !window.confirm(confirmation))) return
    const requestId = existingId ?? crypto.randomUUID()
    setSaving(true); setError(''); setRetry(undefined)
    try { await operation(requestId); await load(); return true } catch (reason) {
      setError(`Operazione live non riuscita: ${errorMessage(reason)}. I dati della partita sono stati aggiornati.`)
      setRetry(() => () => { void mutate(operation, undefined, requestId) })
      await load(); return false
    } finally { setSaving(false) }
  }
  const closeSheet = () => { if (!saving) { setSheet(undefined); setScorerId(undefined); setJersey(''); setOutId(undefined); setInId(undefined) } }
  const submitGoal = async () => {
    if (!sheet) return
    const number = jersey.trim() === '' ? undefined : Number(jersey)
    if (sheet === 'opponent-goal' && (!Number.isInteger(number) || number! < 0 || number! > 99) && jersey.trim() !== '') { setError('Il numero maglia deve essere compreso tra 0 e 99.'); return }
    if (await mutate(id => recordCloudMatchGoal(match.id, sheet === 'our-goal' ? 'ours' : 'opponent', sheet === 'our-goal' ? { scorerPlayerId: scorerId } : { opponentJerseyNumber: number }, id))) closeSheet()
  }
  const submitSubstitution = async () => {
    if (!outId || !inId) { setError('Seleziona chi esce e chi entra.'); return }
    if (await mutate(id => substituteCloudMatchPlayer(match.id, outId, inId, id))) closeSheet()
  }

  if (loading && !snapshot) return <LoadingState label="Caricamento Match Live…" />
  if (!snapshot || !report) return <ErrorState message={error || 'Impossibile caricare il Match Live.'} action={<Button onClick={() => void load()}>Riprova</Button>} />
  const controls = snapshot.phase === 'ready'
    ? <Button variant="primary" className="w-full sm:w-auto" disabled={!canAct} loading={saving} onClick={() => void mutate(id => startCloudMatchLive(match.id, id), 'Avviare la partita? La formazione iniziale sarà bloccata.') }><Play size={18} />Avvia partita</Button>
    : snapshot.phase === 'running'
      ? <><Button variant="secondary" disabled={!canAct} onClick={() => void mutate(id => pauseCloudMatchLive(match.id, id))}><Pause size={18} />Pausa</Button><Button variant="danger" disabled={!canAct} onClick={() => void mutate(id => finishCloudMatchPeriod(match.id, id), 'Terminare il tempo corrente?')}><Clock3 size={18} />Termina tempo</Button></>
      : snapshot.phase === 'paused'
        ? <><Button variant="primary" disabled={!canAct} onClick={() => void mutate(id => resumeCloudMatchLive(match.id, id))}><Play size={18} />Riprendi</Button><Button variant="danger" disabled={!canAct} onClick={() => void mutate(id => finishCloudMatchPeriod(match.id, id), 'Terminare il tempo corrente?')}><Clock3 size={18} />Termina tempo</Button></>
        : snapshot.phase === 'interval' && snapshot.currentPeriod < match.periodCount
          ? <Button variant="primary" disabled={!canAct} onClick={() => void mutate(id => startCloudNextMatchPeriod(match.id, id), `Avviare il ${snapshot.currentPeriod + 1}° tempo?`)}><Play size={18} />Avvia {snapshot.currentPeriod + 1}° tempo</Button>
          : snapshot.phase === 'interval'
            ? <Button variant="success" disabled={!canAct} onClick={() => void mutate(id => completeCloudMatchLive(match.id, id), 'Concludere definitivamente la partita?')}><Check size={18} />Concludi partita</Button>
            : null

  return <section className="grid gap-4 pb-[max(1rem,env(safe-area-inset-bottom))]" aria-label="Match Live">
    {error && <ErrorState message={error} action={<div className="flex gap-2"><Button size="sm" onClick={() => void load()}><RotateCcw size={15} />Ricarica</Button>{retry && <Button size="sm" variant="primary" onClick={retry}>Riprova operazione</Button>}</div>} />}
    <header className="sticky top-0 z-20 overflow-hidden rounded-[1.5rem] border border-app-primary/30 bg-[linear-gradient(135deg,rgba(89,64,255,.98),rgba(41,159,255,.86))] p-4 text-white shadow-[var(--shadow-card)] sm:p-5">
      <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-white/75">Match Live · {match.homeAway === 'home' ? 'Casa' : 'Trasferta'}</p><h2 className="mt-1 text-lg font-bold">GrowPitch <span className="text-white/70">vs</span> {match.opponent}</h2></div><Badge variant={snapshot.phase === 'completed' ? 'success' : snapshot.phase === 'running' ? 'primary' : 'neutral'}>{phaseLabel(snapshot.phase)}</Badge></div>
      <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center"><strong className="text-5xl font-black tabular-nums sm:text-6xl">{report.globalScore.ours}</strong><span className="text-2xl font-bold text-white/65">—</span><strong className="text-5xl font-black tabular-nums sm:text-6xl">{report.globalScore.opponent}</strong></div>
      <div className="mt-5 grid grid-cols-3 items-end gap-2 text-center"><div><small className="block text-[10px] font-bold uppercase tracking-wide text-white/65">Trascorso</small><strong className="text-2xl tabular-nums sm:text-3xl">{formatTime(displayElapsed)}</strong></div><div><small className="block text-[10px] font-bold uppercase tracking-wide text-white/65">Rimanente</small><strong className={`text-2xl tabular-nums sm:text-3xl ${excess ? 'text-app-coral' : ''}`}>{excess ? `+${formatTime(excess)}` : formatTime(remaining)}</strong></div><div><small className="block text-[10px] font-bold uppercase tracking-wide text-white/65">Periodo</small><strong className="text-lg tabular-nums sm:text-xl">{snapshot.currentPeriod ? `${snapshot.currentPeriod}°/${match.periodCount}` : `0/${match.periodCount}`}</strong></div></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-white/25" aria-label="Avanzamento del tempo"><div className={`h-full rounded-full transition-[width] duration-1000 ${excess ? 'bg-app-coral' : 'bg-white'}`} style={{ width: `${progress}%` }} /></div><p className="mt-2 text-center text-xs font-semibold text-white/85">Durata prevista {formatTime(expected)}{excess && <span className="ml-2 inline-flex items-center gap-1 text-app-coral"><AlertTriangle size={13} />Tempo eccedente</span>}</p>
    </header>

    <section className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Punteggi"><article className="rounded-xl border border-app-border bg-app-elevated p-3"><small className="text-app-muted">Tempo corrente</small><strong className="mt-1 block text-lg tabular-nums">{currentPeriod ? `${currentPeriod.ours} – ${currentPeriod.opponent}` : '—'}</strong></article><article className="rounded-xl border border-app-border bg-app-elevated p-3"><small className="text-app-muted">FIGC consolidato</small><strong className="mt-1 block text-lg tabular-nums">{report.figcScore.ours} – {report.figcScore.opponent}</strong></article><article className="col-span-2 rounded-xl border border-app-border bg-app-elevated p-3"><small className="text-app-muted">Tempi</small><p className="mt-1 flex flex-wrap gap-1">{report.periods.map(period => <span key={period.period} className={`rounded-md px-1.5 py-0.5 text-xs font-bold ${period.completed ? 'bg-app-primary/10 text-app-primary' : 'bg-app-surface text-app-muted'}`}>{period.period}° {period.ours}–{period.opponent}{period.completed ? ` · ${period.figcOurs}-${period.figcOpponent}` : ''}</span>)}</p></article></section>

    {editable && snapshot.phase !== 'ready' && snapshot.phase !== 'completed' && <section className="grid grid-cols-2 gap-2"><Button className="min-h-14" variant="success" disabled={!canAct || snapshot.phase === 'interval'} onClick={() => setSheet('our-goal')}><Goal size={20} />+ Gol nostro</Button><Button className="min-h-14" variant="secondary" disabled={!canAct || snapshot.phase === 'interval'} onClick={() => setSheet('opponent-goal')}><Goal size={20} />+ Gol avversario</Button></section>}
    <section className="flex flex-wrap gap-2" aria-label="Controlli partita">{controls}</section>

    {snapshot.phase !== 'ready' && <section className="grid gap-3 rounded-[1.25rem] border border-app-border bg-app-elevated p-3 sm:p-4"><div className="flex items-center justify-between gap-2"><div><h3 className="font-bold">Campo e panchina</h3><p className="text-xs text-app-muted">{match.initialFormation} · 7 giocatori in campo</p></div>{editable && snapshot.phase !== 'completed' && <Button size="sm" disabled={!canAct || active.length !== 7 || bench.length === 0} onClick={() => setSheet('substitution')}><ArrowRightLeft size={15} />Cambio</Button>}</div><div className="relative mx-auto aspect-[.72] w-full max-w-[18rem] overflow-hidden rounded-[1.25rem] border-2 border-white/60 bg-[linear-gradient(135deg,rgba(89,64,255,.96),rgba(41,159,255,.74))] before:absolute before:inset-[7%] before:rounded-[1rem] before:border before:border-white/65 after:absolute after:left-1/2 after:top-[7%] after:h-[86%] after:border-l after:border-white/65"><div className="absolute left-[7%] right-[7%] top-1/2 border-t border-white/65" />{slots(match.initialFormation).map(([slot, x, y]) => { const entry = active.find(item => item.slotId === slot); return <button type="button" key={slot} disabled={!editable || !entry || snapshot.phase === 'completed'} onClick={() => { if (entry) { setOutId(entry.playerId); setSheet('substitution') } }} className="absolute z-10 min-h-11 max-w-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white bg-app-surface px-2 text-[10px] font-bold leading-tight text-app-text shadow" style={{ left: `${x}%`, top: `${y}%` }}>{entry ? byId.get(entry.playerId) ?? 'Giocatore' : '—'}</button> })}</div><div className="grid gap-1 sm:grid-cols-2">{bench.length ? bench.map(item => <div key={item.playerId} className="rounded-lg border border-app-border bg-app-surface px-2 py-1.5 text-sm"><Users className="mr-1 inline size-3 text-app-muted" />{byId.get(item.playerId)}</div>) : <p className="text-sm text-app-muted">Nessun giocatore disponibile in panchina.</p>}</div></section>}

    {snapshot.phase !== 'ready' && <RotationPanel rows={rotationRows} names={byId} sortByMinutes={sortByMinutes} onSort={() => setSortByMinutes(value => !value)} onChoosePlayer={playerId => { const row = rotationRows.find(item => item.playerId === playerId); if (row?.active) setOutId(playerId); setSheet('substitution') }} canChange={canAct && bench.length > 0} />}
    <section className="rounded-[1.25rem] border border-app-border bg-app-surface p-3 sm:p-4"><h3 className="font-bold">Cronologia</h3>{snapshot.events.length === 0 ? <EmptyState title="Nessun evento live" description="Avvia la partita per iniziare a registrare tempi, gol e cambi." /> : <ol className="mt-3 grid gap-2">{[...snapshot.events].reverse().map(event => <li key={event.id} className={`flex items-start justify-between gap-3 rounded-lg border p-2.5 text-sm ${event.voidedAt ? 'border-app-danger/30 bg-app-danger/5 opacity-70' : 'border-app-border bg-app-elevated'}`}><span><strong>{event.period ? `${event.period}° tempo · ` : ''}</strong>{eventLabel(event, byId)}{event.voidedAt && ' · annullato'}</span>{editable && event.type === 'goal' && !event.voidedAt && snapshot.phase !== 'completed' && <Button size="sm" variant="ghost" disabled={saving} onClick={() => void mutate(id => voidCloudMatchGoal(match.id, event.id, id), 'Annullare questo gol?')} aria-label="Annulla gol"><Undo2 size={15} /></Button>}</li>)}</ol>}</section>
    {snapshot.phase === 'completed' && <MatchLiveReportView report={report} names={byId} rows={playerMinutes} periodCount={match.periodCount} />}

    {sheet && <DialogSheet labelledBy="live-action-title" onClose={closeSheet} busy={saving} className="add-player-sheet max-w-lg"><div className="add-player-scroll grid gap-4"><header><p className="eyebrow">Match Live</p><h2 id="live-action-title">{sheet === 'our-goal' ? 'Gol nostro' : sheet === 'opponent-goal' ? 'Gol avversario' : 'Registra cambio'}</h2></header>{sheet === 'our-goal' && <><p className="text-sm text-app-muted">Prima i giocatori in campo; sono disponibili anche gli altri convocati per un inserimento tardivo.</p><div className="grid gap-2">{[...active.map(item => item.playerId), ...bench.map(item => item.playerId)].map(playerId => <Button key={playerId} variant={scorerId === playerId ? 'primary' : 'secondary'} type="button" onClick={() => setScorerId(playerId)} aria-pressed={scorerId === playerId}>{byId.get(playerId)}</Button>)}<Button variant={scorerId === undefined ? 'primary' : 'ghost'} type="button" onClick={() => setScorerId(undefined)} aria-pressed={scorerId === undefined}>Marcatore non specificato</Button></div></>}{sheet === 'opponent-goal' && <label className="grid gap-2 text-sm font-semibold">Numero maglia avversario <span className="font-normal text-app-muted">opzionale</span><Input inputMode="numeric" min="0" max="99" value={jersey} onChange={event => setJersey(event.target.value)} placeholder="Es. 9" /></label>}{sheet === 'substitution' && <div className="grid gap-3"><div><p className="mb-2 text-sm font-semibold">Esce</p><div className="grid gap-2">{active.map(item => <Button key={item.playerId} variant={outId === item.playerId ? 'danger' : 'secondary'} type="button" onClick={() => setOutId(item.playerId)} aria-pressed={outId === item.playerId}>{byId.get(item.playerId)}</Button>)}</div></div><div><p className="mb-2 text-sm font-semibold">Entra</p><div className="grid gap-2">{bench.map(item => <Button key={item.playerId} variant={inId === item.playerId ? 'primary' : 'secondary'} type="button" onClick={() => setInId(item.playerId)} aria-pressed={inId === item.playerId}>{byId.get(item.playerId)}</Button>)}</div></div></div>}<footer className="sticky bottom-0 flex justify-end gap-2 border-t border-app-border bg-app-surface pt-3"><Button variant="ghost" disabled={saving} onClick={closeSheet}>Annulla</Button><Button variant="primary" loading={saving} onClick={() => void (sheet === 'substitution' ? submitSubstitution() : submitGoal())}>{sheet === 'substitution' ? 'Conferma cambio' : 'Conferma gol'}</Button></footer></div></DialogSheet>}
  </section>
}

function RotationPanel({ rows, names, sortByMinutes, onSort, onChoosePlayer, canChange }: { rows: ReturnType<typeof calculateMatchPlayerMinutes>; names: Map<string, string>; sortByMinutes: boolean; onSort: () => void; onChoosePlayer: (playerId: string) => void; canChange: boolean }) {
  const unused = rows.filter(row => row.entries === 0), least = rows.filter(row => !row.active).sort((a, b) => a.totalSeconds - b.totalSeconds)[0]
  return <section className="grid gap-3 rounded-[1.25rem] border border-app-border bg-app-surface p-3 sm:p-4" aria-labelledby="rotation-title"><header className="flex flex-wrap items-center justify-between gap-2"><div><h3 id="rotation-title" className="font-bold">Minutaggi e rotazioni</h3><p className="text-xs text-app-muted">Indicazioni operative: l’allenatore mantiene sempre la decisione.</p></div><Button size="sm" variant={sortByMinutes ? 'primary' : 'ghost'} onClick={onSort} aria-pressed={sortByMinutes}>Ordina per minuti</Button></header>{(unused.length > 0 || least) && <div className="rounded-lg border border-app-primary/25 bg-app-primary/5 p-2.5 text-sm"><strong>Suggerimento: </strong>{unused.length ? `${unused.length} ${unused.length === 1 ? 'giocatore non è ancora entrato' : 'giocatori non sono ancora entrati'}.` : ''}{least && <button type="button" className="ml-1 font-bold text-app-primary underline underline-offset-2" disabled={!canChange} onClick={() => onChoosePlayer(least.playerId)}>Prossimo cambio: {names.get(least.playerId) ?? 'giocatore'} ({formatMatchMinutes(least.totalSeconds)}).</button>}</div>}<div className="overflow-x-auto"><table className="w-full min-w-[20rem] text-left text-sm"><thead className="text-xs uppercase tracking-wide text-app-muted"><tr><th className="pb-2">Giocatore</th><th className="pb-2">Stato</th><th className="pb-2 text-right">Minuti</th><th className="pb-2 text-right">Ingressi</th></tr></thead><tbody>{rows.map(row => <tr key={row.playerId} className="border-t border-app-border"><td className="py-2"><button type="button" disabled={!canChange} onClick={() => onChoosePlayer(row.playerId)} className="text-left font-semibold disabled:cursor-default">{names.get(row.playerId) ?? 'Giocatore'}<small className="ml-1 text-app-muted">{[...row.periodSeconds.entries()].sort(([a], [b]) => a - b).map(([period, seconds]) => `${period}° ${formatMatchMinutes(seconds)}`).join(' · ')}</small></button></td><td className="py-2"><Badge variant={row.active ? 'success' : 'neutral'}>{row.active ? 'In campo' : row.entries ? 'Panchina' : 'Mai entrato'}</Badge></td><td className="py-2 text-right font-bold tabular-nums">{formatMatchMinutes(row.totalSeconds)}</td><td className="py-2 text-right tabular-nums">{row.entries}<small className="ml-1 text-app-muted">/{row.exits}</small></td></tr>)}</tbody></table></div></section>
}

function MatchLiveReportView({ report, names, rows, periodCount }: { report: MatchLiveReport; names: Map<string, string>; rows: ReturnType<typeof calculateMatchPlayerMinutes>; periodCount: number }) {
  const unused = rows.filter(row => row.entries === 0)
  return <section className="grid gap-3 rounded-[1.25rem] border border-app-primary/30 bg-app-primary/5 p-4 print:border-0 print:bg-white" aria-label="Report finale"><header className="flex items-center gap-2"><Trophy className="text-app-primary" /><div><p className="eyebrow">Report finale</p><h3 className="font-bold">{report.globalScore.ours} – {report.globalScore.opponent} · FIGC {report.figcScore.ours} – {report.figcScore.opponent}</h3></div></header><div className="grid gap-2 text-sm sm:grid-cols-2"><p><strong>Gol nostri:</strong> {report.goals.filter(goal => goal.team === 'ours').map(goal => goal.scorerName ?? names.get(goal.scorerPlayerId ?? '') ?? 'Non specificato').join(', ') || 'Nessuno'}</p><p><strong>Gol avversari:</strong> {report.goals.filter(goal => goal.team === 'opponent').map(goal => goal.opponentJerseyNumber === null || goal.opponentJerseyNumber === undefined ? 'Non specificato' : `#${goal.opponentJerseyNumber}`).join(', ') || 'Nessuno'}</p><p><strong>Giocatori utilizzati:</strong> {rows.filter(row => row.entries > 0).length}/{rows.length}</p><p><strong>Mai entrati:</strong> {unused.map(row => names.get(row.playerId) ?? 'Giocatore').join(', ') || 'Nessuno'}</p><p className="sm:col-span-2"><strong>Minutaggi ({periodCount} tempi):</strong> {rows.map(row => `${names.get(row.playerId) ?? 'Giocatore'} ${formatMatchMinutes(row.totalSeconds)} (${row.entries} ingressi, ${row.exits} uscite)`).join(' · ')}</p><p className="sm:col-span-2"><strong>Cambi:</strong> {report.substitutions.length}</p></div></section>
}
