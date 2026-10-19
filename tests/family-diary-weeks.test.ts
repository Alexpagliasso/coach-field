import { describe, expect, it } from 'vitest'
import { addWeeks, nextWeek, weekStart } from '../src/utils/familyDiaryWeeks'

describe('family diary weeks', () => {
  it('normalizes every objective reference to Monday', () => {
    expect(weekStart('2026-10-21')).toBe('2026-10-19')
    expect(weekStart('2026-10-19')).toBe('2026-10-19')
  })

  it('keeps week ranges correct across month and year boundaries', () => {
    expect(nextWeek('2026-12-28')).toBe('2027-01-04')
    expect(addWeeks('2027-01-04', -1)).toBe('2026-12-28')
  })
})
