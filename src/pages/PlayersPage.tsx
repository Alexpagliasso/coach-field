import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, Shield } from 'lucide-react'
import { AddPlayerModal } from '../components/AddPlayerModal'
import { CompactStarRating } from '../components/PlayerStarRating'
import { getPlayers } from '../db/playersRepository'
import type { Player } from '../types/domain'
import { formatPlayerAge, formatPlayerYear, sortYearValue } from '../utils/player'

type SortMode = 'name' | 'rating-desc' | 'rating-asc' | 'year'

export function PlayersPage() {
  const [players, setPlayers] = useState<Player[]>([])
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [sortMode, setSortMode] = useState<SortMode>('name')
  const [addOpen, setAddOpen] = useState(false)

  useEffect(() => {
    getPlayers().then(setPlayers)
  }, [])

  const refreshPlayers = () => getPlayers().then(setPlayers)

  const matchesFilter = (player: Player) => {
    if (filter === 'all') return true
    if (filter === '2016') return player.year === 2016
    if (filter === '2017') return player.year === 2017
    return player.previousRoles.some((role) => {
      const normalized = role.toLowerCase()
      return (
        (filter === 'por' && normalized === 'portiere') ||
        (filter === 'dif' && normalized === 'difensore') ||
        (filter === 'cen' && normalized === 'centrocampista') ||
        (filter === 'att' && normalized === 'attaccante') ||
        (filter === 'jolly' && normalized === 'jolly')
      )
    })
  }

  const filteredPlayers = players
    .filter((player) => {
      const text = `${player.firstName} ${player.lastName} ${player.previousRoles.join(' ')}`.toLowerCase()
      return matchesFilter(player) && text.includes(query.toLowerCase())
    })
    .sort((a, b) => {
      if (sortMode === 'year') return sortYearValue(a.year) - sortYearValue(b.year) || a.firstName.localeCompare(b.firstName)
      if (sortMode === 'rating-desc') {
        if (a.rating === null && b.rating === null) return a.firstName.localeCompare(b.firstName)
        if (a.rating === null) return 1
        if (b.rating === null) return -1
        return b.rating - a.rating || a.firstName.localeCompare(b.firstName)
      }
      if (sortMode === 'rating-asc') {
        if (a.rating === null && b.rating === null) return a.firstName.localeCompare(b.firstName)
        if (a.rating === null) return 1
        if (b.rating === null) return -1
        return a.rating - b.rating || a.firstName.localeCompare(b.firstName)
      }
      return a.firstName.localeCompare(b.firstName)
    })

  const filters = [
    { id: 'all', label: 'Tutti' },
    { id: '2016', label: '2016' },
    { id: '2017', label: '2017' },
    { id: 'por', label: 'POR' },
    { id: 'dif', label: 'DIF' },
    { id: 'cen', label: 'CEN' },
    { id: 'att', label: 'ATT' },
    { id: 'jolly', label: 'JOLLY' },
  ]

  return (
    <section className="page">
      <header className="page-header compact">
        <span className="eyebrow">Rosa</span>
        <h1>Giocatori</h1>
        <p>{players.length} giocatori</p>
      </header>
      <button type="button" className="primary-action add-player-trigger" onClick={() => setAddOpen(true)}>
        <Plus size={22} />Giocatore
      </button>
      <label className="search-field">
        <Search size={21} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cerca nome o ruolo" />
      </label>
      <label className="sort-control">
        <span>Ordina</span>
        <select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}>
          <option value="name">Nome</option>
          <option value="rating-desc">Valutazione ↓</option>
          <option value="rating-asc">Valutazione ↑</option>
          <option value="year">Anno</option>
        </select>
      </label>
      <div className="filter-pills" aria-label="Filtra giocatori">
        {filters.map((item) => (
          <button key={item.id} type="button" className={filter === item.id ? 'active' : ''} onClick={() => setFilter(item.id)}>
            {item.label}
          </button>
        ))}
      </div>
      <div className="list-stack">
        {filteredPlayers.map((player) => (
          <Link key={player.id} to={`/players/${player.id}`} className="list-card player-row">
            <div>
              <strong>{player.firstName} {player.lastName}</strong>
              <span>{formatPlayerYear(player.year)} · {formatPlayerAge(player.year)}</span>
              <span>{player.previousRoles.join(' · ')}</span>
              <span className="player-card-meta">
                <CompactStarRating value={player.rating} />
                {(player.idealRoles?.length ?? 0) > 0 && <b>{player.idealRoles.join(' · ')}</b>}
                {player.status === 'guest' && <b className="status-badge">OSPITE</b>}
              </span>
            </div>
            {player.goalkeeperCandidate && <Shield aria-label="Candidato portiere" size={23} />}
          </Link>
        ))}
        {filteredPlayers.length === 0 && <p className="empty-state">Nessun giocatore trovato.</p>}
      </div>
      {addOpen && (
        <AddPlayerModal
          players={players}
          onAdded={refreshPlayers}
          onClose={() => setAddOpen(false)}
        />
      )}
    </section>
  )
}
