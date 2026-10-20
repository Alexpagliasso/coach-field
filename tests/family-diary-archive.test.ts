import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const page = readFileSync('src/pages/FamiliesPage.tsx', 'utf8')
const repository = readFileSync('src/cloud/familyPublicationsRepository.ts', 'utf8')

describe('family diary archive', () => {
  it('keeps weekly objectives above the training and match tabs', () => {
    for (const label of ['Obiettivi della settimana', 'Allenamenti', 'Partite', 'Archivio', 'Precedente', 'Successiva']) expect(page).toContain(label)
    expect(page).toContain("type Tab = 'training' | 'match_reflection'")
    expect(page).toContain('type="month"')
    expect(page).toContain('onTouchStart')
    expect(page).toContain('onTouchEnd')
  })

  it('uses real server-side filtering, descending ordering, and page look-ahead', () => {
    expect(repository).toContain("eq('status', 'published')")
    expect(repository).toContain(".in('content_type', filters.contentTypes)")
    expect(repository).toContain(".gte('reference_date'")
    expect(repository).toContain(".or(`title.ilike.%${term}%,public_content.ilike.%${term}%`)")
    expect(repository).toContain("order('reference_date', { ascending: false })")
    expect(repository).toContain('.range(page * pageSize, page * pageSize + pageSize)')
  })
})
