import { PermissionAction } from '../components/PermissionAction'
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Link } from '../groups/navigation'
import { useNavigate } from '../groups/useNavigate'
import { Check, Trash2 } from 'lucide-react'
import { MatchPlayerEvaluationSheet } from '../components/MatchPlayerEvaluationSheet'
import { PlayerStarRating, CompactStarRating } from '../components/PlayerStarRating'
import { setAllMatchPlayers, upsertMatchPlayerEvaluation } from '../db/matchPlayerEvaluationsRepository'
import { completeMatch, deleteMatch, getMatchById, updateMatch } from '../db/matchesRepository'
import { getPlayers } from '../db/playersRepository'
import type { Match, MatchPlayerEvaluation, Player, PlayerRating } from '../types/domain'
import { formatDateTime } from '../utils/format'
import { formatMatchDate, formatMatchMeta, formatMatchScore } from '../utils/match'
import { formatPlayerYear } from '../utils/player'
import { getMatchPlayerEvaluationsByMatch } from '../db/matchPlayerEvaluationsRepository'
import { VoiceRecorder } from '../components/VoiceRecorder'

export function MatchDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [match, setMatch] = useState<Match>()
  const [players, setPlayers] = useState<Player[]>([])
  const [evaluations, setEvaluations] = useState<MatchPlayerEvaluation[]>([])
  const [selectedEvaluation, setSelectedEvaluation] = useState<MatchPlayerEvaluation>()
  const [flash, setFlash] = useState('')

  const refresh = async () => {
    if (!id) return
    const [loadedMatch, loadedPlayers, loadedEvaluations] = await Promise.all([
      getMatchById(id),
      getPlayers(),
      getMatchPlayerEvaluationsByMatch(id),
    ])
    setMatch(loadedMatch)
    setPlayers(loadedPlayers)
    setEvaluations(loadedEvaluations)
    if (selectedEvaluation) {
      setSelectedEvaluation(loadedEvaluations.find((evaluation) => evaluation.id === selectedEvaluation.id))
    }
  }

  useEffect(() => {
    if (!id) return
    let cancelled = false
    Promise.all([
      getMatchById(id),
      getPlayers(),
      getMatchPlayerEvaluationsByMatch(id),
    ]).then(([loadedMatch, loadedPlayers, loadedEvaluations]) => {
      if (cancelled) return
      setMatch(loadedMatch)
      setPlayers(loadedPlayers)
      setEvaluations(loadedEvaluations)
    })
    return () => {
      cancelled = true
    }
  }, [id])

  const evaluationByPlayer = useMemo(
    () => new Map(evaluations.map((evaluation) => [evaluation.playerId, evaluation])),
    [evaluations],
  )
  const selectedPlayers = evaluations.filter((evaluation) => evaluation.selected || evaluation.present)
  const ratedPlayers = selectedPlayers.filter((evaluation) => evaluation.rating !== null)
  const selectedEvaluationPlayer = selectedEvaluation
    ? players.find((player) => player.id === selectedEvaluation.playerId)
    : undefined
  const averageRating = ratedPlayers.length > 0
    ? ratedPlayers.reduce((sum, evaluation) => sum + (evaluation.rating ?? 0), 0) / ratedPlayers.length
    : undefined

  if (!match) return <section className="page"><p className="empty-state">Partita non trovata.</p></section>

  const persistMatch = async (patch: Partial<Match>) => {
    const next = await updateMatch(match.id, patch)
    if (next) setMatch(next)
    setFlash('Salvato ✓')
    window.setTimeout(() => setFlash(''), 900)
  }

  const parseNumber = (value: string) => value === '' ? undefined : Number(value)

  const togglePlayer = async (player: Player, selected: boolean) => {
    await upsertMatchPlayerEvaluation(match.id, player.id, { selected, present: selected })
    refresh()
  }

  const openEvaluation = async (player: Player) => {
    const current = evaluationByPlayer.get(player.id)
    const evaluation = current ?? await upsertMatchPlayerEvaluation(match.id, player.id, { selected: true, present: true })
    setSelectedEvaluation(evaluation)
    refresh()
  }

  const setAll = async (selected: boolean) => {
    await setAllMatchPlayers(match.id, players.map((player) => player.id), selected)
    refresh()
  }

  const handleComplete = async () => {
    const missing = selectedPlayers.length - ratedPlayers.length
    const summary = [
      formatMatchScore(match) ? `Risultato: ${formatMatchScore(match)}` : 'Risultato non inserito',
      `${selectedPlayers.length} partecipanti`,
      `${ratedPlayers.length} valutati`,
      match.teamRating ? `Valutazione squadra: ${match.teamRating}/5` : 'Valutazione squadra non inserita',
      missing > 0 ? `${missing} giocatori non hanno ancora una valutazione.` : '',
    ].filter(Boolean).join('\n')
    if (!window.confirm(`${summary}\n\nCompletare questa partita?`)) return
    const next = await completeMatch(match.id)
    if (next) setMatch(next)
  }

  const handleDelete = async () => {
    if (!window.confirm('Eliminare questa partita?\n\nVerranno eliminate anche le valutazioni associate.')) return
    await deleteMatch(match.id)
    navigate('/matches')
  }

  return (
    <section className="page">
      <header className="page-header compact">
        <span className="eyebrow">{formatMatchDate(match.date)} · {formatMatchMeta(match)}</span>
        <h1>{match.opponent}</h1>
        <p>{match.competition || match.location || (match.status === 'planned' ? 'Da giocare' : 'Completata')}</p>
      </header>

      {match.status === 'completed' && <span className="save-flash">Partita completata · dati modificabili</span>}
      {flash && <p className="save-flash compact-flash">{flash}</p>}

      <section className="content-section match-summary">
        <div>
          <span className="eyebrow">Stato</span>
          <strong>{match.status === 'planned' ? 'Da giocare' : 'Completata'}</strong>
        </div>
        {formatMatchScore(match) && <b className="match-score large">{formatMatchScore(match)}</b>}
        {match.status === 'planned' ? (
          <a href="#match-players" className="primary-action">Inizia / gestisci partita</a>
        ) : (
          <a href="#match-players" className="primary-action">Modifica</a>
        )}
      </section>

      <section className="content-section">
        <h2>Risultato</h2>
        <div className="score-grid">
          <label className="form-field">
            <span>La nostra squadra</span>
            <PermissionAction permission="matches.edit"><input type="number" inputMode="numeric" min="0" value={match.goalsFor ?? ''} onChange={(event) => persistMatch({ goalsFor: parseNumber(event.target.value) })} /></PermissionAction>
          </label>
          <label className="form-field">
            <span>Avversario</span>
            <PermissionAction permission="matches.edit"><input type="number" inputMode="numeric" min="0" value={match.goalsAgainst ?? ''} onChange={(event) => persistMatch({ goalsAgainst: parseNumber(event.target.value) })} /></PermissionAction>
          </label>
        </div>
      </section>

      <section className="content-section">
        <h2>Valutazione squadra</h2>
        <PermissionAction permission="matches.edit"><PlayerStarRating value={match.teamRating ?? null} onChange={(rating: PlayerRating) => persistMatch({ teamRating: rating })} /></PermissionAction>
      </section>

      <section className="content-section">
        <h2>Note staff</h2>
        <PermissionAction permission="matches.edit"><textarea value={match.teamNotes ?? ''} onChange={(event) => persistMatch({ teamNotes: event.target.value })} placeholder="Cosa ha funzionato? Dove abbiamo avuto difficolta?" rows={4} /></PermissionAction>
        <PermissionAction permission="notes.create"><VoiceRecorder sessionId="match" matchId={match.id} /></PermissionAction>
      </section>

      <section className="content-section takeaway-section">
        <h2>Da portare in allenamento</h2>
        <PermissionAction permission="matches.edit"><textarea value={match.trainingTakeaways ?? ''} onChange={(event) => persistMatch({ trainingTakeaways: event.target.value })} placeholder="Uscita dalla pressione&#10;Reazione dopo perdita&#10;Occupazione ampiezza" rows={4} /></PermissionAction>
      </section>

      <section id="match-players" className="content-section">
        <div className="section-header-row">
          <h2>Giocatori</h2>
          <span>{selectedPlayers.length} partecipanti · {ratedPlayers.length} valutati</span>
        </div>
        {averageRating !== undefined && <p className="muted-copy">Media partita: {averageRating.toFixed(1).replace('.', ',')} ★</p>}
        <div className="action-row attendance-actions">
          <PermissionAction permission="matches.evaluate"><button type="button" onClick={() => setAll(true)}><Check size={20} />Tutti</button></PermissionAction>
          <PermissionAction permission="matches.evaluate"><button type="button" onClick={() => setAll(false)}>Nessuno</button></PermissionAction>
        </div>
        <div className="list-stack">
          {players.map((player) => {
            const evaluation = evaluationByPlayer.get(player.id)
            const participates = Boolean(evaluation?.selected || evaluation?.present)
            return (
              <article key={player.id} className={`list-card player-row ${participates ? 'selected' : ''}`}>
                <PermissionAction permission="matches.evaluate"><button type="button" className="row-select" onClick={() => openEvaluation(player)}>
                  <strong>{player.firstName} {player.lastName}</strong>
                  <span>{evaluation?.rolesPlayed?.join(' · ') || player.idealRoles?.join(' · ') || player.previousRoles.join(' · ') || formatPlayerYear(player.year)}</span>
                  <small>{participates ? (evaluation?.rating ? <CompactStarRating value={evaluation.rating} /> : 'DA VALUTARE') : 'Non convocato'}</small>
                </button></PermissionAction>
                <label className="switch">
                  <PermissionAction permission="matches.evaluate"><input type="checkbox" checked={participates} onChange={(event) => togglePlayer(player, event.target.checked)} /></PermissionAction>
                  <span>Partecipa</span>
                </label>
              </article>
            )
          })}
        </div>
      </section>

      <section className="content-section">
        <h2>Riepilogo</h2>
        <div className="data-count-grid">
          <span><strong>{selectedPlayers.length}</strong> partecipanti</span>
          <span><strong>{ratedPlayers.length}</strong> valutati</span>
          <span><strong>{averageRating === undefined ? '—' : averageRating.toFixed(1).replace('.', ',')}</strong> media partite</span>
          <span><strong>{match.teamRating ?? '—'}</strong> squadra</span>
        </div>
        {match.updatedAt && <small className="muted-copy">Aggiornata {formatDateTime(match.updatedAt)}</small>}
      </section>

      <div className="action-row">
        <PermissionAction permission="matches.edit"><button type="button" onClick={handleComplete}>Completa partita</button></PermissionAction>
        <PermissionAction permission="matches.edit"><button type="button" className="danger" onClick={handleDelete}><Trash2 size={20} />Elimina</button></PermissionAction>
      </div>

      <Link to="/matches" className="subtle-link">Torna alle partite</Link>

      {selectedEvaluation && selectedEvaluationPlayer && (
        <MatchPlayerEvaluationSheet
          matchId={match.id}
          player={selectedEvaluationPlayer}
          evaluation={selectedEvaluation}
          onChanged={refresh}
          onClose={() => setSelectedEvaluation(undefined)}
        />
      )}
    </section>
  )
}
