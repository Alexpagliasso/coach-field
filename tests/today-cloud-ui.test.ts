import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { CloudTrainingSession } from '../src/cloud/trainingCloudRepository'
import { firstTodaySession, isCurrentTodayRequest, todaySessionPageOptions } from '../src/utils/todaySessions'

const source = readFileSync(new URL('../src/pages/TodayPage.tsx', import.meta.url), 'utf8')

const session = (id: string, status: 'planned' | 'completed' = 'planned') => ({
  id,
  status,
  title: `Seduta ${id}`,
  sessionDate: '2026-10-09',
  plannedDurationMinutes: 75,
  exercises: [],
}) as CloudTrainingSession

describe('TodayPage cloud sessions', () => {
  it('queries only the local current date and selects the only returned session', () => {
    expect(todaySessionPageOptions('2026-10-09')).toEqual({
      page: 1, pageSize: 50, from: '2026-10-09', to: '2026-10-09',
    })
    expect(firstTodaySession([session('one')])?.id).toBe('one')
  })

  it('supports more than one cloud session and selects the requested item', () => {
    const sessions = [session('first'), session('second')]
    expect(firstTodaySession(sessions)?.id).toBe('first')
    expect(sessions.find(item => item.id === 'second')?.title).toBe('Seduta second')
    expect(source).toContain('sessions.length>1')
    expect(source).toContain('onClick={()=>setSelected(session)}')
  })

  it('renders a clear empty state with a Training Hub link', () => {
    expect(firstTodaySession([])).toBeUndefined()
    expect(source).toContain('Nessun allenamento oggi')
    expect(source).toContain('to="/training"')
  })

  it('keeps completed sessions visible and labels their status', () => {
    expect(firstTodaySession([session('completed', 'completed')])?.status).toBe('completed')
    expect(source).toContain("selected.status==='completed'?'Completato':'Programmato'")
  })

  it('links the selected cloud session to its actual Training Hub deep-link', () => {
    expect(source).toContain('to={`/training?session=${selected.id}`}')
  })

  it('does not use IndexedDB or the legacy current-session selector for today training', () => {
    expect(source).toContain('getCloudTrainingSessionPage')
    expect(source).not.toContain('getCurrentSession')
    expect(source).not.toContain('getAppState')
    expect(source).not.toMatch(/from ['"].*\/(db|repositories)\//)
  })

  it('rejects obsolete responses after a WorkGroup or retry request', () => {
    expect(isCurrentTodayRequest(2, 2)).toBe(true)
    expect(isCurrentTodayRequest(1, 2)).toBe(false)
    expect(source).toContain('setSessions([]);setSelected(undefined)')
    expect(source).toContain('isCurrentTodayRequest(current,request.current)')
    expect(source).toContain('[activeGroup?.id,today]')
  })

  it('surfaces a Supabase error and provides retry', () => {
    expect(source).toContain('<ErrorState message={error}')
    expect(source).toContain('>Riprova</Button>')
  })
})
