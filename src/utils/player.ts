import type { Player, PlayerRole, PlayerYear } from '../types/domain'

export const roleOptions: Array<{ id: PlayerRole; label: string }> = [
  { id: 'POR', label: 'Portiere' },
  { id: 'DIF', label: 'Difensore' },
  { id: 'CEN', label: 'Centrocampista' },
  { id: 'ATT', label: 'Attaccante' },
  { id: 'JOLLY', label: 'Jolly' },
]

export const roleLabelByCode = roleOptions.reduce<Record<PlayerRole, string>>((acc, role) => {
  acc[role.id] = role.label
  return acc
}, {} as Record<PlayerRole, string>)

export function formatPlayerYear(year: PlayerYear) {
  return year === 'other' ? 'Altro' : String(year)
}

export function formatPlayerAge(year: PlayerYear) {
  if (year === 2016) return '9-10 anni'
  if (year === 2017) return '8-9 anni'
  return 'eta da verificare'
}

export function sortYearValue(year: PlayerYear) {
  if (year === 2016) return 2016
  if (year === 2017) return 2017
  return 9999
}

export function normalizePlayerText(value: string) {
  return value.trim().toLocaleLowerCase('it-IT')
}

export function hasSameIdentity(a: Pick<Player, 'firstName' | 'lastName' | 'year'>, b: Pick<Player, 'firstName' | 'lastName' | 'year'>) {
  return (
    normalizePlayerText(a.firstName) === normalizePlayerText(b.firstName) &&
    normalizePlayerText(a.lastName) === normalizePlayerText(b.lastName) &&
    a.year === b.year
  )
}
