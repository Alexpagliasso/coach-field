import { PermissionAction } from '../components/PermissionAction'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { Download, RotateCcw } from 'lucide-react'
import { AudioNote } from '../components/AudioNote'
import { VoiceRecorder } from '../components/VoiceRecorder'
import { getAppState } from '../db/appStateRepository'
import { exportCoachFieldData, getLocalDataCounts, restoreBackup, type BackupPayload } from '../db/backupRepository'
import { getObservations, updateObservationStatus } from '../db/observationsRepository'
import { getPlayers } from '../db/playersRepository'
import { getCurrentSession } from '../db/sessionsRepository'
import { deleteVoiceNote, getVoiceNotes, updateVoiceNoteStatus } from '../db/voiceNotesRepository'
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
  const [subjectFilter, setSubjectFilter] = useState<'all' | 'team' | 'player'>('all')
  const [contextFilter, setContextFilter] = useState<'all' | 'match' | 'training'>('all')
  const [dataCounts, setDataCounts] = useState<Record<string, number>>({})
  const [backupStatus, setBackupStatus] = useState('')
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
    setDataCounts(await getLocalDataCounts())
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
      getLocalDataCounts().then(setDataCounts)
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
    (!playerFilter || item.playerId === playerFilter) && (!phaseFilter || item.phaseId === phaseFilter) &&
    (subjectFilter === 'all' || item.subjectType === subjectFilter) && (contextFilter === 'all' || item.contextType === contextFilter)
  )), [contextFilter, observations, phaseFilter, playerFilter, subjectFilter])

  const inboxObservations = filteredObservations.filter(item => item.status === 'inbox')

  const filteredVoiceNotes = useMemo(() => voiceNotes.filter((item) => (
    (!playerFilter || item.playerId === playerFilter) && (!phaseFilter || item.phaseId === phaseFilter)
  )), [phaseFilter, playerFilter, voiceNotes])
  const inboxVoiceNotes = filteredVoiceNotes.filter(item => item.status === 'inbox' && (subjectFilter === 'all' || item.subjectType === subjectFilter) && (contextFilter === 'all' || item.contextType === contextFilter))

  const exportBackup = async () => {
    setBackupStatus('Preparazione backup...')
    try {
      const backup = await exportCoachFieldData()
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      const exportedAt = new Date(backup.exportedAt)
      const stamp = [
        exportedAt.getFullYear(),
        String(exportedAt.getMonth() + 1).padStart(2, '0'),
        String(exportedAt.getDate()).padStart(2, '0'),
      ].join('-')
      const time = `${String(exportedAt.getHours()).padStart(2, '0')}${String(exportedAt.getMinutes()).padStart(2, '0')}`
      anchor.href = url
      anchor.download = `coach-field-backup-${stamp}-${time}.json`
      anchor.click()
      URL.revokeObjectURL(url)
      setDataCounts(backup.counts)
      setBackupStatus('Backup creato')
    } catch (error) {
      console.error('[CoachField] Backup export failed', error)
      setBackupStatus('Impossibile creare il backup')
    } finally {
      window.setTimeout(() => setBackupStatus(''), 1800)
    }
  }

  const restore = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const confirmed = window.confirm('Ripristinare il backup? I dati locali correnti verranno sostituiti dagli elementi del file.')
    if (!confirmed) return
    try {
      const payload = JSON.parse(await file.text()) as BackupPayload
      await restoreBackup(payload)
    } catch (error) {
      setBackupStatus(error instanceof Error ? error.message : 'Backup non valido.')
    } finally { event.target.value = '' }
  }


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
          {session?.phases.map((phase) => <option key={phase.id} value={phase.id}>{phase.title}</option>)}
        </select>
      </div>

      <PermissionAction permission="notes.create"><VoiceRecorder
        sessionId={session?.id ?? 'general'}
        phaseId={phaseFilter || appState?.currentPhaseId}
        playerId={playerFilter || undefined}
        onSaved={refresh}
      /></PermissionAction>

      <section className="content-section">
        <div className="section-header-row"><div><span className="eyebrow">Inbox</span><h2>Osservazioni da rivedere</h2></div><strong>{inboxObservations.length + inboxVoiceNotes.length}</strong></div>
        <div className="filters"><select aria-label="Filtro soggetto" value={subjectFilter} onChange={event => setSubjectFilter(event.target.value as typeof subjectFilter)}><option value="all">Tutte</option><option value="team">Squadra</option><option value="player">Giocatori</option></select><select aria-label="Filtro contesto" value={contextFilter} onChange={event => setContextFilter(event.target.value as typeof contextFilter)}><option value="all">Ogni contesto</option><option value="match">Partita</option><option value="training">Allenamento</option></select></div>
        <div className="list-stack">{inboxObservations.map(item => <article key={item.id} className="list-card"><div><strong>{item.text || 'Osservazione'}</strong><span>{item.subjectType === 'team' ? 'Squadra' : playerName(item.playerId)} · {item.contextType === 'match' ? 'Partita' : item.contextType === 'training' ? 'Allenamento' : 'Generale'}</span><small>{item.category ? `${item.category} · ` : ''}{item.sentiment ? `${item.sentiment} · ` : ''}{formatDateTime(item.createdAt)}</small></div><div className="vertical-actions"><PermissionAction permission="notes.create"><button type="button" onClick={async () => { await updateObservationStatus(item.id, 'reviewed'); refresh() }}>Rivedi</button></PermissionAction><PermissionAction permission="notes.create"><button type="button" onClick={async () => { await updateObservationStatus(item.id, 'archived'); refresh() }}>Archivia</button></PermissionAction></div></article>)}{inboxVoiceNotes.map(item => <article key={item.id} className="list-card"><div><strong>Osservazione vocale · {item.durationSeconds}s</strong><span>{item.subjectType === 'team' ? 'Squadra' : playerName(item.playerId)} · {item.contextType === 'match' ? 'Partita' : item.contextType === 'training' ? 'Allenamento' : 'Generale'}</span><small>{formatDateTime(item.createdAt)}</small></div><div className="vertical-actions"><button type="button" onClick={async () => { await updateVoiceNoteStatus(item.id, 'reviewed'); refresh() }}>Rivedi</button><button type="button" onClick={async () => { await updateVoiceNoteStatus(item.id, 'archived'); refresh() }}>Archivia</button></div></article>)}{inboxObservations.length + inboxVoiceNotes.length === 0 && <p className="empty-state">Nessuna osservazione da rivedere.</p>}</div>
      </section>

      <section className="content-section backup-panel">
        <div>
          <span className="eyebrow">Impostazioni · Dati</span>
          <h2>Backup dati</h2>
          <p>Esporta una copia dei dati salvati su questo dispositivo.</p>
        </div>
        <div className="data-count-grid" aria-label="Dati su questo dispositivo">
          <span><strong>{dataCounts.players ?? 0}</strong> giocatori</span>
          <span><strong>{dataCounts.sessions ?? 0}</strong> allenamenti</span>
          <span><strong>{dataCounts.attendance ?? 0}</strong> presenze</span>
          <span><strong>{dataCounts.observations ?? 0}</strong> osservazioni</span>
          <span><strong>{dataCounts.matches ?? 0}</strong> partite</span>
          <span><strong>{dataCounts.matchPlayerEvaluations ?? 0}</strong> valutazioni partita</span>
          <span><strong>{dataCounts.trainingTemplates ?? 0}</strong> template</span>
          <span><strong>{dataCounts.trainingPlayerEvaluations ?? 0}</strong> valutazioni allenamento</span>
          <span><strong>{dataCounts.playerObjectives ?? 0}</strong> obiettivi</span>
          <span><strong>{dataCounts.playerObjectiveEvidence ?? 0}</strong> evidenze</span>
          <span><strong>{dataCounts.playerDevelopmentReviews ?? 0}</strong> review sviluppo</span>
          <span><strong>{dataCounts.voiceNotes ?? 0}</strong> note vocali</span>
          <span><strong>{dataCounts.appState ?? 0}</strong> impostazioni</span>
        </div>
        <PermissionAction permission="data.manage"><button type="button" className="primary-action" onClick={exportBackup}><Download size={22} />Esporta backup</button></PermissionAction>
        <p className="muted-copy">I dati non verranno modificati.</p>
        <p className="privacy-note">Il backup puo contenere dati dei giocatori e note dello staff. Conservalo in un luogo sicuro.</p>
        {backupStatus && <p className="save-flash compact-flash">{backupStatus}</p>}
      </section>

      <div className="action-row">
        <PermissionAction permission="data.manage"><button type="button" onClick={() => restoreInputRef.current?.click()}><RotateCcw size={20} />Ripristina</button></PermissionAction>
        <PermissionAction permission="data.manage"><input ref={restoreInputRef} hidden type="file" accept="application/json" onChange={restore} /></PermissionAction>
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
