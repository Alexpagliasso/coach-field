import { describe, expect, it } from 'vitest'
import { sortAgendaEventsNewestFirst } from '../src/pages/CalendarPage'

const item = (id: string, date: string, time: string | undefined, type: 'training' | 'match' = 'training') => ({ id, date, time, type, title: id, to: `/${id}` })

describe('calendar agenda ordering', () => {
  it('orders newest date and time first', () => {
    const result = sortAgendaEventsNewestFirst([item('old', '2026-11-10', '18:00'), item('latest', '2026-11-12', '20:00'), item('morning', '2026-11-12', '09:00')])
    expect(result.map(event => event.id)).toEqual(['latest', 'morning', 'old'])
  })
  it('uses a deterministic type and id tie-break without mutating input', () => {
    const input = [item('z', '2026-11-12', '18:00'), item('b', '2026-11-12', '18:00', 'match'), item('a', '2026-11-12', '18:00', 'match')]
    expect(sortAgendaEventsNewestFirst(input).map(event => event.id)).toEqual(['a', 'b', 'z'])
    expect(input.map(event => event.id)).toEqual(['z', 'b', 'a'])
  })
})
