import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const layout = readFileSync('src/components/Layout.tsx', 'utf8')
const families = readFileSync('src/pages/FamiliesPage.tsx', 'utf8')
const styles = readFileSync('src/index.css', 'utf8')
const app = readFileSync('src/App.tsx', 'utf8')

describe('GP-16B selectors, archive pagination and Staff availability', () => {
  it('uses an accessible WorkGroup listbox instead of the constrained native select', () => {
    expect(layout).toContain('function WorkGroupSwitcher')
    expect(layout).toContain('role="listbox"')
    expect(layout).toContain("event.key === 'Escape'")
    expect(layout).toContain("event.key === 'ArrowDown'")
    expect(styles).toContain('.workgroup-switcher-menu')
  })

  it('keeps weekly content complete and paginates only the archive in groups of five', () => {
    expect(families).toContain('const archivePageSize = 5')
    expect(families).toContain('const weeklyContentPageSize = 100')
    expect(families).toContain('}), 0, weeklyContentPageSize)')
    expect(families).not.toContain('contentPage')
    expect(families).toContain('families-archive-pagination')
    expect(families).toContain('disabled={!archiveHasMore || archiveLoading}')
  })

  it('keeps Staff visible but unavailable without a navigable sidebar link', () => {
    expect(layout).toContain('app-nav-link app-nav-link-disabled')
    expect(layout).toContain('aria-disabled="true"')
    expect(layout).toContain('Prossimamente')
    expect(layout).not.toContain("{ to: '/staff', label: 'Staff', icon: Users }")
    expect(app).toContain('<Route path="staff" element={<StaffUnavailablePage />} />')
  })
})
