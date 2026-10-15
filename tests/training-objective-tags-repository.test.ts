import { describe, expect, it } from 'vitest'
import { aggregateTrainingObjectiveTags } from '../src/cloud/trainingObjectiveTagsRepository'

const tag = (id: string, name: string) => ({ id, organizationId: 'org', name, slug: name.toLowerCase(), createdAt: '2026-01-01', active: true as const })

describe('training objective tag aggregation', () => {
  it('keeps an empty catalog and aggregates only associations from the selected WorkGroup query', () => {
    expect(aggregateTrainingObjectiveTags([])).toEqual([])
    expect(aggregateTrainingObjectiveTags([{ sessionId: 's1', tag: tag('a', 'Passaggio') }, { sessionId: 's2', tag: tag('a', 'Passaggio') }, { sessionId: 's2', tag: tag('b', 'Pressing') }])).toEqual([
      { ...tag('a', 'Passaggio'), count: 2 }, { ...tag('b', 'Pressing'), count: 1 },
    ])
  })
})
