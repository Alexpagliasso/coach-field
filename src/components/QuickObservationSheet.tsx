import { useEffect, useState } from 'react'
import { createObservation } from '../db/observationsRepository'
import type { ObservationCategory, ObservationContextType, ObservationSentiment, ObservationSubjectType, Player, CorrectionResponse } from '../types/domain'
import { VoiceRecorder } from './VoiceRecorder'

type Props = {
  contextType: ObservationContextType
  matchId?: string
  sessionId?: string
  phaseId?: string
  exerciseId?: string
  players: Player[]
  onSaved?: () => void
  onClose: () => void
}

const categories: Array<[ObservationCategory, string]> = [['technical', 'Tecnica'], ['tactical', 'Tattica'], ['attitude', 'Atteggiamento'], ['learning', 'Apprendimento'], ['behaviour', 'Comportamento'], ['other', 'Altro']]
const sentiments: Array<[ObservationSentiment, string]> = [['positive', 'Positivo'], ['neutral', 'Da monitorare'], ['concern', 'Criticità']]
const responses: Array<[CorrectionResponse, string]> = [['improved', 'Migliorato'], ['unchanged', 'Invariato'], ['worsened', 'Peggiorato'], ['unknown', 'Non verificato']]

export function QuickObservationSheet({ contextType, matchId, sessionId, phaseId, exerciseId, players, onSaved, onClose }: Props) {
  const [subjectType, setSubjectType] = useState<ObservationSubjectType>('team')
  const [playerId, setPlayerId] = useState('')
  const [mode, setMode] = useState<'write' | 'record'>('write')
  const [text, setText] = useState('')
  const [category, setCategory] = useState<ObservationCategory | ''>('')
  const [sentiment, setSentiment] = useState<ObservationSentiment | ''>('')
  const [correction, setCorrection] = useState('')
  const [response, setResponse] = useState<CorrectionResponse | ''>('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [onClose])

  const save = async () => {
    setSaving(true); setError('')
    try {
      await createObservation({ text, subjectType, playerId: subjectType === 'player' ? playerId : undefined, contextType, matchId, sessionId, phaseId, exerciseId, category: category || undefined, sentiment: sentiment || undefined, correction: correction.trim() || undefined, response: response || undefined })
      onSaved?.(); onClose()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Osservazione non salvata.') }
    finally { setSaving(false) }
  }

  return <div className="sheet-backdrop" role="presentation" onClick={onClose}>
    <section className="quick-observation-sheet" role="dialog" aria-modal="true" aria-labelledby="quick-observation-title" onClick={event => event.stopPropagation()}>
      <div className="sheet-handle" />
      <header className="exercise-sheet-header"><div><span className="eyebrow">Cattura rapida</span><h1 id="quick-observation-title">Nuova osservazione</h1></div><button type="button" className="icon-button" onClick={onClose} aria-label="Chiudi osservazione">×</button></header>
      <div className="quick-observation-scroll">
        <div className="segmented-control" aria-label="Soggetto osservazione">
          <button type="button" className={subjectType === 'team' ? 'selected' : ''} onClick={() => setSubjectType('team')}>Squadra</button>
          <button type="button" className={subjectType === 'player' ? 'selected' : ''} onClick={() => setSubjectType('player')}>Giocatore</button>
        </div>
        {subjectType === 'player' && <label className="form-field"><span>Giocatore</span><select aria-label="Giocatore" value={playerId} onChange={event => setPlayerId(event.target.value)} autoFocus><option value="">Seleziona…</option>{players.map(player => <option key={player.id} value={player.id}>{player.firstName} {player.lastName}</option>)}</select></label>}
        <div className="segmented-control" aria-label="Formato osservazione"><button type="button" className={mode === 'write' ? 'selected' : ''} onClick={() => setMode('write')}>Scrivi</button><button type="button" className={mode === 'record' ? 'selected' : ''} onClick={() => setMode('record')}>Registra</button></div>
        {mode === 'write' ? <label className="form-field"><span>Osservazione</span><textarea aria-label="Osservazione" rows={5} value={text} onChange={event => setText(event.target.value)} placeholder="Cosa hai appena visto?" autoFocus={subjectType === 'team'} /></label> : subjectType === 'player' && !playerId ? <p role="alert" className="form-error">Seleziona un giocatore prima di registrare.</p> : <VoiceRecorder sessionId={sessionId ?? (matchId ? 'match' : 'general')} matchId={matchId} phaseId={phaseId} exerciseId={exerciseId} playerId={subjectType === 'player' ? playerId : undefined} subjectType={subjectType} contextType={contextType} onSaved={() => { onSaved?.(); onClose() }} />}
        {mode === 'write' && <details className="observation-details"><summary>Dettagli facoltativi</summary><div className="observation-details-grid">
          <label className="form-field"><span>Categoria</span><select value={category} onChange={event => setCategory(event.target.value as ObservationCategory | '')}><option value="">Nessuna</option>{categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="form-field"><span>Valenza</span><select value={sentiment} onChange={event => setSentiment(event.target.value as ObservationSentiment | '')}><option value="">Nessuna</option>{sentiments.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="form-field"><span>Correzione</span><textarea rows={2} value={correction} onChange={event => setCorrection(event.target.value)} /></label>
          <label className="form-field"><span>Risposta</span><select value={response} onChange={event => setResponse(event.target.value as CorrectionResponse | '')}><option value="">Nessuna</option>{responses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        </div></details>}
        {error && <p role="alert" className="form-error">{error}</p>}
      </div>
      {mode === 'write' && <footer className="sheet-footer"><button type="button" className="primary-action" disabled={saving} onClick={save}>{saving ? 'Salvataggio…' : 'Salva osservazione'}</button></footer>}
    </section>
  </div>
}
