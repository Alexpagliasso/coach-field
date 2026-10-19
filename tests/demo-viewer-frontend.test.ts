import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const app = readFileSync('src/App.tsx', 'utf8')
const welcome = readFileSync('src/pages/DemoWelcomePage.tsx', 'utf8')
const organizationHub = readFileSync('src/pages/OrganizationHubPage.tsx', 'utf8')
const layout = readFileSync('src/components/Layout.tsx', 'utf8')
const fieldMode = readFileSync('src/components/FieldModeExperience.tsx', 'utf8')
const attendance = readFileSync('src/components/TrainingAttendanceSheet.tsx', 'utf8')
const profile = readFileSync('src/components/PlayerProfileModal.tsx', 'utf8')

describe('Demo Viewer frontend', () => {
  it('keeps the demo entry point authenticated and routes viewers to it', () => {
    expect(app).toContain('path="/app/demo" element={<DemoWelcomePage />}')
    expect(organizationHub).toContain('return <Navigate to="/app/demo" replace />')
    expect(welcome).toContain("item.role === 'demo_viewer'")
    expect(welcome).toContain('getWorkGroupRoster')
    expect(welcome).toContain('getCloudTrainingSessionPage')
    expect(welcome).toContain('getCloudMatchPage')
  })

  it('labels the active workspace as read-only', () => {
    expect(layout).toContain('Demo · Sola lettura')
    expect(welcome).toContain('Dati inventati')
  })

  it('does not expose write controls in Field Mode, attendance, or player profiles', () => {
    expect(fieldMode).toContain('disabled={isDemoViewer}')
    expect(fieldMode).toContain('isDemoViewer || !draft.trim()')
    expect(attendance).toContain("const editable = can('attendance.edit')")
    expect(attendance).toContain('{editable && <div className="sticky bottom-0')
    expect(profile).toContain('readonly={isDemoViewer}')
    expect(profile).toContain('disabled={saving || isDemoViewer}')
    expect(profile).toContain('{!isDemoViewer && <Button size="sm" variant="danger"')
  })
})
