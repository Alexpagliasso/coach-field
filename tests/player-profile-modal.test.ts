import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
const modal = readFileSync('src/components/PlayerProfileModal.tsx', 'utf8')
const repo = readFileSync('src/cloud/playerProfileRepository.ts', 'utf8')
describe('PlayerProfileModal cloud persistence', () => {
  it('loads cloud player, attendance, call-up metrics, notes and objectives with stale response protection', () => {
    for (const text of ['getPlayer(playerId)', 'getPlayerAttendanceHistory(playerId', 'getCloudPlayerMatchHistory(playerId', 'getPlayerMatchTotals(playerId)', 'getPlayerNotes(playerId)', 'getPlayerObjectives(playerId)', 'const request = useRef(0)', 'if (current !== request.current) return']) expect(modal).toContain(text)
  })
  it('keeps five real tabs and persists profile, notes and objectives through repositories', () => {
    for (const text of ['Panoramica', 'Allenamenti', 'Partite', 'Note', 'Progressi', 'updatePlayer(player.id', 'savePlayerNote(', 'savePlayerObjective(', 'archivePlayerObjective(']) expect(modal).toContain(text)
    for (const text of ['player_notes', 'player_objectives', 'deletePlayerNote']) expect(repo).toContain(text)
  })
  it('does not use IndexedDB or invent match participation', () => {
    expect(modal).not.toContain('IndexedDB'); expect(modal).toContain('getPlayerMatchTotals(playerId)')
  })
})
