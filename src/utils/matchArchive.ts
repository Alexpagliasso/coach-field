import type { CloudMatch, CloudMatchStatus } from '../cloud/matchCloudRepository'

export type MatchArchiveSort = 'recent' | 'oldest' | 'upcoming' | 'opponent'
export type MatchArchiveFilters = { query?: string; status?: CloudMatchStatus | 'all'; from?: string; to?: string; today?: string }

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('it-IT').trim()
const dateTime = (match: CloudMatch) => `${match.matchDate}T${match.startTime ?? '23:59:59'}`

export function matchesMatchArchive(match: CloudMatch, filters: MatchArchiveFilters) {
  const query = normalize(filters.query ?? '')
  const searchable = normalize(`${match.opponent} ${match.competition ?? ''}`)
  return (!query || searchable.includes(query))
    && (!filters.status || filters.status === 'all' || match.status === filters.status)
    && (!filters.from || match.matchDate >= filters.from)
    && (!filters.to || match.matchDate <= filters.to)
}

export function sortMatchArchive(matches: CloudMatch[], sort: MatchArchiveSort, today = new Date().toISOString().slice(0, 10)) {
  return [...matches].sort((left, right) => {
    if (sort === 'opponent') return normalize(left.opponent).localeCompare(normalize(right.opponent), 'it') || dateTime(right).localeCompare(dateTime(left))
    if (sort === 'oldest') return dateTime(left).localeCompare(dateTime(right))
    if (sort === 'upcoming') {
      const leftUpcoming = left.matchDate >= today && left.status !== 'cancelled'
      const rightUpcoming = right.matchDate >= today && right.status !== 'cancelled'
      if (leftUpcoming !== rightUpcoming) return leftUpcoming ? -1 : 1
      return leftUpcoming ? dateTime(left).localeCompare(dateTime(right)) : dateTime(right).localeCompare(dateTime(left))
    }
    return dateTime(right).localeCompare(dateTime(left))
  })
}

export function paginateMatchArchive(matches: CloudMatch[], page: number, pageSize = 12) {
  const total = matches.length
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const current = Math.min(Math.max(1, page), pages)
  return { matches: matches.slice((current - 1) * pageSize, current * pageSize), total, pages, page: current }
}
