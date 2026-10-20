import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const app = readFileSync('src/App.tsx', 'utf8')
const repository = readFileSync('src/cloud/familyPublicationsRepository.ts', 'utf8')
const weekly = readFileSync('src/components/WeeklyObjectivesPanel.tsx', 'utf8')
const migration = readFileSync('supabase/migrations/202610200027_family_public_group_links.sql', 'utf8')

describe('GP-15B public WorkGroup family links', () => {
  it('registers a stable UUID route without granting anonymous reads on groups', () => {
    expect(app).toContain('path="/famiglie/:groupId"')
    expect(migration).toContain('security definer')
    expect(migration).toContain("revoke all on function public.get_family_publications_for_group")
    expect(migration).toContain('grant execute on function public.get_family_publications_for_group')
  })

  it('returns only published content for the requested group and its general organization feed', () => {
    expect(migration).toContain("f.status = 'published'")
    expect(migration).toContain('(f.group_id = p_group_id or f.group_id is null)')
    expect(repository).toContain("rpc('get_family_publications_for_group'")
  })

  it('offers a clipboard action with a Safari-compatible fallback', () => {
    expect(weekly).toContain('`/famiglie/${groupId}`')
    expect(weekly).toContain('navigator.clipboard?.writeText')
    expect(weekly).toContain("document.execCommand('copy')")
  })
})
