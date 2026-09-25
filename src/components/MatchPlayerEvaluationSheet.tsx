import { PermissionAction } from '../components/PermissionAction'
import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { getActivePlayerObjectives } from '../db/playerDevelopmentRepository'
import { updateMatchPlayerEvaluation } from '../db/matchPlayerEvaluationsRepository'
import type { MatchPlayerEvaluation, Player, PlayerObjective, PlayerRole, PlayerRating } from '../types/domain'
import { formatPlayerYear, roleOptions } from '../utils/player'
import { CompactStarRating, PlayerStarRating } from './PlayerStarRating'
import { PlayerObjectiveSheet } from './PlayerObjectiveSheet'
import { PlayerObjectivesQuickCheck } from './PlayerObjectivesQuickCheck'
import { VoiceRecorder } from './VoiceRecorder'

type MatchPlayerEvaluationSheetProps = {
  matchId: string
  player: Player
  evaluation: MatchPlayerEvaluation
  onChanged: () => void
  onClose: () => void
}

const positiveTags = ['Coraggio', 'Collaborazione', 'Intensita', 'Scelta', 'Tecnica', 'Posizionamento', 'Reazione', 'Comunicazione']
const attentionTags = ['Scelta', 'Posizione', 'Intensita', 'Reazione', 'Tecnica', 'Concentrazione']

function toggleItem(items: string[], item: string) {
  return items.includes(item) ? items.filter((value) => value !== item) : [...items, item]
}

function toggleRole(items: PlayerRole[], item: PlayerRole) {
  return items.includes(item) ? items.filter((value) => value !== item) : [...items, item]
}

export function MatchPlayerEvaluationSheet({ matchId, player, evaluation, onChanged, onClose }: MatchPlayerEvaluationSheetProps) {
  const [draft, setDraft] = useState(evaluation)
  const [flash, setFlash] = useState('')
  const [activeObjectives, setActiveObjectives] = useState<PlayerObjective[]>([])
  const [objectiveOpen, setObjectiveOpen] = useState(false)

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

  const persist = async (patch: Partial<MatchPlayerEvaluation>) => {
    const next = { ...draft, ...patch }
    setDraft(next)
    setFlash('Salvato ✓')
    window.setTimeout(() => setFlash(''), 900)
    await updateMatchPlayerEvaluation(evaluation.id, patch)
    onChanged()
  }

  return (
    <div className="sheet-backdrop" role="presentation" onClick={onClose}>
      <section className="match-evaluation-sheet" role="dialog" aria-modal="true" aria-labelledby="match-evaluation-title" onClick={(event) => event.stopPropagation()}>
        <div className="sheet-handle" />
        <header className="exercise-sheet-header">
          <div>
            <span className="eyebrow">{formatPlayerYear(player.year)} · {player.idealRoles?.join(' · ') || 'Ruolo ideale da definire'}</span>
            <h1 id="match-evaluation-title">{player.firstName} {player.lastName}</h1>
            <p>Valutazione generale corrente: <CompactStarRating value={player.rating} /></p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Chiudi valutazione partita">
            <X size={26} />
          </button>
        </header>

        <div className="add-player-scroll">
          <section className="content-section player-profile-section">
            <h2>Valutazione partita</h2>
            <PermissionAction permission="matches.evaluate"><PlayerStarRating value={draft.rating} onChange={(rating: PlayerRating) => persist({ rating })} /></PermissionAction>
          </section>

          <label className="present-toggle">
            <PermissionAction permission="matches.evaluate"><input type="checkbox" checked={Boolean(draft.starter)} onChange={(event) => persist({ starter: event.target.checked })} /></PermissionAction>
            <span>Titolarita</span>
          </label>

          <section className="form-field">
            <span>Ruoli giocati</span>
            <div className="role-chip-grid">
              {roleOptions.map((role) => {
                const selected = draft.rolesPlayed.includes(role.id)
                return (
                  <PermissionAction permission="matches.evaluate" key={role.id}><button key={role.id} type="button" className={selected ? 'selected' : ''} aria-pressed={selected} onClick={() => persist({ rolesPlayed: toggleRole(draft.rolesPlayed, role.id) })}>
                    {role.id}
                  </button></PermissionAction>
                )
              })}
            </div>
          </section>

          <section className="form-field">
            <span>Positivi</span>
            <div className="tag-grid compact-tags">
              {positiveTags.map((tag) => {
                const selected = (draft.positiveTags ?? []).includes(tag)
                return <PermissionAction permission="matches.evaluate" key={tag}><button key={tag} type="button" className={selected ? 'selected' : ''} aria-pressed={selected} onClick={() => persist({ positiveTags: toggleItem(draft.positiveTags ?? [], tag) })}>{tag}</button></PermissionAction>
              })}
            </div>
          </section>

          <section className="form-field">
            <span>Da rivedere</span>
            <div className="tag-grid compact-tags">
              {attentionTags.map((tag) => {
                const selected = (draft.attentionTags ?? []).includes(tag)
                return <PermissionAction permission="matches.evaluate" key={tag}><button key={tag} type="button" className={selected ? 'selected attention' : 'attention'} aria-pressed={selected} onClick={() => persist({ attentionTags: toggleItem(draft.attentionTags ?? [], tag) })}>{tag}</button></PermissionAction>
              })}
            </div>
          </section>

          <label className="form-field">
            <span>Note partita</span>
            <PermissionAction permission="matches.evaluate"><textarea value={draft.note ?? ''} onChange={(event) => persist({ note: event.target.value })} placeholder="Come si e comportato? Cosa ha fatto bene? Cosa rivedere?" rows={4} /></PermissionAction>
          </label>

          <PermissionAction permission="development.view"><PlayerObjectivesQuickCheck
            playerId={player.id}
            objectives={activeObjectives}
            matchId={matchId}
            onChanged={() => {
              getActivePlayerObjectives(player.id).then(setActiveObjectives)
              onChanged()
            }}
          /></PermissionAction>

          <PermissionAction permission="development.edit"><button type="button" onClick={() => setObjectiveOpen(true)}>Crea obiettivo</button></PermissionAction>

          <PermissionAction permission="notes.create"><VoiceRecorder sessionId="match" matchId={matchId} playerId={player.id} onSaved={onChanged} /></PermissionAction>
          {flash && <p className="save-flash compact-flash">{flash}</p>}
        </div>

        <footer className="sheet-footer">
          <button type="button" className="primary-action" onClick={onClose}>Chiudi valutazione</button>
        </footer>
        {objectiveOpen && (
          <PermissionAction permission="development.edit"><PlayerObjectiveSheet
            playerId={player.id}
            sourceMatchId={matchId}
            initialTitle={draft.note?.toLowerCase().includes('perde palla') ? 'Reazione dopo perdita' : ''}
            initialDescription={draft.note}
            onSaved={() => getActivePlayerObjectives(player.id).then(setActiveObjectives)}
            onClose={() => setObjectiveOpen(false)}
          /></PermissionAction>
        )}
      </section>
    </div>
  )
}
