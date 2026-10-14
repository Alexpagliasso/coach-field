const seasonPattern = /^(\d{4})\/(\d{2})$/

export function formatSeasonName(startYear: number) {
  return `${startYear}/${String((startYear + 1) % 100).padStart(2, '0')}`
}

export function isValidSeason(value: string | undefined | null) {
  const match = value?.trim().match(seasonPattern)
  return Boolean(match && Number(match[2]) === (Number(match[1]) + 1) % 100)
}
