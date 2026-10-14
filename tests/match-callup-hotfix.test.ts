import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const panel = readFileSync('src/components/MatchCallupsPanel.tsx', 'utf8')
const repository = readFileSync('src/cloud/matchCloudRepository.ts', 'utf8')
const migration = readFileSync('supabase/migrations/202610100016_match_callup_candidates.sql', 'utf8')

describe('match call-up hotfix', () => {
  it('uses only the authorized cloud candidate RPC, never a local or all-player selector', () => {
    expect(panel).toContain('getCloudMatchCallupCandidates(match.id)')
    expect(panel).not.toContain('getAggregatablePlayers')
    expect(panel).not.toContain('getPlayers(')
    expect(panel).not.toContain('IndexedDB')
    expect(repository).toContain("rpc('list_match_callup_candidates'")
  })

  it('deduplicates participants and candidates by cloud UUID, not name', () => {
    expect(panel).toContain('new Map<string, Participant>()')
    expect(panel).toContain('byPlayerId.set(player.id')
    expect(panel).toContain('new Map<string, CloudMatchCallupCandidate>()')
    expect(panel).not.toContain('firstName ===')
    expect(panel).toContain('WorkGroup: {candidate.sourceGroupName}')
  })

  it('keeps cross-WorkGroup selection secure and snapshots its source group in SQL', () => {
    expect(migration).toContain('private.has_match_permission(target.group_id, \'matches.edit\')')
    expect(migration).toContain("new.source := 'guest'")
    expect(migration).toContain('new.source_group_id := current_group')
    expect(migration).toContain('Player is not an active WorkGroup player in this organization')
  })

  it('keeps Supabase errors visible to the coach', () => {
    expect(panel).toContain('errorMessage(reason)')
    expect(panel).toContain('Convocazione non riuscita:')
    expect(panel).toContain('>Riprova</Button>')
  })

})
