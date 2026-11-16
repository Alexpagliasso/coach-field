import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'

let selectedGroup = ''
const rows: Record<string, Array<Record<string, unknown>>> = {
  red: [
    { content_type: 'objective', title: 'Nuova', public_content: 'Seconda', reference_date: '2026-11-16', published_at: '2026-11-16T12:00:00Z', group_id: 'red' },
    { content_type: 'training', title: 'Precedente', public_content: 'Prima', reference_date: '2026-11-15', published_at: '2026-11-15T12:00:00Z', group_id: 'red' },
  ],
  blue: [],
}
const eq = vi.fn((field: string, value: string) => { if (field === 'group_id') selectedGroup = value; return builder })
const order = vi.fn(() => builder)
const limit = vi.fn(async () => ({ data: rows[selectedGroup] ?? [], error: null }))
const builder = { select: vi.fn(() => builder), eq, order, limit }
const from = vi.fn(() => builder)
const rpc = vi.fn(async (_name: string, args: { p_group_id: string }) => ({ data: `/2026-27/pulcini-misti/${args.p_group_id === 'red' ? 'rosso' : 'blu'}`, error: null }))
vi.mock('../src/lib/supabase', () => ({ requireSupabase: () => ({ from, rpc }), errorMessage: (error: unknown) => String(error) }))

import { getFamilyPublicRoute, getLatestPublishedFamilyPublications } from '../src/cloud/familyPublicationsRepository'

const component = readFileSync('src/components/FamilyBoardPreview.tsx', 'utf8')
const dashboard = readFileSync('src/pages/GroupDashboardPage.tsx', 'utf8')
const recovery = readFileSync('supabase/migrations/202611160036_family_legacy_publications_rossi.sql', 'utf8')
const routeCorrection = readFileSync('supabase/migrations/202611160037_family_rosso_route.sql', 'utf8')

describe('GP-FAM-02 dashboard family board', () => {
  beforeEach(() => { selectedGroup = ''; vi.clearAllMocks() })

  it('loads at most two published records for only the requested WorkGroup ordered by publication time', async () => {
    expect((await getLatestPublishedFamilyPublications('red', 2)).map(item => item.groupId)).toEqual(['red', 'red'])
    expect(await getLatestPublishedFamilyPublications('blue', 2)).toEqual([])
    expect(eq).toHaveBeenCalledWith('status', 'published')
    expect(eq).toHaveBeenCalledWith('group_id', 'red')
    expect(eq).toHaveBeenCalledWith('group_id', 'blue')
    expect(order).toHaveBeenCalledWith('published_at', { ascending: false, nullsFirst: false })
    expect(limit).toHaveBeenCalledWith(2)
  })

  it('derives the public link from the same WorkGroup ID and never hardcodes a group route', async () => {
    expect(await getFamilyPublicRoute('red')).toBe('/2026-27/pulcini-misti/rosso')
    expect(component).toContain('getFamilyPublicRoute(groupId)')
    expect(component).toContain('href={publicPath}')
    expect(component).not.toContain('/2026-27/pulcini-misti/')
    expect(dashboard).toContain('<FamilyBoardPreview groupId={activeGroup.id}')
  })

  it('supports compact full-item expansion, loading, errors and an empty state', () => {
    for (const value of ['Bacheca Famiglie', '<details', 'LoadingState', 'ErrorState', 'Nessuna pubblicazione per questo WorkGroup']) expect(component).toContain(value)
  })

  it('preserves applied migration 036 and corrects the canonical Rosso route only in migration 037', () => {
    expect(recovery).toContain("lower(btrim(g.name))='rosso'")
    expect(recovery).toContain("set season_slug='2026-27',category_slug='pulcini-misti',group_slug='rossi'")
    expect(routeCorrection).toContain("set group_slug='rosso'")
    expect(routeCorrection).not.toContain('family_publications')
    expect(routeCorrection).toContain("current_group_slug not in ('rossi','rosso')")
  })
})
