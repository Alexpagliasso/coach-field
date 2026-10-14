import { useState } from 'react'
import { X } from 'lucide-react'
import { saveCloudMatch, type CloudMatch } from '../cloud/matchCloudRepository'
import { DialogSheet } from './DialogSheet'
import { Button, ErrorState, Field, Input, Select, Textarea } from './ui'

type Props = { match?: CloudMatch; organizationId: string; groupId: string; onClose: () => void; onSaved: (match: CloudMatch) => void }

export function CloudMatchEditor({ match, organizationId, groupId, onClose, onSaved }: Props) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const [status, setStatus] = useState<CloudMatch['status']>(match?.status ?? 'scheduled')
  const save = async (form: HTMLFormElement) => {
    const data = new FormData(form); const score = (name: string) => { const raw = String(data.get(name) ?? ''); return raw === '' ? null : Number(raw) }
    const ourScore = score('ourScore'), opponentScore = score('opponentScore')
    if ((ourScore === null) !== (opponentScore === null)) { setError('Inserisci entrambi i punteggi oppure nessuno.'); return }
    if (status === 'completed' && ourScore === null) { setError('Una partita completata richiede il risultato.'); return }
    setBusy(true); setError('')
    try {
      const next = await saveCloudMatch({ id: match?.id, organizationId, groupId, matchDate: String(data.get('date')), startTime: String(data.get('time') || '') || null, opponent: String(data.get('opponent')).trim(), homeAway: String(data.get('homeAway')) as CloudMatch['homeAway'], location: String(data.get('location') || '').trim() || null, competition: String(data.get('competition') || '').trim() || null, status, ourScore: status === 'cancelled' ? null : ourScore, opponentScore: status === 'cancelled' ? null : opponentScore, coachNotes: String(data.get('notes') || '') })
      onSaved(next)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Salvataggio non riuscito.') } finally { setBusy(false) }
  }
  return <DialogSheet labelledBy="cloud-match-editor-title" onClose={onClose} busy={busy} className="add-player-sheet max-w-3xl"><form className="add-player-scroll grid gap-4" onSubmit={event => { event.preventDefault(); void save(event.currentTarget) }}><header className="flex items-start justify-between"><div><p className="eyebrow">Partita cloud</p><h1 id="cloud-match-editor-title">{match ? 'Modifica partita' : 'Nuova partita'}</h1></div><Button type="button" size="icon" variant="ghost" onClick={onClose} aria-label="Chiudi"><X /></Button></header><div className="grid gap-3 sm:grid-cols-2"><Field label="Data"><Input name="date" type="date" required defaultValue={match?.matchDate} /></Field><Field label="Ora"><Input name="time" type="time" defaultValue={match?.startTime?.slice(0, 5) ?? ''} /></Field><Field label="Avversario"><Input name="opponent" required maxLength={160} defaultValue={match?.opponent} /></Field><Field label="Casa o trasferta"><Select name="homeAway" defaultValue={match?.homeAway ?? 'home'}><option value="home">Casa</option><option value="away">Trasferta</option></Select></Field><Field label="Competizione"><Input name="competition" maxLength={160} defaultValue={match?.competition ?? ''} /></Field><Field label="Luogo"><Input name="location" maxLength={240} defaultValue={match?.location ?? ''} /></Field><Field label="Stato"><Select value={status} onChange={event => setStatus(event.target.value as CloudMatch['status'])}><option value="scheduled">Programmato</option><option value="live">In corso</option><option value="completed">Completato</option><option value="cancelled">Annullato</option></Select></Field><Field label="Risultato nostro"><Input name="ourScore" type="number" min="0" disabled={status === 'cancelled'} defaultValue={match?.ourScore ?? ''} /></Field><Field label="Risultato avversario"><Input name="opponentScore" type="number" min="0" disabled={status === 'cancelled'} defaultValue={match?.opponentScore ?? ''} /></Field></div><Field label="Note staff"><Textarea name="notes" defaultValue={match?.coachNotes ?? ''} maxLength={10000} /></Field>{error && <ErrorState message={error} />}<div className="flex justify-end gap-2"><Button type="button" onClick={onClose} disabled={busy}>Annulla</Button><Button variant="primary" loading={busy}>Salva partita</Button></div></form></DialogSheet>
}
