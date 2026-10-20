import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync('supabase/migrations/202610200025_family_publications.sql', 'utf8')
const repository = readFileSync('src/cloud/familyPublicationsRepository.ts', 'utf8')
const training = readFileSync('src/pages/TrainingPage.tsx', 'utf8')
const match = readFileSync('src/pages/MatchDetailPage.tsx', 'utf8')

describe('family publications boundary', () => {
  it('grants anonymous reads only to published, independent content', () => {
    expect(migration).toContain("content_type in ('training', 'objective', 'match_reflection')")
    expect(migration).toContain("status in ('draft', 'published')")
    expect(migration).toContain("using (status = 'published')")
    expect(migration).toContain('private.is_admin(organization_id)')
    expect(migration).not.toContain('training_sessions')
    expect(migration).not.toContain('match_callups')
  })
  it('keeps the public query limited to public fields and publication controls admin-only', () => {
    expect(repository).toContain("const publicFields = 'content_type,title,public_content,reference_date,published_at,group_id'")
    expect(training).toContain('{isAdmin && <>')
    expect(match).toContain('{isAdmin && <Button')
  })
})
