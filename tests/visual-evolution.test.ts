import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = (path: string) => readFileSync(path, 'utf8')
const login = source('src/pages/AccessPages.tsx')
const players = source('src/pages/PlayersPage.tsx')
const styles = source('src/index.css')

describe('Visual Evolution V1', () => {
  it('keeps the existing Auth login action while supplying an editorial login composition', () => {
    expect(login).toContain('auth.signIn(')
    expect(login).toContain('className="login-experience"')
    expect(login).toContain('<TacticalBackdrop')
    expect(styles).toContain('.login-experience')
    expect(styles).toContain('@media (min-width: 900px)')
  })

  it('preserves field mode and makes its narrow-screen consultation surface reachable', () => {
    const training = source('src/pages/TrainingPage.tsx')
    expect(training).toContain('id="field-mode-title"')
    expect(training).toContain('Modalità campo')
    expect(styles).toContain('.add-player-sheet:has(#field-mode-title)')
  })

  it('shares the same sorting state between desktop headers and the compact mobile control', () => {
    expect(players).toContain('sortWorkGroupRoster(')
    expect(players).toContain('players-mobile-sort')
    expect(players).toContain('aria-sort={ariaSort}')
    expect(players).toContain('nextPlayerSort(current, key)')
  })
})
