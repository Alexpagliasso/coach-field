import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = (path: string) => readFileSync(path, 'utf8')

describe('V6 category roster and exercise library', () => {
  it('keeps category membership as the full roster while presenting WorkGroups first', () => {
    const page = source('src/pages/WorkGroupHubPage.tsx')
    const roster = source('src/components/CategoryRoster.tsx')
    const styles = source('src/index.css')
    expect(page).toContain('getTeamRoster(teamId)')
    expect(page).toContain('getActiveGroupAssignments(teamId)')
    expect(page).toContain('category-workgroups-section')
    expect(page).toContain('category-roster-section')
    expect(page).toContain("groupId === group.id && item.status === 'active'")
    expect(roster).toContain('Non assegnato')
    expect(styles).toContain('.workgroup-command-hub > .category-workgroups-section { order: 1; }')
  })

  it('paginates the complete filtered exercise dataset at twelve items and resets page on filters', () => {
    const library = source('src/pages/ExerciseLibraryPage.tsx')
    expect(library).toContain('const pageSize = 12')
    expect(library).toContain('const paged = filtered.slice')
    expect(library).toContain('useEffect(() => { setPage(1) }, [query, category, objective, playerCount, view])')
    expect(library).toContain('exercise-library-pagination')
    expect(library).toContain('{paged.map(item =>')
  })
})
