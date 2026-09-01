import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Goal, HeartHandshake, MessageCircle, Plus, Shield, Sparkles, TriangleAlert } from 'lucide-react'
import { getAppState } from '../db/appStateRepository'
import { addObservation, getObservationsByPlayer } from '../db/observationsRepository'
import { getPlayer, promotePlayerToRoster, toggleGoalkeeperCandidate, updatePlayerIdealRoles, updatePlayerRating } from '../db/playersRepository'
import { getCurrentSession } from '../db/sessionsRepository'
import { getVoiceNotesByPlayer } from '../db/voiceNotesRepository'
import type { AppState, Observation, ObservationCategory, Player, PlayerRating, PlayerRole, TrainingSession, VoiceNote } from '../types/domain'
import { VoiceRecorder } from '../components/VoiceRecorder'
import { formatDateTime } from '../utils/format'
import { PlayerStarRating } from '../components/PlayerStarRating'
import { formatPlayerYear, roleOptions } from '../utils/player'

const actions: Array<{ label: string; category: ObservationCategory; icon: typeof Sparkles }> = [
  { label: 'Tecnica', category: 'technique', icon: Sparkles },
  { label: 'Gioco', category: 'game', icon: Goal },
  { label: 'Atteggiamento', category: 'attitude', icon: TriangleAlert },
  { label: 'Relazione', category: 'relationship', icon: HeartHandshake },
  { label: 'Portiere', category: 'goalkeeper', icon: Shield },
]

const categoryLabels: Record<ObservationCategory, string> = {
  technique: 'Tecnica',
  game: 'Gioco',
  attitude: 'Atteggiamento',
  relationship: 'Relazione',
  goalkeeper: 'Portiere',
}

const goalkeeperTags = ['Non ha paura', 'Buone mani', 'Riflessi', 'Posizione', 'Uscite', 'Da rivedere', 'Disponibile sabato']
export function PlayerDetailPage() {
  const { id } = useParams()
  const [player, setPlayer] = useState<Player>()
  const [observations, setObservations] = useState<Observation[]>([])
  const [voiceNotes, setVoiceNotes] = useState<VoiceNote[]>([])
  const [session, setSession] = useState<TrainingSession>()
  const [appState, setAppState] = useState<AppState>()
  const [note, setNote] = useState('')
  const [savedFlash, setSavedFlash] = useState('')

  const phaseId = appState?.currentPhaseId
  const currentPhase = useMemo(() => session?.phases.find((phase) => phase.id === phaseId), [phaseId, session])

  const refresh = async () => {
    if (!id) return
    const [loadedPlayer, loadedObservations, loadedNotes, loadedSession, loadedState] = await Promise.all([
      getPlayer(id),
      getObservationsByPlayer(id),
      getVoiceNotesByPlayer(id),
      getCurrentSession(),
      getAppState(),
    ])
    setPlayer(loadedPlayer)
    setObservations(loadedObservations)
    setVoiceNotes(loadedNotes)
    setSession(loadedSession)
    setAppState(loadedState)
  }

  useEffect(() => {
    if (!id) return
    Promise.all([
      getPlayer(id),
      getObservationsByPlayer(id),
      getVoiceNotesByPlayer(id),
      getCurrentSession(),
      getAppState(),
    ]).then(([loadedPlayer, loadedObservations, loadedNotes, loadedSession, loadedState]) => {
      setPlayer(loadedPlayer)
      setObservations(loadedObservations)
      setVoiceNotes(loadedNotes)
      setSession(loadedSession)
      setAppState(loadedState)
    })
  }, [id])

  if (!player || !session) return null

  const quickAdd = async (category: ObservationCategory, value: 'positive' | 'attention' = 'positive', text?: string) => {
    await addObservation({
      playerId: player.id,
      sessionId: session.id,
      phaseId,
      category,
      value,
      note: text,
    })
    setNote('')
    setSavedFlash(value === 'positive' ? 'Osservazione positiva salvata' : 'Punto attenzione salvato')
    window.setTimeout(() => setSavedFlash(''), 1600)
    refresh()
  }

  const markInterestingGoalkeeper = async () => {
    await toggleGoalkeeperCandidate(player.id, true)
    await quickAdd('goalkeeper', 'positive', 'Interessante in porta')
  }

  const flashSaved = () => {
    setSavedFlash('Salvato ✓')
    window.setTimeout(() => setSavedFlash(''), 1000)
  }

  const saveRating = async (rating: PlayerRating) => {
    const next = { ...player, rating }
    setPlayer(next)
    flashSaved()
    await updatePlayerRating(player.id, rating)
  }

  const toggleIdealRole = async (role: PlayerRole) => {
    const currentRoles = player.idealRoles ?? []
    const nextRoles = currentRoles.includes(role)
      ? currentRoles.filter((item) => item !== role)
      : [...currentRoles, role]
    setPlayer({ ...player, idealRoles: nextRoles })
    flashSaved()
    await updatePlayerIdealRoles(player.id, nextRoles)
  }

  const addToRoster = async () => {
    await promotePlayerToRoster(player.id)
    setPlayer({ ...player, status: 'roster' })
    setSavedFlash('Aggiunto alla rosa ✓')
    window.setTimeout(() => setSavedFlash(''), 1300)
  }

  return (
    <section className="page">
      <header className="page-header compact">
        <span className="eyebrow">{formatPlayerYear(player.year)} · {player.previousRoles.join(', ') || 'Ruolo da osservare'}</span>
        <h1>{player.firstName} {player.lastName}</h1>
        {currentPhase && <p>{currentPhase.title}</p>}
      </header>

      {player.status === 'guest' && (
        <section className="content-section guest-banner">
          <div>
            <span className="status-badge">OSPITE</span>
            <strong>Giocatore aggiunto al volo</strong>
          </div>
          <button type="button" className="primary-action" onClick={addToRoster}>Aggiungi alla rosa</button>
        </section>
      )}

      <section className="content-section player-profile-section">
        <h2>Valutazione generale</h2>
        <PlayerStarRating value={player.rating} onChange={saveRating} />
        {player.rating !== null && (
          <button type="button" className="subtle-button" onClick={() => saveRating(null)}>
            Rimuovi valutazione
          </button>
        )}
      </section>

      <section className="content-section player-profile-section">
        <h2>Ruolo ideale</h2>
        <div className="ideal-role-grid">
          {roleOptions.map((role) => {
            const selected = (player.idealRoles ?? []).includes(role.id)
            return (
              <button key={role.id} type="button" aria-pressed={selected} className={selected ? 'selected' : ''} onClick={() => toggleIdealRole(role.id)}>
                {role.id}
              </button>
            )
          })}
        </div>
        <p className="role-help">{roleOptions.map((role) => `${role.id} = ${role.label}`).join(' · ')}</p>
      </section>

      {savedFlash && <p className="save-flash">{savedFlash}</p>}

      <section className="content-section player-profile-section">
        <h2>Osservazioni rapide</h2>
      </section>

      <div className="quick-grid">
        {actions.map(({ label, category, icon: Icon }) => (
          <button key={category} type="button" className="quick-action" onClick={() => quickAdd(category)}>
            <Icon size={24} />
            {label}
            <small>+ positivo</small>
          </button>
        ))}
      </div>

      <section className="content-section">
        <button type="button" className="primary-action keeper-action" onClick={markInterestingGoalkeeper}>
          <Shield size={24} />
          Interessante in porta
        </button>
        <div className="tag-grid">
          {goalkeeperTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => quickAdd('goalkeeper', tag === 'Da rivedere' ? 'attention' : 'positive', tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      </section>

      <div className="note-panel">
        <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Nota testuale rapida" rows={3} />
        <div className="action-row">
          <button type="button" onClick={() => note.trim() && quickAdd('attitude', 'positive', note.trim())}>
            <Plus size={20} />Positiva
          </button>
          <button type="button" onClick={() => note.trim() && quickAdd('attitude', 'attention', note.trim())}>
            <MessageCircle size={20} />Attenzione
          </button>
        </div>
      </div>

      <VoiceRecorder sessionId={session.id} phaseId={phaseId} playerId={player.id} onSaved={refresh} />

      <section className="content-section">
        <h2>Cronologia</h2>
        <div className="list-stack">
          {observations.map((item) => (
            <article key={item.id} className="list-card">
              <div>
                <strong>{categoryLabels[item.category]} · {item.value === 'positive' ? 'positivo' : 'attenzione'}</strong>
                {item.note && <span>{item.note}</span>}
                <small>{formatDateTime(item.createdAt)}</small>
              </div>
            </article>
          ))}
          {voiceNotes.map((voice) => (
            <article key={voice.id} className="list-card">
              <div>
                <strong>Nota vocale</strong>
                <span>{voice.durationSeconds}s</span>
                <small>{formatDateTime(voice.createdAt)}</small>
              </div>
            </article>
          ))}
          {observations.length === 0 && voiceNotes.length === 0 && <p className="empty-state">Ancora nessuna nota per questo giocatore.</p>}
        </div>
      </section>
    </section>
  )
}
