import { PermissionAction } from '../components/PermissionAction'
import { useEffect, useMemo, useState } from 'react'
import { Link } from '../groups/navigation'
import { useNavigate } from '../groups/useNavigate'
import { Plus } from 'lucide-react'
import { CreateMatchModal } from '../components/CreateMatchModal'
import { getMatches } from '../db/matchesRepository'
import type { Match, MatchType } from '../types/domain'
import { formatMatchDate, formatMatchMeta, formatMatchScore } from '../utils/match'

type Filter = 'all' | MatchType

const filters: Array<{ id: Filter; label: string }> = [
  { id: 'all', label: 'Tutte' },
  { id: 'league', label: 'Campionato' },
  { id: 'tournament', label: 'Torneo' },
  { id: 'friendly', label: 'Amichevoli' },
]

export function MatchesPage() {
  const [matches, setMatches] = useState<Match[]>([])
  const [createOpen, setCreateOpen] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')
  const navigate = useNavigate()

  useEffect(() => {
    getMatches().then(setMatches)
  }, [])

  const filtered = useMemo(
    () => matches.filter((match) => filter === 'all' || match.matchType === filter),
    [filter, matches],
  )
  const upcoming = filtered.filter((match) => match.status === 'planned')
  const past = filtered.filter((match) => match.status === 'completed')

  const handleCreated = (match: Match) => {
    setMatches((current) => [match, ...current])
    navigate(`/matches/${match.id}`)
  }

  const renderCard = (match: Match) => (
    <Link key={match.id} to={`/matches/${match.id}`} className="list-card match-card">
      <time>{formatMatchDate(match.date)}</time>
      <div>
        <strong>vs {match.opponent}</strong>
        <span>{formatMatchMeta(match)}</span>
        {match.competition && <small>{match.competition}</small>}
      </div>
      <b className={match.status === 'completed' ? 'match-score' : 'status-badge'}>
        {formatMatchScore(match) ?? 'DA GIOCARE'}
      </b>
    </Link>
  )

  return (
    <section className="page">
      <header className="page-header compact">
        <span className="eyebrow">Archivio squadra</span>
        <h1>Partite</h1>
        <p>{matches.length} partite</p>
      </header>

      <PermissionAction permission="matches.create"><button type="button" className="primary-action" onClick={() => setCreateOpen(true)}>
        <Plus size={22} />Nuova partita
      </button></PermissionAction>

      <div className="filter-pills" aria-label="Filtra partite">
        {filters.map((item) => (
          <button key={item.id} type="button" className={filter === item.id ? 'active' : ''} onClick={() => setFilter(item.id)}>
            {item.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <section className="empty-state match-empty">
          <strong>Nessuna partita</strong>
          <span>Quando giochi una partita, aggiungila qui per tenere traccia delle valutazioni della squadra.</span>
          <PermissionAction permission="matches.create"><button type="button" className="primary-action" onClick={() => setCreateOpen(true)}>
            <Plus size={22} />Crea prima partita
          </button></PermissionAction>
        </section>
      ) : (
        <>
          <section className="content-section">
            <h2>Prossime</h2>
            <div className="list-stack">
              {upcoming.map(renderCard)}
              {upcoming.length === 0 && <p className="empty-state">Nessuna partita da giocare.</p>}
            </div>
          </section>

          <section className="content-section">
            <h2>Passate</h2>
            <div className="list-stack">
              {past.map(renderCard)}
              {past.length === 0 && <p className="empty-state">Nessuna partita completata.</p>}
            </div>
          </section>
        </>
      )}

      {createOpen && <PermissionAction permission="matches.create"><CreateMatchModal onCreated={handleCreated} onClose={() => setCreateOpen(false)} /></PermissionAction>}
    </section>
  )
}
