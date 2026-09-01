import { useEffect, useMemo, useState } from 'react'
import { Plus, UserCheck, X } from 'lucide-react'
import { setPlayerAttendance } from '../db/attendanceRepository'
import { makeId } from '../db/db'
import { savePlayer } from '../db/playersRepository'
import type { Player, PlayerRole, PlayerYear } from '../types/domain'
import { hasSameIdentity, roleLabelByCode, roleOptions } from '../utils/player'
import { PlayerStarRating } from './PlayerStarRating'

type AddPlayerModalProps = {
  players: Player[]
  sessionId?: string
  defaultPresent?: boolean
  onAdded: (player: Player) => void
  onClose: () => void
}

export function AddPlayerModal({ players, sessionId, defaultPresent = false, onAdded, onClose }: AddPlayerModalProps) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [year, setYear] = useState<PlayerYear>(2017)
  const [previousRoles, setPreviousRoles] = useState<PlayerRole[]>([])
  const [idealRoles, setIdealRoles] = useState<PlayerRole[]>([])
  const [rating, setRating] = useState<Player['rating']>(null)
  const [markPresent, setMarkPresent] = useState(defaultPresent)
  const [duplicate, setDuplicate] = useState<Player>()
  const [forceAdd, setForceAdd] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const normalizedCandidate = useMemo(() => ({
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    year,
  }), [firstName, lastName, year])

  const toggleRole = (role: PlayerRole, target: 'previous' | 'ideal') => {
    const setter = target === 'previous' ? setPreviousRoles : setIdealRoles
    const source = target === 'previous' ? previousRoles : idealRoles
    setter(source.includes(role) ? source.filter((item) => item !== role) : [...source, role])
  }

  const useExisting = async () => {
    if (!duplicate) return
    if (sessionId && markPresent) {
      await setPlayerAttendance(sessionId, duplicate.id, true)
    }
    setSaved(true)
    onAdded(duplicate)
    window.setTimeout(onClose, 500)
  }

  const save = async () => {
    setError('')
    const cleanFirstName = firstName.trim()
    const cleanLastName = lastName.trim()

    if (!cleanFirstName) {
      setError('Inserisci almeno il nome.')
      return
    }

    const existing = players.find((player) => hasSameIdentity(player, normalizedCandidate))
    if (existing && !forceAdd) {
      setDuplicate(existing)
      return
    }

    const player: Player = {
      id: `guest-${makeId()}`,
      firstName: cleanFirstName,
      lastName: cleanLastName,
      year,
      previousRoles: previousRoles.map((role) => roleLabelByCode[role]),
      rating,
      idealRoles,
      goalkeeperCandidate: false,
      status: 'guest',
    }

    await savePlayer(player)
    if (sessionId && markPresent) {
      await setPlayerAttendance(sessionId, player.id, true)
    }
    setSaved(true)
    onAdded(player)
    window.setTimeout(onClose, 550)
  }

  return (
    <div
      className="sheet-backdrop add-player-backdrop"
      role="presentation"
      onClick={(event) => {
        event.stopPropagation()
        onClose()
      }}
    >
      <section className="add-player-sheet" role="dialog" aria-modal="true" aria-labelledby="add-player-title" onClick={(event) => event.stopPropagation()}>
        <div className="sheet-handle" />
        <header className="exercise-sheet-header">
          <div>
            <span className="eyebrow">Nuovo ospite</span>
            <h1 id="add-player-title">Aggiungi giocatore</h1>
            {saved && <p>Giocatore aggiunto ✓</p>}
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Chiudi aggiunta giocatore">
            <X size={26} />
          </button>
        </header>

        <div className="add-player-scroll">
          {duplicate && (
            <section className="duplicate-alert">
              <strong>Esiste gia un giocatore con questi dati.</strong>
              <span>{duplicate.firstName} {duplicate.lastName}</span>
              <div className="action-row">
                <button type="button" onClick={useExisting}><UserCheck size={20} />Usa esistente</button>
                <button type="button" onClick={() => { setForceAdd(true); setDuplicate(undefined) }}><Plus size={20} />Aggiungi comunque</button>
              </div>
            </section>
          )}

          <label className="form-field">
            <span>Nome *</span>
            <input value={firstName} onChange={(event) => setFirstName(event.target.value)} autoFocus />
          </label>
          <label className="form-field">
            <span>Cognome</span>
            <input value={lastName} onChange={(event) => setLastName(event.target.value)} />
          </label>
          <label className="form-field">
            <span>Anno *</span>
            <select value={year} onChange={(event) => setYear(event.target.value === 'other' ? 'other' : Number(event.target.value) as PlayerYear)}>
              <option value={2016}>2016</option>
              <option value={2017}>2017</option>
              <option value="other">Altro</option>
            </select>
          </label>

          <section className="form-field">
            <span>Ruoli storici</span>
            <div className="role-chip-grid">
              {roleOptions.map((role) => (
                <button key={role.id} type="button" className={previousRoles.includes(role.id) ? 'selected' : ''} onClick={() => toggleRole(role.id, 'previous')}>
                  {role.id}
                </button>
              ))}
            </div>
          </section>

          <section className="form-field">
            <span>Valutazione tecnica</span>
            <PlayerStarRating value={rating} onChange={setRating} />
          </section>

          <section className="form-field">
            <span>Ruolo ideale</span>
            <div className="role-chip-grid">
              {roleOptions.map((role) => (
                <button key={role.id} type="button" className={idealRoles.includes(role.id) ? 'selected' : ''} onClick={() => toggleRole(role.id, 'ideal')}>
                  {role.id}
                </button>
              ))}
            </div>
          </section>

          {sessionId && (
            <label className="present-toggle">
              <input type="checkbox" checked={markPresent} onChange={(event) => setMarkPresent(event.target.checked)} />
              <span>Segna come presente oggi</span>
            </label>
          )}

          {error && <p className="form-error">{error}</p>}
        </div>

        <footer className="sheet-footer">
          <button type="button" className="primary-action" onClick={save}>
            <Plus size={22} />Aggiungi giocatore
          </button>
        </footer>
      </section>
    </div>
  )
}
