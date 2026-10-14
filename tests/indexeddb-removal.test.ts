import { readFileSync, existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const app = readFileSync('src/App.tsx', 'utf8')
const layout = readFileSync('src/components/Layout.tsx', 'utf8')
const packageJson = readFileSync('package.json', 'utf8')

describe('cloud-only active application graph', () => {
  it('removes the IndexedDB package and legacy source directory from the application', () => {
    expect(packageJson).not.toContain('"idb"')
    expect(packageJson).not.toContain('fake-indexeddb')
    expect(existsSync('src/db')).toBe(false)
  })

  it('redirects retired sports routes without rendering legacy pages', () => {
    for (const page of ['GoalkeepersPage', 'NotesPage', 'PlayerDetailPage', 'TrainingSessionDetailPage', 'LocalDataGuard']) expect(app).not.toContain(page)
    expect(app).toContain('<LegacyGroupRedirect to="players" />')
    expect(app).toContain('<LegacyGroupRedirect to="training" />')
    expect(layout).not.toContain("to: '/goalkeepers'")
    expect(layout).not.toContain("to: '/notes'")
  })

  it('keeps only UI preferences in localStorage; sports data uses cloud repositories', () => {
    const theme = readFileSync('src/theme.ts', 'utf8')
    expect(theme).toContain('THEME_STORAGE_KEY')
    expect(theme).not.toContain('players')
    expect(app).toContain('GroupDashboardPage')
    expect(app).toContain('TrainingPage')
    expect(app).toContain('MatchesPage')
  })
})
