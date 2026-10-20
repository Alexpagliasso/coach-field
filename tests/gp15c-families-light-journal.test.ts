import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const page = readFileSync('src/pages/FamiliesPage.tsx', 'utf8')
const styles = readFileSync('src/index.css', 'utf8')

describe('GP-15C public family diary', () => {
  it('uses the required week navigation convention for buttons and swipe', () => {
    expect(page).toContain('aria-label="Settimana successiva" onClick={() => changeWeek(-1)}><ChevronLeft')
    expect(page).toContain('aria-label="Settimana precedente" onClick={() => changeWeek(1)}><ChevronRight')
    expect(page).toContain('changeWeek(distance < 0 ? 1 : -1)')
  })

  it('keeps the public view in its dedicated light palette', () => {
    expect(page).toContain('families-page-light')
    expect(styles).toContain('--family-bg: #f8f8f4')
    expect(styles).toContain('--family-violet: #7351a6')
    expect(styles).toContain('--family-training-bg: #e6f1e8')
    expect(styles).toContain('--family-match-bg: #fbece4')
  })
})
