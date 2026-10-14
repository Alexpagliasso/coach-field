import { describe, expect, it } from 'vitest'
import { localDateKey, mondayFirstOffset } from '../src/utils/calendar'

describe('calendar presentation helpers', () => {
  it('aligns Monday to the first column and Sunday to the seventh', () => {
    expect(mondayFirstOffset(new Date(2026, 9, 5))).toBe(0)
    expect(mondayFirstOffset(new Date(2026, 9, 11))).toBe(6)
  })

  it('formats the local day without UTC conversion', () => {
    expect(localDateKey(new Date(2026, 9, 8, 0, 5))).toBe('2026-10-08')
  })
})
