import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { APP_THEMES, readStoredTheme } from '../src/theme'

const source = (path: string) => readFileSync(path, 'utf8')

describe('GP-UX-01 design system', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('offers four distinct themes and safely migrates legacy preferences', () => {
    expect(APP_THEMES.map(({ id }) => id)).toEqual(['sage', 'lavender', 'sand', 'midnight'])
    for (const [stored, expected] of [['light', 'sage'], ['pitch', 'midnight'], ['electric', 'midnight'], ['purple', 'lavender'], ['ice', 'lavender']] as const) {
      vi.stubGlobal('window', { localStorage: { getItem: () => stored } })
      expect(readStoredTheme()).toBe(expected)
    }
  })

  it('defines semantic palettes, shared scale and theme previews', () => {
    const themes = source('src/styles/themes.css')
    const css = source('src/index.css')
    for (const id of ['sage', 'lavender', 'sand', 'midnight']) {
      expect(themes).toContain(`[data-theme='${id}']`)
      expect(css).toContain(`.theme-preview-${id}`)
    }
    for (const token of ['--surface:', '--text-primary:', '--focus-ring:', '--chart-1:', '--radius-card:', '--font-editorial:']) expect(themes).toContain(token)
  })

  it('preserves permission-gated Staff and the mobile Live entry point', () => {
    const layout = source('src/components/Layout.tsx')
    expect(layout).toContain("{isAdmin && <NavLink to=\"/staff\"")
    expect(layout).toContain('className="matchday-resume"')
    expect(layout).toContain('className="mobile-command-nav"')
    expect(layout).toContain("can('group.settings')")
  })
})
