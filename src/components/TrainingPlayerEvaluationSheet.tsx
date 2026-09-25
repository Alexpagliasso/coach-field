import { PermissionAction } from '../components/PermissionAction'
import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { getActivePlayerObjectives } from '../db/playerDevelopmentRepository'
import { updateTrainingPlayerEvaluation } from '../db/trainingPlayerEvaluationsRepository'
import type { Player, PlayerObjective, PlayerRating, PlayerRole, TrainingPlayerEvaluation } from '../types/domain'
import { formatPlayerYear, roleOptions } from '../utils/player'
import { CompactStarRating, PlayerStarRating } from './PlayerStarRating'
import { PlayerObjectiveSheet } from './PlayerObjectiveSheet'
import { PlayerObjectivesQuickCheck } from './PlayerObjectivesQuickCheck'
import { VoiceRecorder } from './VoiceRecorder'

type Props = {
  sessionId: string
  player: Player
  evaluation: TrainingPlayerEvaluation
  onChanged: () => void
  onClose: () => void
}

const positiveTags = ['Intensita', 'Collaborazione', 'Tecnica', 'Scelta', 'Posizionamento', 'Comunicazione', 'Coraggio', 'Concentrazione', 'Reazione', 'Apprendimento']
const attentionTags = ['Intensita', 'Scelta', 'Tecnica', 'Posizione', 'Reazione', 'Concentrazione', 'Comunicazione']

function toggleItem<T>(items: T[], item: T) {
  return items.includes(item) ? items.filter((value) => value !== item) : [...items, item]
}

export function TrainingPlayerEvaluationSheet({ sessionId, player, evaluation, onChanged, onClose }: Props) {
  const [draft, setDraft] = useState(evaluation)
  const [flash, setFlash] = useState('')
  const [activeObjectives, setActiveObjectives] = useState<PlayerObjective[]>([])
  const [objectiveOpen, setObjectiveOpen] = useState(false)
  const evaluationKey = useMemo(() => JSON.stringify(evaluation), [evaluation])

  useEffect(() => {
    window.setTimeout(() => setDraft(evaluation), 0)
  }, [evaluation, evaluationKey])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  useEffect(() => {
    getActivePlayerObjectives(player.id).then(setActiveObjectives)
  }, [player.id])

  const persist = async (patch: Partial<TrainingPlayerEvaluation>) => {
    const next = { ...draft, ...patch }
    setDraft(next)
    setFlash('Salvato ✓')
    window.setTimeout(() => setFlash(''), 900)
    await updateTrainingPlayerEvaluation(evaluation.id, patch)
    onChanged()
  }

  return (
    <div className="sheet-backdrop" role="presentation" onClick={onClose}>
      <section className="training-evaluation-sheet" role="dialog" aria-modal="true" aria-labelledby="training-evaluation-title" onClick={(event) => event.stopPropagation()}>
        <div className="sheet-handle" />
        <header className="exercise-sheet-header">
          <div>
            <span className="eyebrow">{formatPlayerYear(player.year)} · {player.idealRoles?.join(' · ') || player.previousRoles.join(' · ')}</span>
            <h1 id="training-evaluation-title">{player.firstName} {player.lastName}</h1>
            <p>Rating generale: <CompactStarRating value={player.rating} /></p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Chiudi valutazione allenamento">
            <X size={26} />
          </button>
        </header>

        <div className="add-player-scroll">
          <section className="content-section player-profile-section">
            <h2>Valutazione allenamento</h2>
            <PermissionAction permission="training.evaluate"><PlayerStarRating value={draft.rating} onChange={(rating: PlayerRating) => persist({ rating })} /></PermissionAction>
          </section>

          <section className="form-field">
            <span>Ruoli provati</span>
            <div className="role-chip-grid">
              {roleOptions.map((role) => {
                const selected = draft.rolesTried.includes(role.id)
                return (
                  <PermissionAction permission="training.evaluate" key={role.id}><button key={role.id} type="button" className={selected ? 'selected' : ''} aria-pressed={selected} onClick={() => persist({ rolesTried: toggleItem<PlayerRole>(draft.rolesTried, role.id) })}>
                    {role.id}
                  </button></PermissionAction>
                )
              })}
            </div>
          </section>

          <section className="form-field">
            <span>Tag positivi</span>
            <div className="tag-grid compact-tags">
              {positiveTags.map((tag) => {
                const selected = (draft.positiveTags ?? []).includes(tag)
                return <PermissionAction permission="training.evaluate" key={tag}><button key={tag} type="button" className={selected ? 'selected' : ''} aria-pressed={selected} onClick={() => persist({ positiveTags: toggleItem(draft.positiveTags ?? [], tag) })}>{tag}</button></PermissionAction>
              })}
            </div>
          </section>

          <section className="form-field">
            <span>Da rivedere</span>
            <div className="tag-grid compact-tags">
              {attentionTags.map((tag) => {
                const selected = (draft.attentionTags ?? []).includes(tag)
                return <PermissionAction permission="training.evaluate" key={tag}><button key={tag} type="button" className={selected ? 'selected attention' : 'attention'} aria-pressed={selected} onClick={() => persist({ attentionTags: toggleItem(draft.attentionTags ?? [], tag) })}>{tag}</button></PermissionAction>
              })}
            </div>
          </section>

          <label className="form-field">
            <span>Nota</span>
            <PermissionAction permission="training.evaluate"><textarea value={draft.note ?? ''} onChange={(event) => persist({ note: event.target.value })} placeholder="Osservazione veloce sull allenamento" rows={4} /></PermissionAction>
          </label>

          <PermissionAction permission="development.view"><PlayerObjectivesQuickCheck
            playerId={player.id}
            objectives={activeObjectives}
            trainingSessionId={sessionId}
            onChanged={() => {
              getActivePlayerObjectives(player.id).then(setActiveObjectives)
              onChanged()
            }}
          /></PermissionAction>

          <PermissionAction permission="development.edit"><button type="button" onClick={() => setObjectiveOpen(true)}>Crea obiettivo</button></PermissionAction>

          <PermissionAction permission="notes.create"><VoiceRecorder sessionId={sessionId} playerId={player.id} onSaved={onChanged} /></PermissionAction>
          {flash && <p className="save-flash compact-flash">{flash}</p>}
        </div>

        <footer className="sheet-footer">
          <button type="button" className="primary-action" onClick={onClose}>Chiudi valutazione</button>
        </footer>
        {objectiveOpen && (
          <PermissionAction permission="development.edit"><PlayerObjectiveSheet
            playerId={player.id}
            sourceTrainingSessionId={sessionId}
            initialTitle={draft.note?.toLowerCase().includes('perdita') ? 'Reazione dopo perdita' : ''}
            initialDescription={draft.note}
            onSaved={() => getActivePlayerObjectives(player.id).then(setActiveObjectives)}
            onClose={() => setObjectiveOpen(false)}
          /></PermissionAction>
        )}
      </section>
    </div>
  )
}
