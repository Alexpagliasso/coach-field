import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Users } from 'lucide-react'
import { addCloudMatchCallup, getCloudMatchCallupCandidates, getCloudMatchCallups, removeCloudMatchCallup, updateCloudMatchCallup, type CloudMatch, type CloudMatchCallup, type CloudMatchCallupCandidate, type CloudMatchCallupStatus } from '../cloud/matchCloudRepository'
import { getWorkGroupRoster, type CloudPlayer } from '../cloud/playerCloudRepository'
import { errorMessage } from '../lib/supabase'
import { PlayerProfileModal } from './PlayerProfileModal'
import { Badge, Button, EmptyState, ErrorState, LoadingState } from './ui'

type Props = { match: CloudMatch; editable: boolean }
type Participant = { player: CloudPlayer; callup?: CloudMatchCallup; stable: boolean; sourceGroupName?: string }
const labels: Record<CloudMatchCallupStatus, string> = { called: 'Convocato', confirmed: 'Confermato', unavailable: 'Non disponibile' }

export function MatchCallupsPanel({ match, editable }: Props) {
  const [callups, setCallups] = useState<CloudMatchCallup[]>([]), [stable, setStable] = useState<CloudPlayer[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState(''), [busy, setBusy] = useState<string>(), [adding, setAdding] = useState(false), [candidates, setCandidates] = useState<CloudMatchCallupCandidate[]>([]), [playerId, setPlayerId] = useState<string>()
  const sequence = useRef(0), candidateSequence = useRef(0)
  const load = useCallback(async () => {
    const current = ++sequence.current
    setLoading(true); setError(''); setCallups([]); setStable([]); setCandidates([]); setAdding(false)
    try {
      const [nextCallups, roster] = await Promise.all([getCloudMatchCallups(match.id), getWorkGroupRoster(match.groupId)])
      if (current !== sequence.current) return
      setCallups(nextCallups); setStable(roster.map(entry => entry.player))
    } catch (reason) {
      if (current === sequence.current) setError(`Impossibile caricare le convocazioni: ${errorMessage(reason)}`)
    } finally { if (current === sequence.current) setLoading(false) }
  }, [match.groupId, match.id])
  useEffect(() => { void load() }, [load])

  const callupByPlayer = useMemo(() => new Map(callups.map(item => [item.playerId, item])), [callups])
  // UUID is the identity. A corrupt or historic duplicate never becomes two UI rows.
  const participants = useMemo(() => {
    const byPlayerId = new Map<string, Participant>()
    stable.forEach(player => byPlayerId.set(player.id, { player, callup: callupByPlayer.get(player.id), stable: true }))
    callups.forEach(callup => {
      if (!callup.player || byPlayerId.has(callup.playerId)) return
      byPlayerId.set(callup.playerId, { player: callup.player, callup, stable: false, sourceGroupName: callup.sourceGroupName })
    })
    return [...byPlayerId.values()]
  }, [callupByPlayer, callups, stable])

  const add = async (selectedPlayerId: string) => {
    setBusy(selectedPlayerId); setError('')
    try { await addCloudMatchCallup(match.id, match.organizationId, selectedPlayerId); setAdding(false); await load() }
    catch (reason) { setError(`Convocazione non riuscita: ${errorMessage(reason)}`) }
    finally { setBusy(undefined) }
  }
  const setStatus = async (item: CloudMatchCallup, status: CloudMatchCallupStatus) => {
    setBusy(item.playerId); setError('')
    try { await updateCloudMatchCallup(match.id, item.playerId, { status, note: item.note }); await load() }
    catch (reason) { setError(`Aggiornamento convocazione non riuscito: ${errorMessage(reason)}`) }
    finally { setBusy(undefined) }
  }
  const remove = async (item: CloudMatchCallup) => {
    setBusy(item.playerId); setError('')
    try { await removeCloudMatchCallup(match.id, item.playerId); await load() }
    catch (reason) { setError(`Rimozione convocazione non riuscita: ${errorMessage(reason)}`) }
    finally { setBusy(undefined) }
  }
  const openCandidates = async () => {
    const current = ++candidateSequence.current
    setAdding(true); setCandidates([]); setError('')
    try {
      const next = await getCloudMatchCallupCandidates(match.id)
      if (current !== candidateSequence.current) return
      const alreadyCalled = new Set(callups.map(item => item.playerId))
      const unique = new Map<string, CloudMatchCallupCandidate>()
      next.forEach(candidate => { if (!alreadyCalled.has(candidate.player.id) && !unique.has(candidate.player.id)) unique.set(candidate.player.id, candidate) })
      setCandidates([...unique.values()])
    } catch (reason) {
      if (current === candidateSequence.current) setError(`Impossibile caricare gli aggregati: ${errorMessage(reason)}`)
    }
  }
  return <section className="grid gap-3"><div className="flex items-center justify-between"><div><h2 className="font-bold">Convocazioni</h2><p className="text-sm text-app-muted">{callups.length} convocati</p></div>{editable && <Button size="sm" onClick={() => void openCandidates()}><Plus size={16} />Aggiungi aggregato</Button>}</div>{error && <ErrorState message={error} action={<Button size="sm" onClick={() => void load()}>Riprova</Button>} />}{adding && <div className="rounded-xl border border-app-border p-3"><strong>Giocatori di altri WorkGroup</strong><p className="mb-2 text-sm text-app-muted">Solo giocatori cloud attivi della stessa organizzazione, autorizzati per questa convocazione.</p>{candidates.map(candidate => <button type="button" key={candidate.player.id} className="block w-full rounded-lg p-2 text-left hover:bg-app-elevated" disabled={busy === candidate.player.id} onClick={() => void add(candidate.player.id)}><strong>{candidate.player.firstName} {candidate.player.lastName}</strong><small className="block text-app-muted">WorkGroup: {candidate.sourceGroupName}</small></button>)}{!candidates.length && <p className="mt-2 text-sm text-app-muted">Nessun giocatore aggregabile disponibile.</p>}</div>}{loading ? <LoadingState label="Caricamento convocazioni..." /> : participants.length === 0 ? <EmptyState icon={Users} title="Rosa WorkGroup vuota" description="Non ci sono giocatori da convocare." /> : <div className="grid gap-2">{participants.map(({ player, callup, stable: isStable, sourceGroupName }) => <article key={player.id} className="rounded-xl border border-app-border bg-app-elevated p-3"><div className="flex items-center justify-between gap-3"><button type="button" className="min-w-0 text-left" onClick={() => setPlayerId(player.id)}><strong>{player.firstName} {player.lastName}</strong><small className="block text-app-muted">{isStable ? 'Rosa stabile' : `Aggregato${sourceGroupName ? ` · ${sourceGroupName}` : ''}`}</small></button>{callup ? <Badge variant={callup.status === 'confirmed' ? 'success' : callup.status === 'unavailable' ? 'danger' : 'primary'}>{labels[callup.status]}</Badge> : <Badge>Non convocato</Badge>}</div>{editable && <div className="mt-3 flex flex-wrap gap-2">{callup ? <><Button size="sm" variant={callup.status === 'called' ? 'primary' : 'secondary'} disabled={busy === player.id} onClick={() => void setStatus(callup, 'called')}>Convocato</Button><Button size="sm" variant={callup.status === 'confirmed' ? 'primary' : 'secondary'} disabled={busy === player.id} onClick={() => void setStatus(callup, 'confirmed')}>Confermato</Button><Button size="sm" variant={callup.status === 'unavailable' ? 'primary' : 'secondary'} disabled={busy === player.id} onClick={() => void setStatus(callup, 'unavailable')}>Non disponibile</Button><Button size="sm" variant="danger" disabled={busy === player.id} onClick={() => void remove(callup)}>Rimuovi</Button></> : <Button size="sm" disabled={busy === player.id} onClick={() => void add(player.id)}>Convoca</Button>}</div>}</article>)}</div>}<PlayerProfileModal open={Boolean(playerId)} playerId={playerId} groupId={match.groupId} onClose={() => setPlayerId(undefined)} /></section>
}
