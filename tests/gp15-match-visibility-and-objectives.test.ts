import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync('supabase/migrations/202610200026_match_visibility_and_group_family_publications.sql', 'utf8')
const migrationSql = migration.toLowerCase()
const matches = readFileSync('src/cloud/matchCloudRepository.ts', 'utf8')
const metrics = readFileSync('src/cloud/playerCloudRepository.ts', 'utf8')
const weekly = readFileSync('src/components/WeeklyObjectivesPanel.tsx', 'utf8')
const families = readFileSync('src/pages/FamiliesPage.tsx', 'utf8')

describe('GP-15 match visibility and WorkGroup objectives', () => {
  it('keeps hidden matches persisted while excluding them from ordinary match queries and player totals', () => {
    expect(migrationSql).toContain('add column if not exists is_hidden boolean not null default false')
    expect(migrationSql).toContain('guard_match_visibility_change')
    expect(matches).toContain("options.visibility ?? 'visible'")
    expect(matches).toContain("request = request.eq('is_hidden', false)")
    expect(metrics).toContain(".eq('is_hidden', false)")
    expect(metrics).toContain('items.filter(item => !item.matchHidden)')
  })

  it('uses a composite group and organization foreign key and scopes weekly objectives to the active WorkGroup', () => {
    expect(migrationSql).toContain('foreign key (group_id, organization_id)')
    expect(migrationSql).toContain('references public.groups(id, organization_id)')
    expect(weekly).toContain('item.groupId === groupId')
    expect(weekly).toContain("groupId, referenceDate")
    expect(families).toContain('groupId: groupScope')
    expect(families).toContain('Percorso {index + 1}')
  })

  it('does not broaden anonymous reading beyond published family content', () => {
    expect(migrationSql).toContain('grant select (group_id) on public.family_publications to anon')
    expect(migrationSql).toContain('published-only rls remains unchanged')
  })
})
