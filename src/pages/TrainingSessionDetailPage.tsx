import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Check, Trash2 } from 'lucide-react'
import { AttendanceSheet } from '../components/AttendanceSheet'
import { CompactStarRating } from '../components/PlayerStarRating'
import { TrainingPhaseSheet } from '../components/TrainingPhaseSheet'
import { TrainingPlayerEvaluationSheet } from '../components/TrainingPlayerEvaluationSheet'
import { VoiceRecorder } from '../components/VoiceRecorder'
import { ensureAttendanceForSession } from '../db/attendanceRepository'
import { getMatches } from '../db/matchesRepository'
import { getAllActiveObjectives } from '../db/playerDevelopmentRepository'
import { getPlayers } from '../db/playersRepository'
import { deleteTrainingSession, getTrainingSessionById, setCurrentTrainingSession, updateTrainingSession } from '../db/sessionsRepository'
import { getTrainingPlayerEvaluationsBySession, upsertTrainingPlayerEvaluation } from '../db/trainingPlayerEvaluationsRepository'
import type { Attendance, Match, Player, PlayerObjective, TrainingPlayerEvaluation, TrainingSession, TrainingSessionPhase } from '../types/domain'
import { formatMatchDate } from '../utils/match'
import { formatPlayerYear } from '../utils/player'
import { legacySessionToPlannedPhases, sessionDateLabel } from '../utils/training'

export function TrainingSessionDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [session, setSession] = useState<TrainingSession>()
  const [players, setPlayers] = useState<Player[]>([])
  const [attendance, setAttendance] = useState<Attendance[]>([])
  const [evaluations, setEvaluations] = useState<TrainingPlayerEvaluation[]>([])
  const [selectedPhase, setSelectedPhase] = useState<TrainingSessionPhase>()
  const [selectedEvaluation, setSelectedEvaluation] = useState<TrainingPlayerEvaluation>()
  const [attendanceOpen, setAttendanceOpen] = useState(false)
  const [latestMatch, setLatestMatch] = useState<Match>()
  const [activeObjectives, setActiveObjectives] = useState<PlayerObjective[]>([])
  const [flash, setFlash] = useState('')

  const refresh = async () => {
    if (!id) return
    const [loadedSession, loadedPlayers, loadedEvaluations, matches, objectives] = await Promise.all([
      getTrainingSessionById(id),
      getPlayers(),
      getTrainingPlayerEvaluationsBySession(id),
      getMatches(),
      getAllActiveObjectives(),
    ])
    if (!loadedSession) return
    const loadedAttendance = await ensureAttendanceForSession(loadedSession.id, loadedPlayers)
    setSession(loadedSession)
    setPlayers(loadedPlayers)
    setAttendance(loadedAttendance)
    setEvaluations(loadedEvaluations)
    setLatestMatch(matches.find((match) => Boolean(match.trainingTakeaways?.trim())))
    setActiveObjectives(objectives)
  }

  useEffect(() => {
    if (!id) return
    let cancelled = false
    Promise.all([
      getTrainingSessionById(id),
      getPlayers(),
      getTrainingPlayerEvaluationsBySession(id),
      getMatches(),
      getAllActiveObjectives(),
    ]).then(async ([loadedSession, loadedPlayers, loadedEvaluations, matches, objectives]) => {
      if (!loadedSession) return
      const loadedAttendance = await ensureAttendanceForSession(loadedSession.id, loadedPlayers)
      if (cancelled) return
      setSession(loadedSession)
      setPlayers(loadedPlayers)
      setAttendance(loadedAttendance)
      setEvaluations(loadedEvaluations)
      setLatestMatch(matches.find((match) => Boolean(match.trainingTakeaways?.trim())))
      setActiveObjectives(objectives)
    })
    return () => {
      cancelled = true
    }
  }, [id])

  const phases = useMemo(() => session ? legacySessionToPlannedPhases(session) : [], [session])
  const presentPlayerIds = new Set(attendance.filter((item) => item.present).map((item) => item.playerId))
  const presentPlayers = players.filter((player) => presentPlayerIds.has(player.id))
  const evaluationByPlayer = new Map(evaluations.map((evaluation) => [evaluation.playerId, evaluation]))
  const activeObjectivesByPlayer = new Map<string, number>()
  activeObjectives.forEach((objective) => activeObjectivesByPlayer.set(objective.playerId, (activeObjectivesByPlayer.get(objective.playerId) ?? 0) + 1))
  const ratedEvaluations = evaluations.filter((evaluation) => presentPlayerIds.has(evaluation.playerId) && evaluation.rating !== null)
  const completedPhases = phases.filter((phase) => phase.status === 'completed').length
  const modifiedPhases = phases.filter((phase) => phase.status === 'modified').length

  if (!session) return <section className="page"><p className="empty-state">Allenamento non trovato.</p></section>

  const persistSession = async (patch: Partial<TrainingSession>) => {
    const next = await updateTrainingSession(session.id, patch)
    if (next) setSession(next)
    setFlash('Salvato ✓')
    window.setTimeout(() => setFlash(''), 900)
  }

  const openEvaluation = async (player: Player) => {
    const current = evaluationByPlayer.get(player.id)
    const evaluation = current ?? await upsertTrainingPlayerEvaluation(session.id, player.id, { rating: null })
    setSelectedEvaluation(evaluation)
    refresh()
  }

  const completeSession = async () => {
    const missing = presentPlayers.length - ratedEvaluations.length
    const summary = [
      `${presentPlayers.length} presenti`,
      `${phases.length} fasi previste`,
      `${completedPhases} svolte`,
      `${modifiedPhases} modificate`,
      `${ratedEvaluations.length} / ${presentPlayers.length} giocatori valutati`,
      missing > 0 ? `${missing} presenti non hanno ancora una valutazione.` : '',
    ].filter(Boolean).join('\n')
    if (!window.confirm(`${summary}\n\nCompletare questo allenamento?`)) return
    const next = await updateTrainingSession(session.id, { status: 'completed' })
    if (next) setSession(next)
  }

  const deleteSession = async () => {
    if (!window.confirm('Eliminare questo allenamento?\n\nVerranno eliminate presenze, valutazioni e note collegate alla sessione.')) return
    await deleteTrainingSession(session.id)
    navigate('/training')
  }

  const addLatestTakeaways = async () => {
    if (!latestMatch?.trainingTakeaways) return
    await persistSession({ takeaways: `${session.takeaways ? `${session.takeaways}\n` : ''}${latestMatch.trainingTakeaways}` })
  }

  return (
    <section className="page">
      <header className="page-header compact">
        <span className="eyebrow">{sessionDateLabel(session.date)} · {session.startTime || 'Orario libero'}</span>
        <h1>{session.title}</h1>
        <p>{session.durationMinutes} min · {presentPlayers.length} presenti</p>
      </header>

      <section className="content-section match-summary">
        <div>
          <span className="eyebrow">Stato</span>
          <strong>{session.status === 'completed' ? 'Completato' : session.status === 'in_progress' ? 'In corso' : 'Pianificato'}</strong>
        </div>
        <button type="button" className="primary-action" onClick={async () => { await setCurrentTrainingSession(session); navigate('/') }}>Apri in Oggi</button>
      </section>

      {latestMatch?.trainingTakeaways && (
        <section className="content-section takeaway-section">
          <div>
            <span className="eyebrow">Da riprendere dall ultima partita</span>
            <h2>vs {latestMatch.opponent}</h2>
            <p>{formatMatchDate(latestMatch.date)}</p>
          </div>
          <p>{latestMatch.trainingTakeaways}</p>
          <button type="button" onClick={addLatestTakeaways}>Aggiungi alle note</button>
        </section>
      )}

      <section className="attendance-summary">
        <div>
          <span className="eyebrow">Presenti</span>
          <strong>{presentPlayers.length} / {players.length}</strong>
        </div>
        <button type="button" onClick={() => setAttendanceOpen(true)}>Gestisci presenze</button>
      </section>

      <section className="content-section">
        <h2>Programma</h2>
        <div className="list-stack">
          {phases.map((phase) => (
            <button key={phase.id} type="button" className="list-card training-phase-row" onClick={() => setSelectedPhase(phase)}>
              <span className="phase-marker">{phase.status === 'completed' ? '✓' : phase.status === 'modified' ? '↪' : phase.status === 'skipped' ? '×' : '○'}</span>
              <div>
                <strong>{phase.title}</strong>
                <span>{phase.actualDurationMinutes ?? phase.plannedDurationMinutes ?? 0}' · {phase.status.toUpperCase()}</span>
              </div>
              <CompactStarRating value={phase.coachRating ?? null} />
            </button>
          ))}
        </div>
      </section>

      <section className="content-section">
        <div className="section-header-row">
          <h2>Giocatori</h2>
          <span>{ratedEvaluations.length} / {presentPlayers.length} valutati</span>
        </div>
        <div className="list-stack">
          {presentPlayers.map((player) => {
            const evaluation = evaluationByPlayer.get(player.id)
            return (
              <button key={player.id} type="button" className="list-card player-row" onClick={() => openEvaluation(player)}>
                <div>
                  <strong>{player.firstName} {player.lastName}</strong>
                  <span>{formatPlayerYear(player.year)} · {evaluation?.rolesTried?.join(' · ') || player.idealRoles?.join(' · ') || player.previousRoles.join(' · ')}</span>
                  <small>{evaluation?.rating ? <CompactStarRating value={evaluation.rating} /> : 'DA VALUTARE'}{activeObjectivesByPlayer.get(player.id) ? ` · 🎯 ${activeObjectivesByPlayer.get(player.id)}` : ''}</small>
                </div>
              </button>
            )
          })}
          {presentPlayers.length === 0 && <p className="empty-state">Nessun presente selezionato.</p>}
        </div>
      </section>

      <section className="content-section">
        <h2>Note allenamento</h2>
        <textarea value={session.generalNotes ?? ''} onChange={(event) => persistSession({ generalNotes: event.target.value })} rows={4} />
        <VoiceRecorder sessionId={session.id} onSaved={refresh} />
      </section>

      <section className="content-section takeaway-section">
        <h2>Da riprendere</h2>
        <textarea value={session.takeaways ?? ''} onChange={(event) => persistSession({ takeaways: event.target.value })} placeholder="Ampiezza lato debole&#10;Copertura dopo pressione&#10;Scelta dopo recupero" rows={4} />
      </section>

      {flash && <p className="save-flash compact-flash">{flash}</p>}

      <div className="action-row">
        <button type="button" onClick={completeSession}><Check size={20} />Completa allenamento</button>
        <button type="button" className="danger" onClick={deleteSession}><Trash2 size={20} />Elimina</button>
      </div>
      <Link to="/training" className="subtle-link">Torna agli allenamenti</Link>

      {attendanceOpen && (
        <AttendanceSheet
          sessionId={session.id}
          players={players}
          attendance={attendance}
          onChanged={refresh}
          onClose={() => setAttendanceOpen(false)}
        />
      )}
      {selectedPhase && <TrainingPhaseSheet sessionId={session.id} phase={selectedPhase} onChanged={refresh} onClose={() => setSelectedPhase(undefined)} />}
      {selectedEvaluation && (
        <TrainingPlayerEvaluationSheet
          sessionId={session.id}
          player={players.find((player) => player.id === selectedEvaluation.playerId)!}
          evaluation={selectedEvaluation}
          onChanged={refresh}
          onClose={() => setSelectedEvaluation(undefined)}
        />
      )}
    </section>
  )
}
