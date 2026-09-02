import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, CircleStop, Pause, Play, TimerReset } from 'lucide-react'
import { AttendanceSheet } from '../components/AttendanceSheet'
import { getAppState, saveAppState } from '../db/appStateRepository'
import { ensureAttendanceForSession, getAttendanceBySession } from '../db/attendanceRepository'
import { getPlayers } from '../db/playersRepository'
import { getCurrentSession } from '../db/sessionsRepository'
import type { AppState, Attendance, FieldExercise, Player, SessionPhase, TrainingSession } from '../types/domain'
import { formatSeconds } from '../utils/format'
import { VoiceRecorder } from '../components/VoiceRecorder'
import { ExerciseDetailModal } from '../components/ExerciseDetailModal'
import { AdaptationSheet } from '../components/AdaptationSheet'
import { getPhaseAdaptation, type PhaseAdaptation } from '../utils/adaptation'
import { legacySessionToPlannedPhases } from '../utils/training'

function elapsedFromState(state?: AppState) {
  if (!state) return 0
  const base = state.timer.elapsedBeforeSeconds
  if (state.timer.status !== 'running' || !state.timer.startedAt) return base
  return base + Math.floor((Date.now() - new Date(state.timer.startedAt).getTime()) / 1000)
}

function ExerciseCard({ exercise, onOpen }: { exercise: FieldExercise; onOpen: () => void }) {
  return (
    <button type="button" className="exercise-card" onClick={onOpen}>
      <span>Campo {exercise.field}</span>
      <strong>{exercise.format}</strong>
      <em>{exercise.focus}</em>
      <small>
        {exercise.durationMinutes ? `${exercise.durationMinutes} min` : '8-10 min'}
        {exercise.players ? ` · ${exercise.players} giocatori` : ''}
      </small>
      <b>Tocca per dettagli</b>
    </button>
  )
}

function PhaseDetails({ phase, onOpenExercise }: { phase: SessionPhase; onOpenExercise: (exercise: FieldExercise) => void }) {
  return (
    <div className="phase-details">
      {phase.description && <BulletBlock items={phase.description} />}
      {phase.sequence && <NumberBlock items={phase.sequence} />}
      {phase.objective && <p className="objective">{phase.objective}</p>}
      {phase.fields && (
        <div className="exercise-card-grid">
          {phase.fields.map((field) => <ExerciseCard key={field.id} exercise={field} onOpen={() => onOpenExercise(field)} />)}
        </div>
      )}
      {phase.sections?.map((section) => <MiniSection key={section.title} title={section.title} items={section.items} />)}
      {phase.questions && <MiniSection title="Domande" items={phase.questions} />}
      {phase.observe && <MiniSection title="Osservare" items={phase.observe} />}
    </div>
  )
}

function BulletBlock({ items }: { items: string[] }) {
  return (
    <ul className="plain-list">
      {items.map((item) => <li key={item}>{item}</li>)}
    </ul>
  )
}

function NumberBlock({ items }: { items: string[] }) {
  return (
    <ol className="plain-list">
      {items.map((item) => <li key={item}>{item}</li>)}
    </ol>
  )
}

function MiniSection({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="mini-section">
      <h3>{title}</h3>
      <BulletBlock items={items} />
    </section>
  )
}

function AdaptationCard({ adaptation, onOpen }: { adaptation?: PhaseAdaptation; onOpen: () => void }) {
  if (!adaptation) return null

  return (
    <section className="adaptation-card">
      <div>
        <span className="eyebrow">Adattamento ai presenti</span>
        <strong>{adaptation.presentCount} presenti</strong>
      </div>
      <div className="adaptation-preview">
        {adaptation.fields.slice(0, 3).map((field) => (
          <span key={field.label}>{field.label} <b>{field.format}</b></span>
        ))}
      </div>
      <button type="button" onClick={onOpen}>Vedi dettagli</button>
    </section>
  )
}

export function TodayPage() {
  const [session, setSession] = useState<TrainingSession | undefined>()
  const [state, setState] = useState<AppState | undefined>()
  const [elapsed, setElapsed] = useState(0)
  const [selectedExercise, setSelectedExercise] = useState<FieldExercise | undefined>()
  const [players, setPlayers] = useState<Player[]>([])
  const [attendance, setAttendance] = useState<Attendance[]>([])
  const [attendanceOpen, setAttendanceOpen] = useState(false)
  const [adaptationOpen, setAdaptationOpen] = useState(false)

  useEffect(() => {
    Promise.all([getCurrentSession(), getAppState(), getPlayers()]).then(async ([loadedSession, loadedState, loadedPlayers]) => {
      if (loadedSession) {
        const loadedAttendance = await ensureAttendanceForSession(loadedSession.id, loadedPlayers)
        setAttendance(loadedAttendance)
      }
      setSession(loadedSession)
      setState(loadedState)
      setPlayers(loadedPlayers)
      setElapsed(elapsedFromState(loadedState))
    })
  }, [])

  useEffect(() => {
    const id = window.setInterval(() => setElapsed(elapsedFromState(state)), 1000)
    return () => window.clearInterval(id)
  }, [state])

  const v3Phases = useMemo(() => session ? legacySessionToPlannedPhases(session) : [], [session])
  const displayPhases = useMemo<SessionPhase[]>(() => {
    if (!session) return []
    if (session.phases.length > 0) return session.phases
    return v3Phases.map((item, index) => ({
      id: item.id,
      title: item.title,
      startMinute: v3Phases.slice(0, index).reduce((sum, phaseItem) => sum + (phaseItem.plannedDurationMinutes ?? 0), 0),
      endMinute: v3Phases.slice(0, index + 1).reduce((sum, phaseItem) => sum + (phaseItem.plannedDurationMinutes ?? 0), 0),
      description: item.coachNotes ? [item.coachNotes] : undefined,
      objective: item.exerciseSnapshot?.focus,
    }))
  }, [session, v3Phases])
  const phase = useMemo(
    () => displayPhases.find((item) => item.id === state?.currentPhaseId) ?? displayPhases[0],
    [displayPhases, state?.currentPhaseId],
  )

  if (!session || !state || !phase) return null

  const phaseIndex = displayPhases.findIndex((item) => item.id === phase.id)
  const plannedSeconds = (phase.endMinute - phase.startMinute) * 60
  const remaining = Math.max(0, plannedSeconds - elapsed)
  const presentCount = attendance.filter((item) => item.present).length
  const adaptation = getPhaseAdaptation(phase.id, presentCount)

  const refreshPlayersAndAttendance = async () => {
    const loadedPlayers = await getPlayers()
    const loadedAttendance = await getAttendanceBySession(session.id)
    setPlayers(loadedPlayers)
    setAttendance(loadedAttendance)
  }

  const persist = async (next: AppState) => {
    setState(next)
    setElapsed(elapsedFromState(next))
    await saveAppState(next)
  }

  const startPhase = () => persist({
    ...state,
    currentPhaseId: phase.id,
    timer: { phaseId: phase.id, status: 'running', startedAt: new Date().toISOString(), elapsedBeforeSeconds: elapsed },
  })

  const pausePhase = () => persist({
    ...state,
    timer: { phaseId: phase.id, status: 'paused', elapsedBeforeSeconds: elapsed },
  })

  const finishPhase = () => persist({
    ...state,
    timer: { phaseId: phase.id, status: 'finished', elapsedBeforeSeconds: elapsed },
  })

  const nextPhase = () => {
    const next = displayPhases[Math.min(phaseIndex + 1, displayPhases.length - 1)]
    persist({
      ...state,
      currentPhaseId: next.id,
      timer: { phaseId: next.id, status: 'idle', elapsedBeforeSeconds: 0 },
    })
  }

  const jumpToPhase = (nextPhaseId: string) => {
    persist({
      ...state,
      currentPhaseId: nextPhaseId,
      timer: { phaseId: nextPhaseId, status: 'idle', elapsedBeforeSeconds: 0 },
    })
  }

  return (
    <section className="page">
      <header className="page-header">
        <span className="eyebrow">Seduta corrente</span>
        <h1>{session.title}</h1>
        <p>{session.durationMinutes} minuti</p>
      </header>
      <Link to="/training" className="subtle-link training-entry">Allenamenti, template e storico</Link>

      <article className="current-phase">
        <div className="phase-topline">
          <span>Fase {phaseIndex + 1}</span>
          <strong>{phase.startMinute}'-{phase.endMinute}'</strong>
        </div>
        <h2>{phase.title}</h2>
        <div className="timer-grid">
          <div>
            <span>Timer</span>
            <strong>{formatSeconds(elapsed)}</strong>
          </div>
          <div>
            <span>Restano</span>
            <strong>{formatSeconds(remaining)}</strong>
          </div>
        </div>
        <div className="action-row">
          {state.timer.status === 'running' ? (
            <button type="button" onClick={pausePhase}><Pause size={20} />Pausa</button>
          ) : (
            <button type="button" onClick={startPhase}><Play size={20} />Avvia fase</button>
          )}
          <button type="button" onClick={finishPhase}><CircleStop size={20} />Fine</button>
          <button type="button" onClick={nextPhase}><ChevronRight size={20} />Succ.</button>
          <button type="button" onClick={() => jumpToPhase(phase.id)}><TimerReset size={20} />Reset</button>
        </div>
      </article>

      <section className="attendance-summary">
        <div>
          <span className="eyebrow">Presenti</span>
          <strong>{presentCount} / {players.length}</strong>
        </div>
        <button type="button" onClick={() => setAttendanceOpen(true)}>Gestisci presenze</button>
      </section>

      <VoiceRecorder sessionId={session.id} phaseId={phase.id} />

      <div className="phase-strip" aria-label="Vai alla fase">
        {displayPhases.map((item, index) => (
          <button
            key={item.id}
            type="button"
            className={item.id === phase.id ? 'active' : ''}
            onClick={() => jumpToPhase(item.id)}
          >
            F{index + 1}
          </button>
        ))}
      </div>

      <AdaptationCard adaptation={adaptation} onOpen={() => setAdaptationOpen(true)} />

      <PhaseDetails phase={phase} onOpenExercise={setSelectedExercise} />
      {selectedExercise && (
        <ExerciseDetailModal
          exercise={selectedExercise}
          sessionId={session.id}
          phaseId={phase.id}
          onClose={() => setSelectedExercise(undefined)}
        />
      )}
      {attendanceOpen && (
        <AttendanceSheet
          sessionId={session.id}
          players={players}
          attendance={attendance}
          onChanged={refreshPlayersAndAttendance}
          onClose={() => setAttendanceOpen(false)}
        />
      )}
      {adaptationOpen && adaptation && (
        <AdaptationSheet adaptation={adaptation} onClose={() => setAdaptationOpen(false)} />
      )}
    </section>
  )
}
