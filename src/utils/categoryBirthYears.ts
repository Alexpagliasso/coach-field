import { FOOTBALL_CATEGORIES, type FootballCategory } from '../data/footballCategories'
import { isValidSeason } from './season'

export type CategoryBirthYearOption = {
  year: number
  kind: 'expected' | 'tolerance'
  label: string
}

export function resolveFootballCategory(teamName: string | undefined) {
  if (!teamName) return undefined
  const normalized = teamName.trim().toLocaleLowerCase('it')
  const matches = FOOTBALL_CATEGORIES.filter(category =>
    category.label.toLocaleLowerCase('it') === normalized
    || `${category.label} · ${category.ageBand}`.toLocaleLowerCase('it') === normalized
    || `${category.label} ${category.ageBand}`.toLocaleLowerCase('it') === normalized)
  return matches.length === 1 ? matches[0] : undefined
}

export function getCategoryBirthYearOptions(seasonName: string | undefined, category: FootballCategory | undefined): CategoryBirthYearOption[] {
  if (!isValidSeason(seasonName) || !category?.ages?.length) return []
  const seasonStart = Number(seasonName?.slice(0, 4))
  const expectedYears = [...new Set(category.ages.map(age => seasonStart - age + 1))].sort((a, b) => a - b)
  const minimum = expectedYears[0] - 1
  const maximum = expectedYears[expectedYears.length - 1] + 1
  return Array.from({ length: maximum - minimum + 1 }, (_, index) => minimum + index).map(year => {
    const expected = expectedYears.includes(year)
    const toleranceDirection = year < expectedYears[0] ? '−1' : '+1'
    return { year, kind: expected ? 'expected' : 'tolerance', label: expected ? `${year} — Annata prevista` : `${year} — Tolleranza (${toleranceDirection})` }
  })
}

export function isAllowedCategoryBirthYear(year: number, options: readonly CategoryBirthYearOption[]) {
  return Number.isInteger(year) && options.some(option => option.year === year)
}
