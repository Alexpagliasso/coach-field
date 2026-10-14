import { describe, expect, it } from 'vitest'
import { isHistory, isPlanned, matchesTrainingHubFilter, seasonBounds } from '../src/utils/trainingFilters'

describe('training hub filters', () => {
  const today = '2026-10-09'
  it('keeps future uncompleted sessions in programma', () => expect(isPlanned({ status: 'planned', sessionDate: '2026-10-10' }, today)).toBe(true))
  it('puts an uncompleted past session in storico without changing its status', () => { const session = { status: 'planned' as const, sessionDate: '2026-10-08' }; expect(isHistory(session, today)).toBe(true); expect(isPlanned(session, today)).toBe(false) })
  it('includes completed sessions in storico regardless of date', () => expect(matchesTrainingHubFilter({ status: 'completed', sessionDate: '2026-10-10' }, 'history', today)).toBe(true))
  it('derives a season interval from context', () => expect(seasonBounds('2026/2027')).toEqual({ from: '2026-07-01', to: '2027-06-30' }))
})
