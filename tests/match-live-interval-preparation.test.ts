import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const panel = readFileSync(new URL('../src/components/MatchLivePanel.tsx', import.meta.url), 'utf8')
const engine = readFileSync(new URL('../supabase/migrations/202610180023_match_live_engine.sql', import.meta.url), 'utf8')

describe('interval lineup preparation', () => {
  it('offers keep, planned and manual effective lineup flows', () => {
    expect(panel).toContain('Mantieni attuale')
    expect(panel).toContain('Applica formazione prevista')
    expect(panel).toContain('Modifica manualmente')
    expect(panel).toContain('Conferma formazione effettiva')
    expect(panel).toContain('disabled={!canAct || !intervalConfirmed}')
  })
  it('uses the existing authoritative substitution RPC during intervals', () => {
    expect(panel).toContain('substituteCloudMatchPlayer(match.id, playerOutId, playerInId, id)')
    expect(engine).toContain("state.phase not in ('running','paused','interval')")
    expect(engine).toContain('target_period := state.current_period + 1')
    expect(engine).toContain('event_elapsed := 0')
  })
  it('opens next-period stints only when that period starts', () => {
    expect(engine).toContain("insert into public.match_player_stints(match_id,player_id,period_number,entered_elapsed_seconds) select target.id,player_id,next_period,0")
    const intervalBranch = engine.slice(engine.indexOf("if state.phase <> 'interval'"), engine.indexOf('delete from public.match_live_active_players'))
    expect(intervalBranch.match(/insert into public\.match_player_stints/g)?.length).toBe(1)
  })
})
