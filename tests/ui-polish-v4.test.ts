import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = (path: string) => readFileSync(path, 'utf8')

describe('UI Polish V4', () => {
  it('uses the compact shared control scale instead of oversized rounded controls', () => {
    const ui = source('src/components/ui.tsx')
    const theme = source('src/styles/themes.css')

    expect(ui).toContain("min-h-10 px-3 text-sm")
    expect(ui).toContain("size-10 p-0")
    expect(ui).toContain("gp-control min-h-10")
    expect(ui).toContain("padding?: 'sm' | 'md' | 'lg'")
    expect(theme).toContain('--radius-control: 10px')
    expect(theme).toContain('--radius-card: 14px')
    expect(theme).toContain('--radius-panel: 18px')
  })

  it('keeps Training Hub cards compact and changes to three columns only on wide desktop', () => {
    const page = source('src/pages/TrainingPage.tsx')
    const css = source('src/index.css')

    expect(page).toContain('Card padding="sm" className={`training-archive-card ${view}`}')
    expect(css).toContain('.training-archive-card-main > div > p:last-child { display: -webkit-box')
    expect(css).toContain('@media (min-width: 1280px)')
    expect(css).toContain('.training-archive-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }')
    expect(css).toContain('.training-archive-list .training-archive-card { display: grid;')
  })

  it('keeps the mobile archive toolbar inside a wrapping two-column layout', () => {
    const css = source('src/index.css')
    expect(css).toContain('@media (max-width: 639px)')
    expect(css).toContain('.training-archive-controls { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }')
    expect(css).toContain('.training-archive-controls > :first-child { grid-column: 1 / -1; }')
  })
})
