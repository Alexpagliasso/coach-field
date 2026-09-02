import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { createPlayerDevelopmentReview } from '../db/playerDevelopmentRepository'
import type { Player, PlayerRating, PlayerRole } from '../types/domain'
import { roleOptions } from '../utils/player'
import { PlayerStarRating } from './PlayerStarRating'

type Props = {
  player: Player
  onSaved: () => void
  onClose: () => void
}

function splitLines(value: string) {
  return value.split('\n').map((item) => item.trim()).filter(Boolean)
}

function toggleRole(roles: PlayerRole[], role: PlayerRole) {
  return roles.includes(role) ? roles.filter((item) => item !== role) : [...roles, role]
}

export function PlayerReviewSheet({ player, onSaved, onClose }: Props) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [rating, setRating] = useState<PlayerRating>(player.rating)
  const [strengths, setStrengths] = useState('')
  const [developmentAreas, setDevelopmentAreas] = useState('')
  const [suggestedRoles, setSuggestedRoles] = useState<PlayerRole[]>(player.idealRoles ?? [])
  const [summary, setSummary] = useState('')

  const save = async () => {
    await createPlayerDevelopmentReview({
      playerId: player.id,
      date,
      overallRatingSnapshot: rating,
      strengths: splitLines(strengths),
      developmentAreas: splitLines(developmentAreas),
      suggestedRoles,
      summary,
    })
    onSaved()
    onClose()
  }

  return (
    <div className="sheet-backdrop" role="presentation" onClick={onClose}>
      <section className="development-sheet" role="dialog" aria-modal="true" aria-labelledby="review-title" onClick={(event) => event.stopPropagation()}>
        <div className="sheet-handle" />
        <header className="exercise-sheet-header">
          <div>
            <span className="eyebrow">Review sviluppo</span>
            <h1 id="review-title">{player.firstName} {player.lastName}</h1>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Chiudi review"><X size={26} /></button>
        </header>
        <div className="add-player-scroll">
          <label className="form-field"><span>Data</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
          <section className="content-section player-profile-section">
            <h2>Rating snapshot</h2>
            <PlayerStarRating value={rating} onChange={setRating} />
          </section>
          <label className="form-field"><span>Punti di forza</span><textarea rows={4} value={strengths} onChange={(event) => setStrengths(event.target.value)} placeholder="Uno per riga" /></label>
          <label className="form-field"><span>Aree da sviluppare</span><textarea rows={4} value={developmentAreas} onChange={(event) => setDevelopmentAreas(event.target.value)} placeholder="Uno per riga" /></label>
          <section className="form-field">
            <span>Ruoli consigliati</span>
            <div className="role-chip-grid">
              {roleOptions.map((role) => {
                const selected = suggestedRoles.includes(role.id)
                return <button key={role.id} type="button" className={selected ? 'selected' : ''} onClick={() => setSuggestedRoles((current) => toggleRole(current, role.id))}>{role.id}</button>
              })}
            </div>
          </section>
          <label className="form-field"><span>Sintesi</span><textarea rows={4} value={summary} onChange={(event) => setSummary(event.target.value)} /></label>
        </div>
        <footer className="sheet-footer">
          <button type="button" className="primary-action" onClick={save}><Plus size={22} />Salva review</button>
        </footer>
      </section>
    </div>
  )
}
