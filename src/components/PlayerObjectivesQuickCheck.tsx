import { PermissionAction } from '../components/PermissionAction'
import { addPlayerObjectiveEvidence } from '../db/playerDevelopmentRepository'
import type { PlayerObjective, PlayerObjectiveEvidenceOutcome } from '../types/domain'

type Props = {
  playerId: string
  objectives: PlayerObjective[]
  matchId?: string
  trainingSessionId?: string
  onChanged: () => void
}

const outcomes: Array<{ id: PlayerObjectiveEvidenceOutcome; label: string }> = [
  { id: 'positive', label: '✓' },
  { id: 'mixed', label: '~' },
  { id: 'attention', label: '!' },
]

export function PlayerObjectivesQuickCheck({ playerId, objectives, matchId, trainingSessionId, onChanged }: Props) {
  if (objectives.length === 0) return null

  const addEvidence = async (objectiveId: string, outcome: PlayerObjectiveEvidenceOutcome) => {
    await addPlayerObjectiveEvidence({ objectiveId, playerId, outcome, matchId, trainingSessionId })
    onChanged()
  }

  return (
    <section className="content-section quick-objectives">
      <h2>Obiettivi attivi</h2>
      {objectives.map((objective) => (
        <article key={objective.id} className="quick-objective-row">
          <span>{objective.title}</span>
          <div>
            {outcomes.map((outcome) => (
              <PermissionAction permission="development.edit" key={outcome.id}><button key={outcome.id} type="button" aria-label={`${objective.title}: ${outcome.id}`} onClick={() => addEvidence(objective.id, outcome.id)}>
                {outcome.label}
              </button></PermissionAction>
            ))}
          </div>
        </article>
      ))}
    </section>
  )
}
