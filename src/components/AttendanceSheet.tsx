import { useEffect, useState } from 'react'
import { Check, Plus, X } from 'lucide-react'
import { setAllAttendance, setPlayerAttendance } from '../db/attendanceRepository'
import type { Attendance, Player } from '../types/domain'
import { formatPlayerYear } from '../utils/player'
import { AddPlayerModal } from './AddPlayerModal'

type AttendanceSheetProps = {
  sessionId: string
  players: Player[]
  attendance: Attendance[]
  onClose: () => void
  onChanged: () => void
}

export function AttendanceSheet({ sessionId, players, attendance, onClose, onChanged }: AttendanceSheetProps) {
  const [addOpen, setAddOpen] = useState(false)
  const [flash, setFlash] = useState('')

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const presentByPlayer = new Map(attendance.map((item) => [item.playerId, item.present]))

  const setPlayer = async (playerId: string, present: boolean) => {
    await setPlayerAttendance(sessionId, playerId, present)
    onChanged()
  }

  const setAll = async (present: boolean) => {
    await setAllAttendance(sessionId, players, present)
    onChanged()
  }

  const handlePlayerAdded = () => {
    setFlash('Giocatore aggiunto ✓')
    window.setTimeout(() => setFlash(''), 1400)
    onChanged()
  }

  return (
    <div className="sheet-backdrop" role="presentation" onClick={onClose}>
      <section className="attendance-sheet" role="dialog" aria-modal="true" aria-labelledby="attendance-title" onClick={(event) => event.stopPropagation()}>
        <div className="sheet-handle" />
        <header className="exercise-sheet-header">
          <div>
            <span className="eyebrow">Seduta</span>
            <h1 id="attendance-title">Presenze</h1>
            <p>{attendance.filter((item) => item.present).length} / {players.length}</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Chiudi presenze">
            <X size={26} />
          </button>
        </header>

        <div className="action-row attendance-actions">
          <button type="button" onClick={() => setAll(true)}><Check size={20} />Tutti presenti</button>
          <button type="button" onClick={() => setAll(false)}><X size={20} />Azzera</button>
          <button type="button" onClick={() => setAddOpen(true)}><Plus size={20} />Giocatore</button>
        </div>

        {flash && <p className="save-flash compact-flash">{flash}</p>}

        <div className="attendance-list">
          {players.map((player) => {
            const present = presentByPlayer.get(player.id) ?? true
            return (
              <label key={player.id} className="attendance-row">
                <span>
                  <strong>{player.firstName} {player.lastName}</strong>
                  <small>{formatPlayerYear(player.year)} · {player.previousRoles.join(', ') || 'Ruolo da osservare'}</small>
                </span>
                <input type="checkbox" checked={present} onChange={(event) => setPlayer(player.id, event.target.checked)} />
              </label>
            )
          })}
        </div>

        <footer className="sheet-footer">
          <button type="button" className="primary-action" onClick={onClose}>Chiudi presenze</button>
        </footer>
      </section>
      {addOpen && (
        <AddPlayerModal
          players={players}
          sessionId={sessionId}
          defaultPresent
          onAdded={handlePlayerAdded}
          onClose={() => setAddOpen(false)}
        />
      )}
    </div>
  )
}
