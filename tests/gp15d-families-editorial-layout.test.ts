import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const page = readFileSync('src/pages/FamiliesPage.tsx', 'utf8')
const styles = readFileSync('src/index.css', 'utf8')

describe('GP-15D family diary editorial layout', () => {
  it('keeps weekly objectives fully visible instead of expandable', () => {
    expect(page).toContain('function PublicObjective')
    expect(page).toContain('{item.publicContent}</p>')
    expect(page).not.toContain('prefix="objective"')
  })

  it('applies the required accessible week navigation states', () => {
    expect(page).toContain('aria-disabled={weekOffset === 0}')
    expect(page).toContain('aria-disabled={weekOffset === 2}')
    expect(page).toContain('aria-label="Settimana successiva" onClick={() => changeWeek(-1)}')
    expect(page).toContain('aria-label="Settimana precedente" onClick={() => changeWeek(1)}')
    expect(styles).toContain('.families-week-nav .gp-button:disabled')
  })

  it('uses the editorial palette and a two-column desktop layout', () => {
    expect(styles).toContain('--family-bg: #f5f4f0')
    expect(styles).toContain('--family-violet: #6b43a1')
    expect(styles).toContain('--family-training-text: #21754d')
    expect(styles).toContain('--family-match-text: #b94e28')
    expect(styles).toContain('grid-template-columns: minmax(20rem, 38%) minmax(0, 62%)')
  })
})
