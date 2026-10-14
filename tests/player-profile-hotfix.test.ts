import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const modal = readFileSync('src/components/PlayerProfileModal.tsx', 'utf8')
const css = readFileSync('src/index.css', 'utf8')
const sql = readFileSync('supabase/migrations/202610120018_player_profile_player_columns_grant.sql', 'utf8')

describe('player profile hotfix', () => {
  it('keeps Supabase diagnostics visible for rejected profile writes', () => {
    expect(modal).toContain('cause.code')
    expect(modal).toContain('cause.details')
    expect(modal).toContain('grant UPDATE sulle colonne profilo')
    expect(sql).toContain('grant update (preferred_role, technical_rating) on public.players to authenticated')
  })
  it('uses a compact, centered, viewport-bounded profile dialog', () => {
    expect(css).toContain('.add-player-sheet:has(#player-profile-title)')
    expect(css).toContain('height: auto')
    expect(css).toContain('max-height: calc(100dvh')
    expect(css).toContain('overflow-y: auto')
    expect(css).toContain('safe-area-inset-top')
  })
})
