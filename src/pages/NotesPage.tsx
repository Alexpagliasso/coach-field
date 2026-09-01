import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { Download, RotateCcw } from 'lucide-react'
import { AudioNote } from '../components/AudioNote'
import { VoiceRecorder } from '../components/VoiceRecorder'
import { getAppState } from '../db/appStateRepository'
import { createBackup, restoreBackup, type BackupPayload } from '../db/backupRepository'
import { getObservations } from '../db/observationsRepository'
import { getPlayers } from '../db/playersRepository'
import { getCurrentSession } from '../db/sessionsRepository'
import { deleteVoiceNote, getVoiceNotes } from '../db/voiceNotesRepository'
import type { AppState, Observation, Player, TrainingSession, VoiceNote } from '../types/domain'
import { formatDateTime } from '../utils/format'

export function NotesPage() {
  const [players, setPlayers] = useState<Player[]>([])
  const [session, setSession] = useState<TrainingSession>()
  const [appState, setAppState] = useState<AppState>()
  const [observations, setObservations] = useState<Observation[]>([])
  const [voiceNotes, setVoiceNotes] = useState<VoiceNote[]>([])
  const [playerFilter, setPlayerFilter] = useState('')
  const [phaseFilter, setPhaseFilter] = useState('')
  const restoreInputRef = useRef<HTMLInputElement | null>(null)

  const refresh = async () => {
    const [loadedPlayers, loadedSession, loadedState, loadedObservations, loadedVoiceNotes] = await Promise.all([
      getPlayers(),
      getCurrentSession(),
      getAppState(),
      getObservations(),
      getVoiceNotes(),
    ])
    setPlayers(loadedPlayers)
    setSession(loadedSession)
    setAppState(loadedState)
    setObservations(loadedObservations)
    setVoiceNotes(loadedVoiceNotes)
  }

  useEffect(() => {
    Promise.all([
      getPlayers(),
      getCurrentSession(),
      getAppState(),
      getObservations(),
      getVoiceNotes(),
    ]).then(([loadedPlayers, loadedSession, loadedState, loadedObservations, loadedVoiceNotes]) => {
      setPlayers(loadedPlayers)
      setSession(loadedSession)
      setAppState(loadedState)
      setObservations(loadedObservations)
      setVoiceNotes(loadedVoiceNotes)
    })
  }, [])

  const playerName = (id?: string) => {
    const player = players.find((item) => item.id === id)
    return player ? `${player.firstName} ${player.lastName ?? ''}`.trim() : 'Senza giocatore'
  }

  const phaseName = (id?: string) => session?.phases.find((phase) => phase.id === id)?.title ?? 'Senza fase'
  const exerciseName = (id?: string) => {
    const exercise = session?.phases.flatMap((phase) => phase.fields ?? []).find((field) => field.id === id)
    return exercise ? ` · Campo ${exercise.field}` : ''
  }

  const filteredObservations = useMemo(() => observations.filter((item) => (
    (!playerFilter || item.playerId === playerFilter) && (!phaseFilter || item.phaseId === phaseFilter)
  )), [observations, phaseFilter, playerFilter])

  const filteredVoiceNotes = useMemo(() => voiceNotes.filter((item) => (
    (!playerFilter || item.playerId === playerFilter) && (!phaseFilter || item.phaseId === phaseFilter)
  )), [phaseFilter, playerFilter, voiceNotes])

  const exportBackup = async () => {
    const backup = await createBackup()
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `coach-field-backup-${new Date().toISOString().slice(0, 10)}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const restore = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const confirmed = window.confirm('Ripristinare il backup? Giocatori e osservazioni correnti verranno sostituiti.')
    if (!confirmed) return
    const payload = JSON.parse(await file.text()) as BackupPayload
    await restoreBackup(payload)
    await refresh()
    event.target.value = ''
  }

  if (!session || !appState) return null

  return (
    <section className="page">
      <header className="page-header compact">
        <span className="eyebrow">Archivio locale</span>
        <h1>Note</h1>
      </header>

      <div className="filters">
        <select value={playerFilter} onChange={(event) => setPlayerFilter(event.target.value)} aria-label="Filtro giocatore">
          <option value="">Tutti i giocatori</option>
          {players.map((player) => <option key={player.id} value={player.id}>{player.firstName} {player.lastName}</option>)}
        </select>
        <select value={phaseFilter} onChange={(event) => setPhaseFilter(event.target.value)} aria-label="Filtro fase">
          <option value="">Tutte le fasi</option>
          {session.phases.map((phase) => <option key={phase.id} value={phase.id}>{phase.title}</option>)}
        </select>
      </div>

      <VoiceRecorder
        sessionId={session.id}
        phaseId={phaseFilter || appState.currentPhaseId}
        playerId={playerFilter || undefined}
        onSaved={refresh}
      />

      <div className="action-row">
        <button type="button" onClick={exportBackup}><Download size={20} />Esporta backup</button>
        <button type="button" onClick={() => restoreInputRef.current?.click()}><RotateCcw size={20} />Ripristina</button>
        <input ref={restoreInputRef} hidden type="file" accept="application/json" onChange={restore} />
      </div>

      <section className="content-section">
        <h2>Vocali recenti</h2>
        <div className="list-stack">
          {filteredVoiceNotes.map((note) => (
            <AudioNote
              key={note.id}
              note={note}
              title={playerName(note.playerId)}
              subtitle={`${phaseName(note.phaseId)}${exerciseName(note.exerciseId)} · ${formatDateTime(note.createdAt)}`}
              onDelete={async (noteId) => {
                await deleteVoiceNote(noteId)
                refresh()
              }}
            />
          ))}
          {filteredVoiceNotes.length === 0 && <p className="empty-state">Nessuna nota vocale con questi filtri.</p>}
        </div>
      </section>

      <section className="content-section">
        <h2>Testuali recenti</h2>
        <div className="list-stack">
          {filteredObservations.map((item) => (
            <article key={item.id} className="list-card">
              <div>
                <strong>{playerName(item.playerId)} · {item.value === 'positive' ? 'positivo' : 'attenzione'}</strong>
                <span>{item.note || item.category}</span>
                <small>{phaseName(item.phaseId)} · {formatDateTime(item.createdAt)}</small>
              </div>
            </article>
          ))}
          {filteredObservations.length === 0 && <p className="empty-state">Nessuna nota testuale con questi filtri.</p>}
        </div>
      </section>
    </section>
  )
}
