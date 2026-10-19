import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const app = readFileSync('src/App.tsx', 'utf8')
const page = readFileSync('src/pages/FamiliesPage.tsx', 'utf8')

describe('public family area', () => {
  it('exposes the family route outside the authenticated application', () => {
    expect(app).toContain('path="/famiglie" element={<FamiliesPage />}')
    expect(app.indexOf('path="/famiglie"')).toBeLessThan(app.indexOf('<Route element={<ProtectedRoute />}'))
  })

  it('uses only the dedicated published-content repository, never private application contexts', () => {
    for (const term of ['useGroup', 'useAuth', 'players', 'attendance', 'profiles', 'organizations', 'trainingCloudRepository', 'matchCloudRepository']) expect(page).not.toContain(term)
    expect(page).toContain('getPublishedFamilyPublicationPage')
    expect(page).toContain('Diario dal campo')
    expect(page).toContain('Obiettivi della settimana')
  })
})
