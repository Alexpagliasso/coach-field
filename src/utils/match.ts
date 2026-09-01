import type { HomeAway, Match, MatchType } from '../types/domain'

export const matchTypeLabels: Record<MatchType, string> = {
  league: 'Campionato',
  tournament: 'Torneo',
  friendly: 'Amichevole',
  other: 'Altro',
}

export const homeAwayLabels: Record<HomeAway, string> = {
  home: 'Casa',
  away: 'Trasferta',
  neutral: 'Neutro',
}

export function formatMatchDate(value: string) {
  if (!value) return 'Data da definire'
  return new Intl.DateTimeFormat('it-IT', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(`${value}T12:00:00`))
}

export function formatMatchMeta(match: Match) {
  return `${matchTypeLabels[match.matchType]} · ${homeAwayLabels[match.homeAway]}`
}

export function formatMatchScore(match: Match) {
  if (typeof match.goalsFor !== 'number' || typeof match.goalsAgainst !== 'number') return undefined
  return `${match.goalsFor} - ${match.goalsAgainst}`
}
