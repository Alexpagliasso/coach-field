import { describe, expect, it } from 'vitest'
import { assignPeriodPlayer, changePeriodFormation, copyPeriodDraft, createPeriodDrafts, plannedPeriodsForPlayer, removePeriodPlayer } from '../src/utils/matchPeriodLineups'

const entry = (playerId: string, slotId: string) => ({ playerId, slotId, positionX: 50, positionY: 50 })

describe('period lineup functional state', () => {
  it('assigns, replaces, moves and removes players without duplicates', () => {
    let drafts = createPeriodDrafts(4, '3-2-1', [])
    drafts = assignPeriodPlayer(drafts, 1, entry('p1', 'goalkeeper'))
    drafts = assignPeriodPlayer(drafts, 1, entry('p2', 'goalkeeper'))
    expect(drafts[1].entries).toEqual([entry('p2', 'goalkeeper')])
    drafts = assignPeriodPlayer(drafts, 1, entry('p2', 'forward'))
    expect(drafts[1].entries).toEqual([entry('p2', 'forward')])
    drafts = removePeriodPlayer(drafts, 1, 'forward')
    expect(drafts[1].entries).toEqual([])
  })

  it('copies independently, changes only the target module and updates planned counts', () => {
    let drafts = createPeriodDrafts(4, '3-2-1', [])
    drafts = assignPeriodPlayer(drafts, 1, entry('p1', 'goalkeeper'))
    drafts = assignPeriodPlayer(drafts, 1, entry('p2', 'defender-center'))
    drafts = copyPeriodDraft(drafts, 1, 2)
    drafts = assignPeriodPlayer(drafts, 2, entry('p3', 'forward'))
    drafts = changePeriodFormation(drafts, 2, '2-3-1', new Set(['goalkeeper','defender-left','defender-right','midfielder-left','midfielder-center','midfielder-right','forward']))
    expect(drafts[1].formation).toBe('3-2-1')
    expect(drafts[1].entries.map(item => item.playerId)).toEqual(['p1', 'p2'])
    expect(drafts[2].formation).toBe('2-3-1')
    expect(drafts[2].entries.map(item => item.playerId)).toEqual(['p1', 'p3'])
    expect(plannedPeriodsForPlayer(drafts, 'p1')).toBe(2)
  })
})
