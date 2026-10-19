import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const layout = readFileSync('src/components/Layout.tsx', 'utf8')
const weekly = readFileSync('src/components/WeeklyObjectivesPanel.tsx', 'utf8')
const sheet = readFileSync('src/components/FamilyPublicationSheet.tsx', 'utf8')

describe('GP-13 workspace boundaries', () => {
  it('limits the WorkGroup selector to the active organization and preserves the sidebar preference', () => {
    expect(layout).toContain('groupsInActiveOrganization = activeGroup ? availableGroups.filter(group => group.organizationId === activeGroup.organizationId) : []')
    expect(layout).toContain("localStorage.getItem('growpitch:sidebar-collapsed')")
    expect(layout).toContain("localStorage.setItem('growpitch:sidebar-collapsed'")
  })

  it('reuses the published objective model with a Monday reference date', () => {
    expect(weekly).toContain("contentType === 'objective'")
    expect(weekly).toContain('weekStart(item.referenceDate) === referenceDate')
    expect(sheet).toContain('Settimana di riferimento')
    expect(sheet).toContain('referenceDate: weeklyObjective ? weekStart(referenceDate) : referenceDate')
  })
})
