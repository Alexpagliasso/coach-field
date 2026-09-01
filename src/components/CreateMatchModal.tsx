import { useEffect, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { createMatch } from '../db/matchesRepository'
import type { HomeAway, Match, MatchType } from '../types/domain'
import { homeAwayLabels, matchTypeLabels } from '../utils/match'

type CreateMatchModalProps = {
  onCreated: (match: Match) => void
  onClose: () => void
}

const matchTypes: MatchType[] = ['league', 'tournament', 'friendly', 'other']
const homeAwayOptions: HomeAway[] = ['home', 'away', 'neutral']

export function CreateMatchModal({ onCreated, onClose }: CreateMatchModalProps) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [opponent, setOpponent] = useState('')
  const [matchType, setMatchType] = useState<MatchType>('friendly')
  const [homeAway, setHomeAway] = useState<HomeAway>('home')
  const [competition, setCompetition] = useState('')
  const [location, setLocation] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const submit = async () => {
    setError('')
    if (!date) {
      setError('Inserisci la data.')
      return
    }
    if (!opponent.trim()) {
      setError('Inserisci l avversario.')
      return
    }
    const match = await createMatch({ date, opponent, matchType, homeAway, competition, location })
    onCreated(match)
    onClose()
  }

  return (
    <div className="sheet-backdrop" role="presentation" onClick={onClose}>
      <section className="match-form-sheet" role="dialog" aria-modal="true" aria-labelledby="create-match-title" onClick={(event) => event.stopPropagation()}>
        <div className="sheet-handle" />
        <header className="exercise-sheet-header">
          <div>
            <span className="eyebrow">Partite</span>
            <h1 id="create-match-title">Nuova partita</h1>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Chiudi nuova partita">
            <X size={26} />
          </button>
        </header>

        <div className="add-player-scroll">
          <label className="form-field">
            <span>Data *</span>
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </label>
          <label className="form-field">
            <span>Avversario *</span>
            <input value={opponent} onChange={(event) => setOpponent(event.target.value)} autoFocus />
          </label>

          <section className="form-field">
            <span>Tipo partita *</span>
            <div className="segmented-grid">
              {matchTypes.map((type) => (
                <button key={type} type="button" aria-pressed={matchType === type} className={matchType === type ? 'selected' : ''} onClick={() => setMatchType(type)}>
                  {matchTypeLabels[type]}
                </button>
              ))}
            </div>
          </section>

          <section className="form-field">
            <span>Casa / trasferta</span>
            <div className="segmented-grid three">
              {homeAwayOptions.map((option) => (
                <button key={option} type="button" aria-pressed={homeAway === option} className={homeAway === option ? 'selected' : ''} onClick={() => setHomeAway(option)}>
                  {homeAwayLabels[option]}
                </button>
              ))}
            </div>
          </section>

          <label className="form-field">
            <span>Competizione</span>
            <input value={competition} onChange={(event) => setCompetition(event.target.value)} />
          </label>
          <label className="form-field">
            <span>Luogo</span>
            <input value={location} onChange={(event) => setLocation(event.target.value)} />
          </label>
          {error && <p className="form-error">{error}</p>}
        </div>

        <footer className="sheet-footer">
          <button type="button" className="primary-action" onClick={submit}>
            <Plus size={22} />Crea partita
          </button>
        </footer>
      </section>
    </div>
  )
}
