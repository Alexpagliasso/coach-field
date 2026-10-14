import type { WorkGroupPlayerSummary, WorkGroupRosterEntry } from '../cloud/playerCloudRepository'

export type PlayerSortKey = 'name' | 'role' | 'rating' | 'trainings' | 'callups' | 'matchesPlayed'
export type PlayerSortDirection = 'asc' | 'desc'
export type PlayerSort = { key: PlayerSortKey; direction: PlayerSortDirection } | undefined

export const playerSortLabels: Record<PlayerSortKey, string> = {
  name: 'Giocatore',
  role: 'Ruolo',
  rating: 'Valutazione',
  trainings: 'Allenamenti',
  callups: 'Convocazioni',
  matchesPlayed: 'Partite giocate',
}

const collator = new Intl.Collator('it', { sensitivity: 'base', numeric: true })

function valueFor(entry: WorkGroupRosterEntry, summary: WorkGroupPlayerSummary | undefined, key: PlayerSortKey): string | number | null {
  switch (key) {
    case 'name': return `${entry.player.lastName} ${entry.player.firstName}`.trim() || null
    case 'role': return entry.player.preferredRole?.trim() || null
    case 'rating': return entry.player.technicalRating ?? null
    case 'trainings': return summary ? summary.trainingPresent : null
    case 'callups': return summary ? summary.callups : null
    case 'matchesPlayed': return summary ? summary.matchesPlayed : null
  }
}

/** Shared desktop/mobile sort: null values stay last and equal values retain roster order. */
export function sortWorkGroupRoster(entries: WorkGroupRosterEntry[], summaries: Map<string, WorkGroupPlayerSummary>, sort: PlayerSort): WorkGroupRosterEntry[] {
  if (!sort) return [...entries]
  return entries
    .map((entry, index) => ({ entry, index, value: valueFor(entry, summaries.get(entry.player.id), sort.key) }))
    .sort((left, right) => {
      if (left.value === null && right.value === null) return left.index - right.index
      if (left.value === null) return 1
      if (right.value === null) return -1
      const comparison = typeof left.value === 'number' && typeof right.value === 'number'
        ? left.value - right.value
        : collator.compare(String(left.value), String(right.value))
      return comparison === 0 ? left.index - right.index : (sort.direction === 'asc' ? comparison : -comparison)
    })
    .map(({ entry }) => entry)
}

export function nextPlayerSort(current: PlayerSort, key: PlayerSortKey): PlayerSort {
  if (current?.key !== key) return { key, direction: 'asc' }
  if (current.direction === 'asc') return { key, direction: 'desc' }
  return undefined
}
