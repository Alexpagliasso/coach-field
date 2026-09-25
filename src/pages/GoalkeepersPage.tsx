import { PermissionAction } from '../components/PermissionAction'
import { useEffect, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { getAppState } from '../db/appStateRepository'
import { addObservation, getObservationsByPlayer } from '../db/observationsRepository'
import { getPlayers, toggleGoalkeeperCandidate } from '../db/playersRepository'
import { getCurrentSession } from '../db/sessionsRepository'
import { getVoiceNotesByPlayer } from '../db/voiceNotesRepository'
import type { AppState, Observation, Player, TrainingSession, VoiceNote } from '../types/domain'
import { formatPlayerYear } from '../utils/player'

const tags = ['buona presa', 'non ha paura', 'riflessi', 'posizione', 'uscita', 'da rivedere', 'disponibile sabato']

export function GoalkeepersPage() {
  const [players, setPlayers] = useState<Player[]>([])
  const [selectedId, setSelectedId] = useState<string>()
  const [session, setSession] = useState<TrainingSession>()
  const [appState, setAppState] = useState<AppState>()
  const [observations, setObservations] = useState<Observation[]>([])
  const [voiceNotes, setVoiceNotes] = useState<VoiceNote[]>([])

  const refresh = async (playerId = selectedId) => {
    const [loadedPlayers, loadedSession, loadedState] = await Promise.all([getPlayers(), getCurrentSession(), getAppState()])
    const sorted = loadedPlayers.sort((a, b) => Number(b.goalkeeperCandidate) - Number(a.goalkeeperCandidate) || a.firstName.localeCompare(b.firstName))
    setPlayers(sorted)
    setSession(loadedSession)
    setAppState(loadedState)
    const nextSelected = playerId ?? sorted.find((player) => player.goalkeeperCandidate)?.id ?? sorted[0]?.id
    setSelectedId(nextSelected)
    if (nextSelected) {
      const [loadedObservations, loadedVoiceNotes] = await Promise.all([
        getObservationsByPlayer(nextSelected),
        getVoiceNotesByPlayer(nextSelected),
      ])
      setObservations(loadedObservations.filter((item) => item.category === 'goalkeeper'))
      setVoiceNotes(loadedVoiceNotes)
    }
  }

  useEffect(() => {
    Promise.all([getPlayers(), getCurrentSession(), getAppState()]).then(async ([loadedPlayers, loadedSession, loadedState]) => {
      const sorted = loadedPlayers.sort((a, b) => Number(b.goalkeeperCandidate) - Number(a.goalkeeperCandidate) || a.firstName.localeCompare(b.firstName))
      const nextSelected = sorted.find((player) => player.goalkeeperCandidate)?.id ?? sorted[0]?.id
      setPlayers(sorted)
      setSession(loadedSession)
      setAppState(loadedState)
      setSelectedId(nextSelected)
      if (nextSelected) {
        const [loadedObservations, loadedVoiceNotes] = await Promise.all([
          getObservationsByPlayer(nextSelected),
          getVoiceNotesByPlayer(nextSelected),
        ])
        setObservations(loadedObservations.filter((item) => item.category === 'goalkeeper'))
        setVoiceNotes(loadedVoiceNotes)
      }
    })
  }, [])

  const selected = players.find((player) => player.id === selectedId)

  const toggle = async (player: Player) => {
    await toggleGoalkeeperCandidate(player.id)
    refresh(player.id)
  }

  const addTag = async (tag: string) => {
    if (!selected || !session) return
    await addObservation({
      playerId: selected.id,
      sessionId: session.id,
      phaseId: appState?.currentPhaseId,
      category: 'goalkeeper',
      value: tag === 'da rivedere' ? 'attention' : 'positive',
      note: tag,
    })
    refresh(selected.id)
  }

  return (
    <section className="page">
      <header className="page-header compact">
        <span className="eyebrow">Candidati</span>
        <h1>Portieri</h1>
      </header>

      <div className="keeper-layout">
        <div className="list-stack">
          {players.map((player) => (
            <article key={player.id} className={`list-card player-row ${selectedId === player.id ? 'selected' : ''}`}>
              <button type="button" className="row-select" onClick={() => refresh(player.id)}>
                <strong>{player.firstName} {player.lastName}</strong>
                <span>{formatPlayerYear(player.year)} · {player.previousRoles.join(', ') || 'Ruolo da osservare'}</span>
                {player.status === 'guest' && <small className="status-badge">OSPITE</small>}
              </button>
              <label className="switch">
                <PermissionAction permission="players.edit"><input type="checkbox" checked={player.goalkeeperCandidate} onChange={() => toggle(player)} /></PermissionAction>
                <span>Candidato portiere</span>
              </label>
            </article>
          ))}
        </div>

        {selected && (
          <section className="content-section">
            <h2><ShieldCheck size={22} /> {selected.firstName}</h2>
            <div className="tag-grid">
              {tags.map((tag) => (
                <PermissionAction permission="notes.create" key={tag}><button key={tag} type="button" onClick={() => addTag(tag)}>{tag}</button></PermissionAction>
              ))}
            </div>
            <div className="list-stack">
              {observations.map((item) => (
                <article key={item.id} className="list-card">
                  <div>
                    <strong>{item.note}</strong>
                    <small>{new Date(item.createdAt).toLocaleString('it-IT')}</small>
                  </div>
                </article>
              ))}
              {voiceNotes.map((item) => (
                <article key={item.id} className="list-card">
                  <div>
                    <strong>Nota vocale</strong>
                    <span>{item.durationSeconds}s</span>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </section>
  )
}
