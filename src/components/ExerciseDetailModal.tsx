import { PermissionAction } from '../components/PermissionAction'
import { useEffect } from 'react'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { VoiceRecorder } from './VoiceRecorder'
import type { FieldExercise } from '../types/domain'

type ExerciseDetailModalProps = {
  exercise?: Partial<FieldExercise> | null
  sessionId: string
  phaseId: string
  onClose: () => void
}

function ExerciseSection({ title, children, defaultOpen = false }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  return (
    <details className="exercise-section" open={defaultOpen}>
      <summary>{title}</summary>
      <div className="exercise-section-body">{children}</div>
    </details>
  )
}

type LegacyObserveItem = string | { title?: string; items?: string[] }

function BulletList({ items = [] }: { items?: string[] }) {
  if (!items.length) return null

  return (
    <ul className="plain-list">
      {items.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
    </ul>
  )
}

export function ExerciseDetailModal({ exercise, sessionId, phaseId, onClose }: ExerciseDetailModalProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  if (!exercise) return null

  const title = exercise.title ?? 'Esercizio'
  const format = exercise.format ?? ''
  const focus = exercise.focus ?? ''
  const objective = exercise.objective ?? []
  const specialRule = exercise.specialRule
  const setup = exercise.setup ?? []
  const instructions = exercise.instructions ?? []
  const rules = exercise.rules ?? []
  const rawObserve = (exercise.observe ?? []) as LegacyObserveItem[]
  const observe = rawObserve
    .map((block, index) => (
      typeof block === 'string'
        ? { title: index === 0 ? 'Cosa osservare' : 'Osservare', items: [block] }
        : { title: block.title ?? 'Osservare', items: block.items ?? [] }
    ))
    .filter((block) => block.items.length > 0)
  const coachQuestions = exercise.coachQuestions ?? []
  const positiveSignals = exercise.positiveSignals ?? []
  const attentionSignals = exercise.attentionSignals ?? []
  const hasHowTo = setup.length > 0 || instructions.length > 0 || rules.length > 0
  const hasAnyContent = objective.length > 0 || Boolean(specialRule) || hasHowTo || observe.length > 0 || Boolean(exercise.variation) || coachQuestions.length > 0 || positiveSignals.length > 0 || attentionSignals.length > 0

  return (
    <div className="sheet-backdrop" role="presentation" onClick={onClose}>
      <section
        className="exercise-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="exercise-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sheet-handle" />
        <header className="exercise-sheet-header">
          <div>
            <span className="eyebrow">{exercise.field ? `Campo ${exercise.field}` : title}</span>
            <h1 id="exercise-title">{format || title}</h1>
            {focus && <p>{focus}</p>}
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Chiudi dettagli">
            <X size={26} />
          </button>
        </header>

        <div className="exercise-chips">
          {exercise.durationMinutes && <span>{exercise.durationMinutes} min</span>}
          {exercise.players && <span>{exercise.players} giocatori</span>}
          {exercise.dimensions && <span>{exercise.dimensions}</span>}
          {exercise.equipment?.slice(0, 1).map((item, index) => <span key={`${item}-${index}`}>{item}</span>)}
        </div>

        <div className="exercise-scroll">
          {objective.length > 0 && (
            <ExerciseSection title="Obiettivo" defaultOpen>
              <BulletList items={objective} />
            </ExerciseSection>
          )}

          {specialRule && (
            <section className="special-rule-card">
              <span>Regola attiva</span>
              <strong>{specialRule.title}</strong>
              <p>{specialRule.description}</p>
              {specialRule.why && <small>{specialRule.why}</small>}
            </section>
          )}

          {hasHowTo && (
            <ExerciseSection title="Come si fa" defaultOpen>
              {setup.length > 0 && (
                <>
                  <h3>Come preparare il campo</h3>
                  <BulletList items={setup} />
                </>
              )}
              {instructions.length > 0 && (
                <>
                  <h3>Cosa devono fare i ragazzi</h3>
                  <BulletList items={instructions} />
                </>
              )}
              {rules.length > 0 && (
              <>
                <h3>Regole</h3>
                <BulletList items={rules} />
              </>
              )}
            </ExerciseSection>
          )}

          {observe.length > 0 && (
            <ExerciseSection title="Cosa osservo" defaultOpen>
              {observe.map((block, index) => (
              <div key={`${block.title}-${index}`} className="observe-block">
                <h3>{block.title}</h3>
                <BulletList items={block.items} />
              </div>
              ))}
            </ExerciseSection>
          )}

          {exercise.variation && (
            <ExerciseSection title="Prova variante">
              {exercise.variation.title && <p className="objective">{exercise.variation.title}</p>}
              {exercise.variation.description && <p>{exercise.variation.description}</p>}
              {exercise.variation.purpose && <p className="muted-copy">{exercise.variation.purpose}</p>}
            </ExerciseSection>
          )}

          {coachQuestions.length > 0 && (
            <ExerciseSection title="Domande da fare">
              <BulletList items={coachQuestions} />
            </ExerciseSection>
          )}

          {positiveSignals.length > 0 && (
            <ExerciseSection title="Segnali positivi">
              <BulletList items={positiveSignals} />
            </ExerciseSection>
          )}

          {attentionSignals.length > 0 && (
            <ExerciseSection title="Da approfondire">
              <BulletList items={attentionSignals} />
            </ExerciseSection>
          )}

          {!hasAnyContent && <p className="muted-copy">Dettagli esercizio non disponibili.</p>}

          <PermissionAction permission="notes.create"><VoiceRecorder sessionId={sessionId} phaseId={phaseId} exerciseId={exercise.id ?? title} /></PermissionAction>
        </div>

        <footer className="sheet-footer">
          <button type="button" className="primary-action" onClick={onClose}>Chiudi e torna all'allenamento</button>
        </footer>
      </section>
    </div>
  )
}
