import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { updateTrainingSessionPhase } from '../db/sessionsRepository'
import type { PlayerRating, TrainingPhaseStatus, TrainingSessionPhase } from '../types/domain'
import { PlayerStarRating } from './PlayerStarRating'

type Props = {
  sessionId: string
  phase: TrainingSessionPhase
  onChanged: () => void
  onClose: () => void
}

const statusOptions: Array<{ id: TrainingPhaseStatus; label: string }> = [
  { id: 'completed', label: 'Fatto' },
  { id: 'modified', label: 'Modificato' },
  { id: 'skipped', label: 'Saltato' },
]

function BulletList({ title, items }: { title: string; items?: string[] }) {
  if (!items?.length) return null
  return (
    <section className="mini-section">
      <h3>{title}</h3>
      <ul className="plain-list">
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </section>
  )
}

export function TrainingPhaseSheet({ sessionId, phase, onChanged, onClose }: Props) {
  const phaseKey = useMemo(() => JSON.stringify(phase), [phase])
  const [draft, setDraft] = useState(phase)
  const [flash, setFlash] = useState('')

  useEffect(() => {
    window.setTimeout(() => setDraft(phase), 0)
  }, [phase, phaseKey])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const persist = async (patch: Partial<TrainingSessionPhase>) => {
    const next = { ...draft, ...patch }
    setDraft(next)
    setFlash('Salvato ✓')
    window.setTimeout(() => setFlash(''), 900)
    await updateTrainingSessionPhase(sessionId, phase.id, patch)
    onChanged()
  }

  return (
    <div className="sheet-backdrop" role="presentation" onClick={onClose}>
      <section className="training-phase-sheet" role="dialog" aria-modal="true" aria-labelledby="training-phase-title" onClick={(event) => event.stopPropagation()}>
        <div className="sheet-handle" />
        <header className="exercise-sheet-header">
          <div>
            <span className="eyebrow">Fase {phase.order} · {phase.plannedDurationMinutes ?? 0} min previsti</span>
            <h1 id="training-phase-title">{phase.title}</h1>
            {phase.exerciseSnapshot?.focus && <p>{phase.exerciseSnapshot.focus}</p>}
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Chiudi fase">
            <X size={26} />
          </button>
        </header>

        <div className="add-player-scroll">
          {phase.exerciseSnapshot && (
            <section className="content-section player-profile-section">
              <h2>{phase.exerciseSnapshot.title}</h2>
              {phase.exerciseSnapshot.format && <p>{phase.exerciseSnapshot.format}</p>}
              {phase.exerciseSnapshot.dimensions && <p className="muted-copy">{phase.exerciseSnapshot.dimensions}</p>}
              <BulletList title="Setup" items={phase.exerciseSnapshot.setup} />
              <BulletList title="Regole" items={phase.exerciseSnapshot.rules} />
              <BulletList title="Domande coach" items={phase.exerciseSnapshot.coachQuestions} />
            </section>
          )}

          <section className="content-section player-profile-section">
            <h2>Come e andata?</h2>
            <PlayerStarRating value={draft.coachRating ?? null} onChange={(rating: PlayerRating) => persist({ coachRating: rating })} />
          </section>

          <section className="form-field">
            <span>Stato fase</span>
            <div className="segmented-grid three">
              {statusOptions.map((item) => (
                <button key={item.id} type="button" className={draft.status === item.id ? 'selected' : ''} aria-pressed={draft.status === item.id} onClick={() => persist({ status: item.id })}>
                  {item.label}
                </button>
              ))}
            </div>
          </section>

          <label className="form-field">
            <span>Durata reale</span>
            <input type="number" min="0" inputMode="numeric" value={draft.actualDurationMinutes ?? ''} onChange={(event) => persist({ actualDurationMinutes: event.target.value === '' ? undefined : Number(event.target.value) })} />
          </label>

          <label className="form-field">
            <span>Nota staff</span>
            <textarea value={draft.coachNotes ?? ''} onChange={(event) => persist({ coachNotes: event.target.value })} rows={4} />
          </label>

          <label className="form-field">
            <span>Variante usata</span>
            <input value={draft.variationUsed ?? ''} onChange={(event) => persist({ variationUsed: event.target.value })} />
          </label>
          {flash && <p className="save-flash compact-flash">{flash}</p>}
        </div>

        <footer className="sheet-footer">
          <button type="button" className="primary-action" onClick={onClose}>Chiudi fase</button>
        </footer>
      </section>
    </div>
  )
}
