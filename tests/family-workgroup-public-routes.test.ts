import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpc = vi.fn()
vi.mock('../src/lib/supabase', () => ({ requireSupabase: () => ({ rpc }), errorMessage: (error: unknown) => error instanceof Error ? error.message : String(error) }))

import { ensureFamilyPublicRoute, getFamilyPublicRoute, getPublishedFamilyPublicationPage } from '../src/cloud/familyPublicationsRepository'

const migration = readFileSync('supabase/migrations/202611160035_family_workgroup_public_routes.sql', 'utf8')
const app = readFileSync('src/App.tsx', 'utf8')
const families = readFileSync('src/pages/FamiliesPage.tsx', 'utf8')

describe('GP-FAM-01 WorkGroup public family routes', () => {
  beforeEach(() => rpc.mockReset())

  it('routes readable public URLs outside authentication and makes /famiglie a safe landing page', () => {
    expect(app).toContain('path="/:seasonSlug/:categorySlug/:groupSlug" element={<FamiliesPage />}')
    expect(app.indexOf('/:seasonSlug/:categorySlug/:groupSlug')).toBeLessThan(app.indexOf('<Route element={<ProtectedRoute />}'))
    expect(families).toContain('if (!publicPath)')
    expect(families).not.toContain('groupId: groupScope')
  })

  it('binds unique readable aliases to stable WorkGroup IDs and exposes only published group content', () => {
    expect(migration).toContain('group_id uuid primary key')
    expect(migration).toContain('unique (season_slug,category_slug,group_slug)')
    expect(migration).toContain("f.group_id=r.group_id")
    expect(migration).toContain("f.status='published'")
    expect(migration).not.toContain('f.group_id is null')
    expect(migration).toContain("left(replace(p_group_id::text,'-',''),8)")
  })

  it('keeps two anonymous WorkGroup feeds isolated and sends all filters to the path RPC', async () => {
    rpc.mockResolvedValueOnce({ data: [{ content_type: 'objective', title: 'Rossi', public_content: 'pubblico', reference_date: '2026-11-16', published_at: '2026-11-16T10:00:00Z', group_id: 'group-red' }], error: null }).mockResolvedValueOnce({ data: [{ content_type: 'objective', title: 'Blu', public_content: 'pubblico', reference_date: '2026-11-16', published_at: '2026-11-16T10:00:00Z', group_id: 'group-blue' }], error: null })
    const red = await getPublishedFamilyPublicationPage({ publicPath: { seasonSlug: '2026-27', categorySlug: 'pulcini-misti', groupSlug: 'rossi' }, contentTypes: ['objective'] })
    const blue = await getPublishedFamilyPublicationPage({ publicPath: { seasonSlug: '2026-27', categorySlug: 'pulcini-misti', groupSlug: 'blu' }, contentTypes: ['objective'] })
    expect(red.items.map(item => item.groupId)).toEqual(['group-red'])
    expect(blue.items.map(item => item.groupId)).toEqual(['group-blue'])
    expect(rpc).toHaveBeenNthCalledWith(1, 'get_family_publications_for_path', expect.objectContaining({ p_season_slug: '2026-27', p_category_slug: 'pulcini-misti', p_group_slug: 'rossi' }))
  })

  it('creates or refreshes the admin link and resolves legacy UUID links without reading group tables', async () => {
    rpc.mockResolvedValueOnce({ data: '/2026-27/pulcini-misti/rossi', error: null }).mockResolvedValueOnce({ data: '/2026-27/pulcini-misti/rossi', error: null })
    expect(await ensureFamilyPublicRoute('group-red')).toBe('/2026-27/pulcini-misti/rossi')
    expect(await getFamilyPublicRoute('group-red')).toBe('/2026-27/pulcini-misti/rossi')
    expect(rpc).toHaveBeenNthCalledWith(1, 'ensure_family_public_route', { p_group_id: 'group-red' })
    expect(rpc).toHaveBeenNthCalledWith(2, 'get_family_public_route', { p_group_id: 'group-red' })
  })
})
