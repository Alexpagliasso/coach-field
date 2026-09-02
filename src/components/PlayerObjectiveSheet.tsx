import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { createPlayerObjective } from '../db/playerDevelopmentRepository'
import type { PlayerObjectiveCategory, PlayerObjectivePriority } from '../types/domain'

type Props = {
  playerId: string
  sourceMatchId?: string
  sourceTrainingSessionId?: string
  initialTitle?: string
  initialDescription?: string
  onSaved: () => void
  onClose: () => void
}

const categories: Array<{ id: PlayerObjectiveCategory; label: string }> = [
  { id: 'technical', label: 'Tecnico' },
  { id: 'tactical', label: 'Tattico' },
  { id: 'physical', label: 'Fisico' },
  { id: 'mental', label: 'Mentale' },
  { id: 'relational', label: 'Relazionale' },
  { id: 'goalkeeper', label: 'Portiere' },
  { id: 'other', label: 'Altro' },
]

const priorities: Array<{ id: PlayerObjectivePriority; label: string }> = [
  { id: 'low', label: 'Bassa' },
  { id: 'medium', label: 'Media' },
  { id: 'high', label: 'Alta' },
]

export function PlayerObjectiveSheet({ playerId, sourceMatchId, sourceTrainingSessionId, initialTitle = '', initialDescription = '', onSaved, onClose }: Props) {
  const [title, setTitle] = useState(initialTitle)
  const [description, setDescription] = useState(initialDescription)
  const [category, setCategory] = useState<PlayerObjectiveCategory>('tactical')
  const [priority, setPriority] = useState<PlayerObjectivePriority>('medium')
  const [error, setError] = useState('')

  const save = async () => {
    setError('')
    if (!title.trim()) {
      setError('Inserisci un obiettivo breve e osservabile.')
      return
    }
    await createPlayerObjective({ playerId, title, description, category, priority, sourceMatchId, sourceTrainingSessionId })
    onSaved()
    onClose()
  }

  return (
    <div className="sheet-backdrop" role="presentation" onClick={onClose}>
      <section className="development-sheet" role="dialog" aria-modal="true" aria-labelledby="objective-title" onClick={(event) => event.stopPropagation()}>
        <div className="sheet-handle" />
        <header className="exercise-sheet-header">
          <div>
            <span className="eyebrow">Player development</span>
            <h1 id="objective-title">Nuovo obiettivo</h1>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Chiudi obiettivo"><X size={26} /></button>
        </header>
        <div className="add-player-scroll">
          <label className="form-field"><span>Titolo *</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Reazione dopo perdita" autoFocus /></label>
          <label className="form-field"><span>Descrizione</span><textarea rows={4} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Comportamento concreto da osservare" /></label>
          <section className="form-field">
            <span>Categoria</span>
            <div className="segmented-grid">
              {categories.map((item) => <button key={item.id} type="button" className={category === item.id ? 'selected' : ''} onClick={() => setCategory(item.id)}>{item.label}</button>)}
            </div>
          </section>
          <section className="form-field">
            <span>Priorita</span>
            <div className="segmented-grid three">
              {priorities.map((item) => <button key={item.id} type="button" className={priority === item.id ? 'selected' : ''} onClick={() => setPriority(item.id)}>{item.label}</button>)}
            </div>
          </section>
          {error && <p className="form-error">{error}</p>}
        </div>
        <footer className="sheet-footer">
          <button type="button" className="primary-action" onClick={save}><Plus size={22} />Salva obiettivo</button>
        </footer>
      </section>
    </div>
  )
}
