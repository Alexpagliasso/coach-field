import { describe, expect, it } from 'vitest'
import { FOOTBALL_CATEGORIES } from '../src/data/footballCategories'
import { getCategoryBirthYearOptions, isAllowedCategoryBirthYear, resolveFootballCategory } from '../src/utils/categoryBirthYears'

const category = (code: string) => FOOTBALL_CATEGORIES.find(item => item.code === code)
const years = (season: string, code: string) => getCategoryBirthYearOptions(season, category(code)).map(option => option.year)

describe('category birth-year rules', () => {
  it('calculates single-age Pulcini ranges with one year of tolerance', () => {
    expect(years('2026/27', 'pulcini_u10')).toEqual([2016, 2017, 2018])
    expect(years('2026/27', 'pulcini_u11')).toEqual([2015, 2016, 2017])
  })

  it('calculates mixed-category expected years and outer tolerance', () => {
    const options = getCategoryBirthYearOptions('2026/27', category('pulcini_misti'))
    expect(options.map(option => option.year)).toEqual([2015, 2016, 2017, 2018])
    expect(options.filter(option => option.kind === 'expected').map(option => option.year)).toEqual([2016, 2017])
  })

  it('shifts the allowed years when the season changes', () => {
    expect(years('2027/28', 'pulcini_u10')).toEqual([2017, 2018, 2019])
  })

  it('rejects years outside the calculated interval', () => {
    const options = getCategoryBirthYearOptions('2026/27', category('pulcini_misti'))
    expect(isAllowedCategoryBirthYear(2015, options)).toBe(true)
    expect(isAllowedCategoryBirthYear(2014, options)).toBe(false)
    expect(isAllowedCategoryBirthYear(2019, options)).toBe(false)
  })

  it('does not invent rules for senior or ambiguous stored category names', () => {
    expect(getCategoryBirthYearOptions('2026/27', category('prima_squadra'))).toEqual([])
    expect(resolveFootballCategory('Pulcini')).toBeUndefined()
    expect(resolveFootballCategory('Pulcini · U10')?.code).toBe('pulcini_u10')
  })
})
