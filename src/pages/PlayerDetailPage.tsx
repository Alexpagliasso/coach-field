import { PermissionAction } from '../components/PermissionAction'
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Link } from '../groups/navigation'
import { Goal, HeartHandshake, MessageCircle, Plus, Shield, Sparkles, TriangleAlert } from 'lucide-react'
import { getAppState } from '../db/appStateRepository'
import { getAttendanceByPlayer } from '../db/attendanceRepository'
import { getMatchPlayerEvaluationsByPlayer } from '../db/matchPlayerEvaluationsRepository'
import { getMatchById } from '../db/matchesRepository'
import { addObservation, getObservationsByPlayer } from '../db/observationsRepository'
import { addPlayerObjectiveEvidence, getEvidenceByObjective, getPlayerDevelopmentReviews, getPlayerObjectiveEvidence, getPlayerObjectives, setPlayerObjectiveStatus } from '../db/playerDevelopmentRepository'
import { getPlayer, promotePlayerToRoster, toggleGoalkeeperCandidate, updatePlayerIdealRoles, updatePlayerRating } from '../db/playersRepository'
import { getCurrentSession, getTrainingSessionById } from '../db/sessionsRepository'
import { getTrainingPlayerEvaluationsByPlayer } from '../db/trainingPlayerEvaluationsRepository'
import { getVoiceNotesByPlayer } from '../db/voiceNotesRepository'
import type { AppState, Attendance, LegacyObservationCategory, Match, MatchPlayerEvaluation, Observation, Player, PlayerDevelopmentReview, PlayerObjective, PlayerObjectiveEvidence, PlayerObjectiveEvidenceOutcome, PlayerRating, PlayerRole, TrainingPlayerEvaluation, TrainingSession, VoiceNote } from '../types/domain'
import { VoiceRecorder } from '../components/VoiceRecorder'
import { formatDateTime } from '../utils/format'
import { CompactStarRating, PlayerStarRating } from '../components/PlayerStarRating'
import { formatMatchDate, formatMatchMeta } from '../utils/match'
import { formatPlayerYear, roleOptions } from '../utils/player'
import { sessionDateLabel } from '../utils/training'
import { PlayerObjectiveSheet } from '../components/PlayerObjectiveSheet'
import { PlayerReviewSheet } from '../components/PlayerReviewSheet'
import { buildDevelopmentStats, buildDevelopmentTimeline, buildRoleHistory } from '../utils/playerDevelopment'

const actions: Array<{ label: string; category: LegacyObservationCategory; icon: typeof Sparkles }> = [
  { label: 'Tecnica', category: 'technique', icon: Sparkles },
  { label: 'Gioco', category: 'game', icon: Goal },
  { label: 'Atteggiamento', category: 'attitude', icon: TriangleAlert },
  { label: 'Relazione', category: 'relationship', icon: HeartHandshake },
  { label: 'Portiere', category: 'goalkeeper', icon: Shield },
]

const categoryLabels: Record<LegacyObservationCategory, string> = {
  technique: 'Tecnica',
  game: 'Gioco',
  attitude: 'Atteggiamento',
  relationship: 'Relazione',
  goalkeeper: 'Portiere',
}

const goalkeeperTags = ['Non ha paura', 'Buone mani', 'Riflessi', 'Posizione', 'Uscite', 'Da rivedere', 'Disponibile sabato']
type PlayerMatchHistoryItem = {
  evaluation: MatchPlayerEvaluation
  match: Match
}

type PlayerTrainingHistoryItem = {
  evaluation: TrainingPlayerEvaluation
  session: TrainingSession
}

type ProfileTab = 'overview' | 'timeline' | 'objectives' | 'history'

export function PlayerDetailPage() {
  const { id } = useParams()
  const [player, setPlayer] = useState<Player>()
  const [observations, setObservations] = useState<Observation[]>([])
  const [voiceNotes, setVoiceNotes] = useState<VoiceNote[]>([])
  const [session, setSession] = useState<TrainingSession>()
  const [appState, setAppState] = useState<AppState>()
  const [matchHistory, setMatchHistory] = useState<PlayerMatchHistoryItem[]>([])
  const [trainingHistory, setTrainingHistory] = useState<PlayerTrainingHistoryItem[]>([])
  const [playerAttendance, setPlayerAttendance] = useState<Attendance[]>([])
  const [objectives, setObjectives] = useState<PlayerObjective[]>([])
  const [evidence, setEvidence] = useState<PlayerObjectiveEvidence[]>([])
  const [reviews, setReviews] = useState<PlayerDevelopmentReview[]>([])
  const [objectiveEvidence, setObjectiveEvidence] = useState<Record<string, PlayerObjectiveEvidence[]>>({})
  const [tab, setTab] = useState<ProfileTab>('overview')
  const [objectiveOpen, setObjectiveOpen] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [timelineFilter, setTimelineFilter] = useState<'all' | 'match' | 'training' | 'objective' | 'review'>('all')
  const [note, setNote] = useState('')
  const [savedFlash, setSavedFlash] = useState('')

  const phaseId = appState?.currentPhaseId
  const currentPhase = useMemo(() => session?.phases.find((phase) => phase.id === phaseId), [phaseId, session])

  const refresh = async () => {
    if (!id) return
    const [loadedPlayer, loadedObservations, loadedNotes, loadedSession, loadedState, loadedEvaluations, trainingEvaluations, attendanceRows, loadedObjectives, loadedEvidence, loadedReviews] = await Promise.all([
      getPlayer(id),
      getObservationsByPlayer(id),
      getVoiceNotesByPlayer(id),
      getCurrentSession(),
      getAppState(),
      getMatchPlayerEvaluationsByPlayer(id),
      getTrainingPlayerEvaluationsByPlayer(id),
      getAttendanceByPlayer(id),
      getPlayerObjectives(id),
      getPlayerObjectiveEvidence(id),
      getPlayerDevelopmentReviews(id),
    ])
    const loadedMatches = await Promise.all(loadedEvaluations.map((evaluation) => getMatchById(evaluation.matchId)))
    const loadedTrainingSessions = await Promise.all(trainingEvaluations.map((evaluation) => getTrainingSessionById(evaluation.sessionId)))
    setPlayer(loadedPlayer)
    setObservations(loadedObservations)
    setVoiceNotes(loadedNotes)
    setSession(loadedSession)
    setAppState(loadedState)
    setMatchHistory(loadedEvaluations
      .map((evaluation, index) => {
        const match = loadedMatches[index]
        return match ? { evaluation, match } : undefined
      })
      .filter((item): item is PlayerMatchHistoryItem => Boolean(item)))
    setTrainingHistory(trainingEvaluations
      .map((evaluation, index) => {
        const trainingSession = loadedTrainingSessions[index]
        return trainingSession ? { evaluation, session: trainingSession } : undefined
      })
      .filter((item): item is PlayerTrainingHistoryItem => Boolean(item)))
    setPlayerAttendance(attendanceRows)
    setObjectives(loadedObjectives)
    setEvidence(loadedEvidence)
    setReviews(loadedReviews)
    const pairs = await Promise.all(loadedObjectives.map(async (objective) => [objective.id, await getEvidenceByObjective(objective.id)] as const))
    setObjectiveEvidence(Object.fromEntries(pairs))
  }

  useEffect(() => {
    if (!id) return
    let cancelled = false
    Promise.all([
      getPlayer(id),
      getObservationsByPlayer(id),
      getVoiceNotesByPlayer(id),
      getCurrentSession(),
      getAppState(),
      getMatchPlayerEvaluationsByPlayer(id),
      getTrainingPlayerEvaluationsByPlayer(id),
      getAttendanceByPlayer(id),
      getPlayerObjectives(id),
      getPlayerObjectiveEvidence(id),
      getPlayerDevelopmentReviews(id),
    ]).then(async ([loadedPlayer, loadedObservations, loadedNotes, loadedSession, loadedState, loadedEvaluations, trainingEvaluations, attendanceRows, loadedObjectives, loadedEvidence, loadedReviews]) => {
      const loadedMatches = await Promise.all(loadedEvaluations.map((evaluation) => getMatchById(evaluation.matchId)))
      const loadedTrainingSessions = await Promise.all(trainingEvaluations.map((evaluation) => getTrainingSessionById(evaluation.sessionId)))
      const pairs = await Promise.all(loadedObjectives.map(async (objective) => [objective.id, await getEvidenceByObjective(objective.id)] as const))
      if (cancelled) return
      setPlayer(loadedPlayer)
      setObservations(loadedObservations)
      setVoiceNotes(loadedNotes)
      setSession(loadedSession)
      setAppState(loadedState)
      setMatchHistory(loadedEvaluations
        .map((evaluation, index) => {
          const match = loadedMatches[index]
          return match ? { evaluation, match } : undefined
        })
        .filter((item): item is PlayerMatchHistoryItem => Boolean(item)))
      setTrainingHistory(trainingEvaluations
        .map((evaluation, index) => {
          const trainingSession = loadedTrainingSessions[index]
          return trainingSession ? { evaluation, session: trainingSession } : undefined
        })
        .filter((item): item is PlayerTrainingHistoryItem => Boolean(item)))
      setPlayerAttendance(attendanceRows)
      setObjectives(loadedObjectives)
      setEvidence(loadedEvidence)
      setReviews(loadedReviews)
      setObjectiveEvidence(Object.fromEntries(pairs))
    })
    return () => {
      cancelled = true
    }
  }, [id])

  if (!player) return <p className="page">Giocatore non disponibile.</p>

  const quickAdd = async (category: LegacyObservationCategory, value: 'positive' | 'attention' = 'positive', text?: string) => {
    await addObservation({
      playerId: player.id,
      sessionId: session?.id ?? 'general',
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

  const ratedMatchEvaluations = matchHistory
    .map((item) => item.evaluation)
    .filter((evaluation) => evaluation.rating !== null)
  const matchAverage = ratedMatchEvaluations.length > 0
    ? ratedMatchEvaluations.reduce((sum, evaluation) => sum + (evaluation.rating ?? 0), 0) / ratedMatchEvaluations.length
    : undefined
  const ratedTrainingEvaluations = trainingHistory
    .map((item) => item.evaluation)
    .filter((evaluation) => evaluation.rating !== null)
  const trainingAverage = ratedTrainingEvaluations.length > 0
    ? ratedTrainingEvaluations.reduce((sum, evaluation) => sum + (evaluation.rating ?? 0), 0) / ratedTrainingEvaluations.length
    : undefined
  const presentAttendance = playerAttendance.filter((item) => item.present).length
  const attendancePercent = playerAttendance.length > 0 ? Math.round((presentAttendance / playerAttendance.length) * 100) : undefined
  const stats = buildDevelopmentStats({
    matchEvaluations: matchHistory.map((item) => item.evaluation),
    trainingEvaluations: trainingHistory.map((item) => item.evaluation),
    attendance: playerAttendance,
    objectives,
    reviews,
  })
  const roleHistory = buildRoleHistory(matchHistory.map((item) => item.evaluation), trainingHistory.map((item) => item.evaluation), reviews)
  const timeline = buildDevelopmentTimeline({
    matches: matchHistory,
    trainings: trainingHistory,
    observations,
    objectives,
    evidence,
    reviews,
    voiceNotes,
  })
  const filteredTimeline = timeline.filter((item) => timelineFilter === 'all' || item.kind === timelineFilter)
  const latestReview = reviews[0]
  const activeObjectives = objectives.filter((objective) => objective.status === 'active')
  const achievedObjectives = objectives.filter((objective) => objective.status === 'achieved')
  const archivedObjectives = objectives.filter((objective) => objective.status === 'archived' || objective.status === 'paused')

  const quickEvidence = async (objective: PlayerObjective, outcome: PlayerObjectiveEvidenceOutcome) => {
    await addPlayerObjectiveEvidence({ objectiveId: objective.id, playerId: player.id, outcome })
    refresh()
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
          <PermissionAction permission="players.edit"><button type="button" className="primary-action" onClick={addToRoster}>Aggiungi alla rosa</button></PermissionAction>
        </section>
      )}

      <section className="content-section player-profile-section">
        <h2>Valutazione generale</h2>
        <PermissionAction permission="players.edit"><PlayerStarRating value={player.rating} onChange={saveRating} /></PermissionAction>
        {player.rating !== null && (
          <PermissionAction permission="players.edit"><button type="button" className="subtle-button" onClick={() => saveRating(null)}>
            Rimuovi valutazione
          </button></PermissionAction>
        )}
      </section>

      <section className="content-section player-profile-section">
        <h2>Ruolo ideale</h2>
        <div className="ideal-role-grid">
          {roleOptions.map((role) => {
            const selected = (player.idealRoles ?? []).includes(role.id)
            return (
              <PermissionAction permission="players.edit" key={role.id}><button key={role.id} type="button" aria-pressed={selected} className={selected ? 'selected' : ''} onClick={() => toggleIdealRole(role.id)}>
                {role.id}
              </button></PermissionAction>
            )
          })}
        </div>
        <p className="role-help">{roleOptions.map((role) => `${role.id} = ${role.label}`).join(' · ')}</p>
      </section>

      {savedFlash && <p className="save-flash">{savedFlash}</p>}

      <div className="filter-pills profile-tabs" aria-label="Sezioni profilo">
        {[
          { id: 'overview', label: 'Panoramica' },
          { id: 'timeline', label: 'Timeline' },
          { id: 'objectives', label: 'Obiettivi' },
          { id: 'history', label: 'Storico' },
        ].map((item) => (
          <button key={item.id} type="button" className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id as ProfileTab)}>
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <>
          <section className="content-section player-profile-section">
            <div className="section-header-row">
              <h2>Progressione</h2>
              <PermissionAction permission="development.edit"><button type="button" onClick={() => setReviewOpen(true)}>Crea review</button></PermissionAction>
            </div>
            <div className="data-count-grid">
              <span><strong>{stats.lastFiveMatchAverage === undefined ? '—' : stats.lastFiveMatchAverage.toFixed(1).replace('.', ',')}</strong> ultime 5 partite</span>
              <span><strong>{stats.lastFiveTrainingAverage === undefined ? '—' : stats.lastFiveTrainingAverage.toFixed(1).replace('.', ',')}</strong> ultimi 5 allenamenti</span>
              <span><strong>{stats.present} / {stats.attendanceTotal}</strong> presenze</span>
              <span><strong>{stats.activeObjectives}</strong> obiettivi attivi</span>
              <span><strong>{stats.achievedObjectives}</strong> raggiunti</span>
              <span><strong>{stats.latestReview ? sessionDateLabel(stats.latestReview.date) : '—'}</strong> ultima review</span>
            </div>
          </section>

          <section className="content-section player-profile-section">
            <div className="section-header-row">
              <h2>Stato attuale</h2>
              <span>{latestReview ? `Review ${sessionDateLabel(latestReview.date)}` : 'Nessuna review'}</span>
            </div>
            {latestReview ? (
              <div className="development-current">
                <div><strong>Punti di forza</strong>{latestReview.strengths.map((item) => <span key={item}>{item}</span>)}</div>
                <div><strong>Da sviluppare</strong>{latestReview.developmentAreas.map((item) => <span key={item}>{item}</span>)}</div>
              </div>
            ) : (
              <p className="empty-state">Nessuna review ancora.</p>
            )}
          </section>

          <section className="content-section player-profile-section">
            <div className="section-header-row">
              <h2>Obiettivi attivi</h2>
              <PermissionAction permission="development.edit"><button type="button" onClick={() => setObjectiveOpen(true)}>+ Nuovo obiettivo</button></PermissionAction>
            </div>
            <PermissionAction permission="development.edit"><ObjectiveList objectives={activeObjectives.slice(0, 3)} evidenceByObjective={objectiveEvidence} onEvidence={quickEvidence} onStatus={async (objective, status) => { await setPlayerObjectiveStatus(objective.id, status); refresh() }} /></PermissionAction>
            {activeObjectives.length === 0 && <p className="empty-state">Nessun obiettivo attivo. Definisci un comportamento concreto su cui lavorare.</p>}
          </section>
        </>
      )}

      {tab === 'history' && <section className="content-section player-profile-section">
        <div className="section-header-row">
          <h2>Partite</h2>
          <span>{matchHistory.length} presenze</span>
        </div>
        <div className="data-count-grid">
          <span><strong>{matchAverage === undefined ? '—' : matchAverage.toFixed(1).replace('.', ',')}</strong> media partite</span>
          <span><strong>{ratedMatchEvaluations.length}</strong> valutazioni</span>
        </div>
        <div className="list-stack">
          {matchHistory.slice(0, 5).map(({ evaluation, match }) => (
            <Link key={evaluation.id} to={`/matches/${match.id}`} className="list-card match-history-card">
              <div>
                <strong>{match.opponent}</strong>
                <span>{formatMatchDate(match.date)} · {formatMatchMeta(match)}</span>
                <small>{evaluation.rolesPlayed.length > 0 ? evaluation.rolesPlayed.join(' · ') : 'Ruoli partita da completare'}</small>
                {evaluation.note && <small>{evaluation.note}</small>}
              </div>
              <CompactStarRating value={evaluation.rating} />
            </Link>
          ))}
          {matchHistory.length === 0 && <p className="empty-state">Ancora nessuna partita collegata a questo giocatore.</p>}
        </div>
      </section>}

      {tab === 'history' && <section className="content-section player-profile-section">
        <div className="section-header-row">
          <h2>Allenamenti</h2>
          <span>{trainingHistory.length} valutazioni</span>
        </div>
        <div className="data-count-grid">
          <span><strong>{trainingAverage === undefined ? '—' : trainingAverage.toFixed(1).replace('.', ',')}</strong> media allenamenti</span>
          <span><strong>{presentAttendance} / {playerAttendance.length}</strong> presenze</span>
          <span><strong>{attendancePercent === undefined ? '—' : `${attendancePercent}%`}</strong> presenza</span>
          <span><strong>{ratedTrainingEvaluations.length}</strong> rating</span>
        </div>
        <div className="list-stack">
          {trainingHistory.slice(0, 5).map(({ evaluation, session: trainingSession }) => (
            <Link key={evaluation.id} to={`/training/${trainingSession.id}`} className="list-card match-history-card">
              <div>
                <strong>{trainingSession.title}</strong>
                <span>{sessionDateLabel(trainingSession.date)} · {trainingSession.durationMinutes} min</span>
                <small>{evaluation.rolesTried.length > 0 ? evaluation.rolesTried.join(' · ') : 'Ruoli da completare'}</small>
                {evaluation.note && <small>{evaluation.note}</small>}
              </div>
              <CompactStarRating value={evaluation.rating} />
            </Link>
          ))}
          {trainingHistory.length === 0 && <p className="empty-state">Nessuna valutazione allenamento.</p>}
        </div>
      </section>}

      {tab === 'history' && (
        <section className="content-section player-profile-section">
          <h2>Ruoli nel tempo</h2>
          <div className="data-count-grid">
            <span><strong>{roleHistory[0]?.role ?? '—'}</strong> piu utilizzato</span>
            <span><strong>{roleHistory[1]?.role ?? '—'}</strong> in esplorazione</span>
          </div>
          <div className="list-stack">
            {roleHistory.map((item) => (
              <article key={item.role} className="list-card">
                <div>
                  <strong>{item.role}</strong>
                  <span>{item.matches} partite · {item.trainings} allenamenti · {item.reviews} review</span>
                </div>
              </article>
            ))}
            {roleHistory.length === 0 && <p className="empty-state">Nessun ruolo storico ancora.</p>}
          </div>
        </section>
      )}

      {tab === 'objectives' && (
        <section className="content-section player-profile-section">
          <div className="section-header-row">
            <h2>Obiettivi</h2>
            <PermissionAction permission="development.edit"><button type="button" onClick={() => setObjectiveOpen(true)}>+ Nuovo obiettivo</button></PermissionAction>
          </div>
          <h3>Attivi</h3>
          <PermissionAction permission="development.edit"><ObjectiveList objectives={activeObjectives} evidenceByObjective={objectiveEvidence} onEvidence={quickEvidence} onStatus={async (objective, status) => { await setPlayerObjectiveStatus(objective.id, status); refresh() }} /></PermissionAction>
          {activeObjectives.length === 0 && <p className="empty-state">Nessun obiettivo attivo. Definisci un comportamento concreto su cui lavorare.</p>}
          <h3>Raggiunti</h3>
          <PermissionAction permission="development.edit"><ObjectiveList objectives={achievedObjectives} evidenceByObjective={objectiveEvidence} onEvidence={quickEvidence} onStatus={async (objective, status) => { await setPlayerObjectiveStatus(objective.id, status); refresh() }} /></PermissionAction>
          <h3>Archiviati / pausa</h3>
          <PermissionAction permission="development.edit"><ObjectiveList objectives={archivedObjectives} evidenceByObjective={objectiveEvidence} onEvidence={quickEvidence} onStatus={async (objective, status) => { await setPlayerObjectiveStatus(objective.id, status); refresh() }} /></PermissionAction>
        </section>
      )}

      {tab === 'timeline' && (
        <section className="content-section player-profile-section">
          <h2>Timeline</h2>
          <div className="filter-pills" aria-label="Filtra timeline">
            {[
              { id: 'all', label: 'Tutto' },
              { id: 'match', label: 'Partite' },
              { id: 'training', label: 'Allenamenti' },
              { id: 'objective', label: 'Obiettivi' },
              { id: 'review', label: 'Review' },
            ].map((item) => (
              <button key={item.id} type="button" className={timelineFilter === item.id ? 'active' : ''} onClick={() => setTimelineFilter(item.id as typeof timelineFilter)}>
                {item.label}
              </button>
            ))}
          </div>
          <div className="list-stack development-timeline">
            {filteredTimeline.map((item) => (
              <article key={item.id} className="list-card">
                <time>{sessionDateLabel(item.date)}</time>
                <div>
                  <strong>{item.title}</strong>
                  {item.subtitle && <span>{item.subtitle}</span>}
                  {item.ratingLabel && <small>{item.ratingLabel}</small>}
                  {item.roles?.length ? <small>{item.roles.join(' · ')}</small> : null}
                  {item.note && <small>{item.note}</small>}
                </div>
              </article>
            ))}
            {filteredTimeline.length === 0 && <p className="empty-state">Nessuna attività registrata.</p>}
          </div>
        </section>
      )}

      {tab === 'overview' && <section className="content-section player-profile-section">
        <h2>Osservazioni rapide</h2>
      </section>}

      {tab === 'overview' && <div className="quick-grid">
        {actions.map(({ label, category, icon: Icon }) => (
          <PermissionAction permission="notes.create" key={category}><button key={category} type="button" className="quick-action" onClick={() => quickAdd(category)}>
            <Icon size={24} />
            {label}
            <small>+ positivo</small>
          </button></PermissionAction>
        ))}
      </div>}

      {tab === 'overview' && <section className="content-section">
        <PermissionAction permission="players.edit"><button type="button" className="primary-action keeper-action" onClick={markInterestingGoalkeeper}>
          <Shield size={24} />
          Interessante in porta
        </button></PermissionAction>
        <div className="tag-grid">
          {goalkeeperTags.map((tag) => (
            <PermissionAction permission="notes.create" key={tag}><button
              key={tag}
              type="button"
              onClick={() => quickAdd('goalkeeper', tag === 'Da rivedere' ? 'attention' : 'positive', tag)}
            >
              {tag}
            </button></PermissionAction>
          ))}
        </div>
      </section>}

      {tab === 'overview' && <div className="note-panel">
        <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Nota testuale rapida" rows={3} />
        <div className="action-row">
          <PermissionAction permission="notes.create"><button type="button" onClick={() => note.trim() && quickAdd('attitude', 'positive', note.trim())}>
            <Plus size={20} />Positiva
          </button></PermissionAction>
          <PermissionAction permission="notes.create"><button type="button" onClick={() => note.trim() && quickAdd('attitude', 'attention', note.trim())}>
            <MessageCircle size={20} />Attenzione
          </button></PermissionAction>
        </div>
      </div>}

      {tab === 'overview' && <PermissionAction permission="notes.create"><VoiceRecorder sessionId={session?.id ?? 'general'} phaseId={phaseId} playerId={player.id} onSaved={refresh} /></PermissionAction>}

      {tab === 'history' && <section className="content-section">
        <h2>Cronologia</h2>
        <div className="list-stack">
          {observations.map((item) => (
            <article key={item.id} className="list-card">
              <div>
                <strong>{item.category && item.category in categoryLabels ? categoryLabels[item.category as LegacyObservationCategory] : item.category ?? 'Osservazione'} · {item.sentiment ?? (item.value === 'positive' ? 'positivo' : 'attenzione')}</strong>
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
      </section>}
      {objectiveOpen && <PermissionAction permission="development.edit"><PlayerObjectiveSheet playerId={player.id} onSaved={refresh} onClose={() => setObjectiveOpen(false)} /></PermissionAction>}
      {reviewOpen && <PermissionAction permission="development.edit"><PlayerReviewSheet player={player} onSaved={refresh} onClose={() => setReviewOpen(false)} /></PermissionAction>}
    </section>
  )
}

function ObjectiveList({
  objectives,
  evidenceByObjective,
  onEvidence,
  onStatus,
}: {
  objectives: PlayerObjective[]
  evidenceByObjective: Record<string, PlayerObjectiveEvidence[]>
  onEvidence: (objective: PlayerObjective, outcome: PlayerObjectiveEvidenceOutcome) => void
  onStatus: (objective: PlayerObjective, status: PlayerObjective['status']) => void
}) {
  if (objectives.length === 0) return null
  return (
    <div className="list-stack">
      {objectives.map((objective) => (
        <article key={objective.id} className="list-card objective-card">
          <div>
            <strong>{objective.title}</strong>
            <span>{objective.category} · priorita {objective.priority}</span>
            {objective.description && <small>{objective.description}</small>}
            {(evidenceByObjective[objective.id] ?? []).slice(0, 3).map((item) => (
              <small key={item.id}>{sessionDateLabel(item.date)} · {item.outcome}{item.note ? ` · ${item.note}` : ''}</small>
            ))}
          </div>
          <div className="vertical-actions">
            <PermissionAction permission="development.edit"><button type="button" onClick={() => onEvidence(objective, 'positive')}>✓</button></PermissionAction>
            <PermissionAction permission="development.edit"><button type="button" onClick={() => onEvidence(objective, 'mixed')}>~</button></PermissionAction>
            <PermissionAction permission="development.edit"><button type="button" onClick={() => onEvidence(objective, 'attention')}>!</button></PermissionAction>
            {objective.status === 'active' && <PermissionAction permission="development.edit"><button type="button" onClick={() => onStatus(objective, 'achieved')}>Raggiunto</button></PermissionAction>}
            {objective.status === 'active' && <PermissionAction permission="development.edit"><button type="button" onClick={() => onStatus(objective, 'paused')}>Pausa</button></PermissionAction>}
            {objective.status !== 'archived' && <PermissionAction permission="development.edit"><button type="button" onClick={() => onStatus(objective, 'archived')}>Archivia</button></PermissionAction>}
          </div>
        </article>
      ))}
    </div>
  )
}
