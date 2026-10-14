import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = (path: string) => readFileSync(path, 'utf8')
const sheet = source('src/components/TrainingAttendanceSheet.tsx')
const today = source('src/pages/TodayPage.tsx')
const training = source('src/pages/TrainingPage.tsx')

describe('cloud attendance interface', () => {
  it('loads the cloud roster and creates an all-present draft without saving it', () => {
    expect(sheet).toContain('getTrainingRollCall(session.id, session.groupId)')
    expect(sheet).toContain("entry.attendance?.status ?? (saved ? undefined : 'present')")
    expect(sheet).toContain("'present'")
    expect(sheet).toContain("'absent'")
    expect(sheet).toContain("'excused'")
    expect(sheet).toContain('Conferma presenze')
  })

  it('distinguishes excused and unexcused absence, and persists only confirmed drafts through the cloud repository', () => {
    expect(sheet).toContain('Assente giustificata')
    expect(sheet).toContain('Assente non giustificata')
    expect(sheet).toContain('Giustificata')
    expect(sheet).toContain('saveTrainingAttendanceBatch(session.id, session.organizationId')
    expect(sheet).toContain('Tutti presenti')
    expect(sheet).toContain('Riprova')
  })

  it('supports session changes, stale requests, and a dirty-draft close guard', () => {
    expect(sheet).toContain('const sequence = useRef(0)')
    expect(sheet).toContain('if (current !== sequence.current) return')
    expect(sheet).toContain('[markDirty, onSummaryChange, session.groupId, session.id]')
    expect(sheet).toContain('Ci sono modifiche non confermate')
  })

  it('exposes the selected TodayPage cloud session to attendance', () => {
    expect(today).toContain('<TrainingAttendanceSheet')
    expect(today).toContain('session={{...selected,groupId:selected.groupId,organizationId:selected.organizationId}}')
    expect(today).toContain('setAttendanceOpen(true)')
    expect(today).not.toContain('getCurrentSession(')
    expect(today).not.toContain('getAppState(')
  })

  it('mounts attendance in the dedicated cloud-session detail route', () => {
    expect(training).toContain('function TrainingSessionDetail')
    expect(training).toContain('aria-labelledby="attendance-panel-title"')
    expect(training).toContain('<TrainingAttendanceSheet embedded open')
    expect(training).toContain('onDirtyChange={setAttendanceDirty}')
    expect(training).toContain('session={session}')
    expect(training).toContain('Ci sono modifiche alle presenze non confermate')
    expect(training).toContain('navigate(`/app/${groupId ?? activeGroup.id}/training/${session.id}`)')
    expect(training).not.toContain('TrainingAttendanceLauncher')
    expect(training).not.toContain('getCurrentSession(')
    expect(training).not.toContain('getAppState(')
  })

  it('has no local attendance or IndexedDB dependency', () => {
    expect(sheet).not.toContain('IndexedDB')
    expect(sheet).not.toContain('getCurrentSession(')
    expect(sheet).not.toContain('getAppState(')
  })
})
