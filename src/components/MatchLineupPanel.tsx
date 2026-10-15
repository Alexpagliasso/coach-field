import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CircleX, Save, Users } from 'lucide-react'
import { getCloudMatchCallups, getCloudMatchInitialLineup, saveCloudMatchInitialLineup, type CloudMatch, type CloudMatchCallup, type CloudMatchLineupSaveEntry } from '../cloud/matchCloudRepository'
import { errorMessage } from '../lib/supabase'
import { Badge, Button, EmptyState, ErrorState, LoadingState } from './ui'

type Props = { match: CloudMatch; editable: boolean; onSaved: (match: CloudMatch) => void }
type Slot = { id: string; label: string; x: number; y: number }

const slotsFor = (formation: CloudMatch['initialFormation']): Slot[] => formation === '3-2-1'
  ? [
      { id: 'goalkeeper', label: 'POR', x: 50, y: 88 },
      { id: 'defender-left', label: 'D S', x: 20, y: 68 }, { id: 'defender-center', label: 'D C', x: 50, y: 68 }, { id: 'defender-right', label: 'D D', x: 80, y: 68 },
      { id: 'midfielder-left', label: 'C S', x: 33, y: 42 }, { id: 'midfielder-right', label: 'C D', x: 67, y: 42 }, { id: 'forward', label: 'ATT', x: 50, y: 18 },
    ]
  : [
      { id: 'goalkeeper', label: 'POR', x: 50, y: 88 },
      { id: 'defender-left', label: 'D S', x: 30, y: 68 }, { id: 'defender-right', label: 'D D', x: 70, y: 68 },
      { id: 'midfielder-left', label: 'C S', x: 20, y: 42 }, { id: 'midfielder-center', label: 'C C', x: 50, y: 42 }, { id: 'midfielder-right', label: 'C D', x: 80, y: 42 }, { id: 'forward', label: 'ATT', x: 50, y: 18 },
    ]

export function MatchLineupPanel({ match, editable, onSaved }: Props) {
  const [callups, setCallups] = useState<CloudMatchCallup[]>([])
  const [entries, setEntries] = useState<CloudMatchLineupSaveEntry[]>([])
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('')
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>()
  const [formation, setFormation] = useState<CloudMatch['initialFormation']>(match.initialFormation)
  const sequence = useRef(0)
  const slots = useMemo(() => slotsFor(formation), [formation])
  const load = useCallback(async () => {
    const current = ++sequence.current
    setLoading(true); setError(''); setNotice(''); setSelectedPlayerId(undefined)
    try {
      const [nextCallups, nextEntries] = await Promise.all([getCloudMatchCallups(match.id), getCloudMatchInitialLineup(match.id)])
      if (current !== sequence.current) return
      setCallups(nextCallups)
      setEntries(nextEntries.map(entry => ({ playerId: entry.playerId, slotId: entry.slotId, positionX: Number(entry.positionX), positionY: Number(entry.positionY) })))
    } catch (reason) {
      if (current === sequence.current) setError(`Impossibile caricare la formazione: ${errorMessage(reason)}`)
    } finally { if (current === sequence.current) setLoading(false) }
  }, [match.id])
  useEffect(() => { void load() }, [load])

  const eligible = useMemo(() => callups.filter(callup => callup.status === 'called' || callup.status === 'confirmed'), [callups])
  const byPlayer = useMemo(() => new Map(eligible.filter(item => item.player).map(item => [item.playerId, item])), [eligible])
  const entryAt = (slotId: string) => entries.find(entry => entry.slotId === slotId)
  const assigned = new Set(entries.map(entry => entry.playerId))
  const assign = (slot: Slot) => {
    if (!editable || !selectedPlayerId) return
    setNotice(''); setError('')
    setEntries(current => [
      ...current.filter(entry => entry.slotId !== slot.id && entry.playerId !== selectedPlayerId),
      { playerId: selectedPlayerId, slotId: slot.id, positionX: slot.x, positionY: slot.y },
    ])
    setSelectedPlayerId(undefined)
  }
  const remove = (slotId: string) => { if (editable) { setEntries(current => current.filter(entry => entry.slotId !== slotId)); setNotice('') } }
  const changeFormation = (next: CloudMatch['initialFormation']) => {
    if (!editable || next === formation) return
    const allowed = new Set(slotsFor(next).map(slot => slot.id))
    const incompatible = entries.filter(entry => !allowed.has(entry.slotId))
    if (incompatible.length && !window.confirm(`Il modulo ${next} non include ${incompatible.length === 1 ? 'una posizione assegnata' : `${incompatible.length} posizioni assegnate`}. Rimuoverla dalla bozza? La formazione cloud non cambierà finché non salvi.`)) return
    setFormation(next); setEntries(current => current.filter(entry => allowed.has(entry.slotId))); setNotice('')
  }
  const save = async () => {
    setSaving(true); setError(''); setNotice('')
    try {
      const updatedAt = await saveCloudMatchInitialLineup(match.id, entries, match.updatedAt, formation === match.initialFormation ? undefined : formation)
      setNotice(entries.length === 7 ? 'Formazione iniziale salvata.' : `Bozza salvata: ${entries.length}/7 giocatori in campo.`)
      onSaved({ ...match, initialFormation: formation, updatedAt })
    } catch (reason) { setError(`Salvataggio formazione non riuscito: ${errorMessage(reason)}`) }
    finally { setSaving(false) }
  }

  if (loading) return <LoadingState label="Caricamento formazione..." />
  if (error && !callups.length && !entries.length) return <ErrorState message={error} action={<Button onClick={() => void load()}>Riprova</Button>} />
  return <section className="grid gap-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
    <header className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-bold">Formazione iniziale</h2><p className="text-sm text-app-muted">{formation} · {entries.length}/7 in campo · {match.periodCount} tempi da {match.periodDurationMinutes}&prime;</p></div><Badge variant={entries.length === 7 ? 'success' : 'warning'}>{entries.length === 7 ? 'Pronta' : 'Bozza'}</Badge></header>
    <div className="flex gap-2" role="group" aria-label="Modulo iniziale">{(['3-2-1', '2-3-1'] as CloudMatch['initialFormation'][]).map(option => <Button key={option} type="button" size="sm" variant={formation === option ? 'primary' : 'secondary'} disabled={!editable || saving} onClick={() => changeFormation(option)} aria-pressed={formation === option}>{option}</Button>)}</div>
    {error && <ErrorState message={error} action={<Button size="sm" onClick={() => void load()}>Ricarica</Button>} />}{notice && <p role="status" className="rounded-xl border border-app-success/40 bg-app-success/10 p-3 text-sm font-medium text-app-success">{notice}</p>}
    {!eligible.length ? <EmptyState icon={Users} title="Nessun convocato schierabile" description="Convoca un giocatore e imposta Convocato o Confermato prima di preparare la formazione." /> : <>
      <section aria-label="Campo di gioco" className="relative mx-auto aspect-[.68] w-full max-w-sm overflow-hidden rounded-[2rem] border-4 border-app-primary/45 bg-[linear-gradient(135deg,rgba(89,64,255,.95),rgba(41,159,255,.8))] shadow-[var(--shadow-card)] before:absolute before:inset-[7%] before:rounded-[1.5rem] before:border before:border-white/70 after:absolute after:left-1/2 after:top-[7%] after:h-[86%] after:border-l after:border-white/70">
        <div className="absolute left-[7%] right-[7%] top-1/2 border-t border-white/70" />
        <div className="absolute left-1/2 top-1/2 size-14 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/70" />
        {slots.map(slot => { const entry = entryAt(slot.id), participant = entry ? byPlayer.get(entry.playerId) : undefined; return <div key={slot.id} className="absolute z-10 -translate-x-1/2 -translate-y-1/2" style={{ left: `${slot.x}%`, top: `${slot.y}%` }}><button type="button" disabled={!editable || !selectedPlayerId} onClick={() => assign(slot)} aria-label={entry ? `${slot.label}: ${participant?.player?.firstName ?? 'giocatore'}` : `Assegna ${slot.label}`} className={`grid min-h-14 min-w-14 max-w-24 place-items-center rounded-full border-2 px-1 text-center text-[10px] font-bold leading-tight shadow-lg transition ${entry ? 'border-white bg-app-surface text-app-text' : 'border-dashed border-white/90 bg-white/15 text-white'} ${selectedPlayerId ? 'ring-4 ring-app-coral/80' : ''}`}><span>{entry && participant?.player ? `${participant.player.firstName} ${participant.player.lastName.slice(0, 1)}.` : slot.label}</span></button>{entry && editable && <button type="button" className="absolute -right-2 -top-2 grid size-6 place-items-center rounded-full bg-app-danger text-white shadow" onClick={() => remove(slot.id)} aria-label={`Rimuovi da ${slot.label}`}><CircleX size={15} /></button>}</div> })}
      </section>
      <section className="rounded-app border border-app-border bg-app-elevated p-3"><div className="mb-2 flex items-center justify-between"><h3 className="font-semibold">Panchina e convocati</h3><small className="text-app-muted">Tocca un giocatore, poi una posizione</small></div><div className="grid gap-2 sm:grid-cols-2">{eligible.map(callup => { const player = callup.player; if (!player) return null; const isAssigned = assigned.has(callup.playerId), selected = selectedPlayerId === callup.playerId; return <button type="button" key={callup.playerId} disabled={!editable || isAssigned} aria-pressed={selected} onClick={() => setSelectedPlayerId(selected ? undefined : callup.playerId)} className={`min-h-12 rounded-xl border px-3 text-left text-sm transition ${selected ? 'border-app-primary bg-app-primary/10 ring-2 ring-app-primary/25' : isAssigned ? 'border-app-success/40 bg-app-success/10 opacity-70' : 'border-app-border bg-app-surface hover:border-app-primary'}`}><strong>{player.firstName} {player.lastName}</strong><small className="ml-2 text-app-muted">{isAssigned ? 'In campo' : callup.status === 'confirmed' ? 'Confermato' : 'Convocato'}</small></button> })}</div></section>
      {editable && <div className="sticky bottom-0 z-20 -mx-1 flex justify-end border-t border-app-border bg-app-surface/95 p-3 backdrop-blur"><Button variant="primary" loading={saving} disabled={saving} onClick={() => void save()}><Save size={16} />Salva formazione</Button></div>}
    </>}
  </section>
}
