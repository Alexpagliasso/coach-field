import { ArrowRight, Clock3, Trophy } from 'lucide-react'
import type { CloudMatch } from '../cloud/matchCloudRepository'
import { Link } from '../groups/navigation'

export function MatchdayCard({ match }: { match: CloudMatch }) {
  const live = match.status === 'live'
  const status = live ? 'Partita in corso' : match.status === 'completed' ? 'Partita completata' : match.status === 'cancelled' ? 'Partita annullata' : 'Matchday · Oggi'
  return <section className={`matchday-card ${live ? 'live' : match.status}`} aria-label={`Partita contro ${match.opponent}`}><div className="matchday-card-icon"><Trophy /></div><div className="matchday-card-copy"><span>{status}</span><h2>GrowPitch vs {match.opponent}</h2><p><Clock3 size={15} />{match.startTime ? match.startTime.slice(0, 5) : 'Orario da definire'}{match.location ? ` · ${match.location}` : ''}</p></div><Link to={`/matches/${match.id}${live ? '?tab=live' : ''}`} className="matchday-card-action">{live ? 'Entra in partita' : 'Apri partita'} <ArrowRight size={17} /></Link></section>
}
