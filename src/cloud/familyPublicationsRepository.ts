import { errorMessage, requireSupabase } from '../lib/supabase'

export type FamilyPublicationType = 'training' | 'objective' | 'match_reflection'
export type FamilyPublicationStatus = 'draft' | 'published'

export type FamilyPublication = {
  id: string
  organizationId: string
  groupId: string | null
  contentType: FamilyPublicationType
  title: string
  publicContent: string
  referenceDate: string
  status: FamilyPublicationStatus
  publishedAt: string | null
}

export type PublishedFamilyPublication = Pick<FamilyPublication, 'contentType' | 'title' | 'publicContent' | 'referenceDate' | 'publishedAt' | 'groupId'>
export type PublishedFamilyPublicationFilters = { contentTypes?: FamilyPublicationType[]; month?: string; from?: string; to?: string; search?: string; groupId?: string | null; publicGroupId?: string }
export type PublishedFamilyPublicationPage = { items: PublishedFamilyPublication[]; hasMore: boolean }

type PublicationRow = {
  id: string; organization_id: string; group_id: string | null; content_type: FamilyPublicationType; title: string; public_content: string
  reference_date: string; status: FamilyPublicationStatus; published_at: string | null
}

const fromRow = (row: PublicationRow): FamilyPublication => ({
  id: row.id, organizationId: row.organization_id, groupId: row.group_id, contentType: row.content_type, title: row.title,
  publicContent: row.public_content, referenceDate: row.reference_date, status: row.status, publishedAt: row.published_at,
})

const publicFields = 'content_type,title,public_content,reference_date,published_at,group_id'
const nextMonth = (month: string) => { const [year, value] = month.split('-').map(Number); return `${value === 12 ? year + 1 : year}-${String(value === 12 ? 1 : value + 1).padStart(2, '0')}-01` }
const searchTerm = (value: string) => value.replace(/[,%_().]/g, ' ').trim()

export async function getPublishedFamilyPublicationPage(filters: PublishedFamilyPublicationFilters = {}, page = 0, pageSize = 12): Promise<PublishedFamilyPublicationPage> {
  const limit = Math.min(100, Math.max(1, pageSize + 1))
  const term = searchTerm(filters.search ?? '')
  if (filters.publicGroupId) {
    const { data, error } = await requireSupabase().rpc('get_family_publications_for_group', {
      p_group_id: filters.publicGroupId, p_content_types: filters.contentTypes ?? null,
      p_from: filters.month ? `${filters.month}-01` : filters.from ?? null,
      p_to: filters.month ? nextMonth(filters.month) : filters.to ?? null,
      p_search: term || null, p_limit: limit, p_offset: page * pageSize,
    })
    if (error) throw new Error(errorMessage(error))
    const items = (data ?? []).map((row: Record<string, unknown>) => ({ contentType: row.content_type as FamilyPublicationType, title: row.title as string, publicContent: row.public_content as string, referenceDate: row.reference_date as string, publishedAt: row.published_at as string | null, groupId: row.group_id as string | null }))
    return { items: items.slice(0, pageSize), hasMore: items.length > pageSize }
  }
  let query = requireSupabase().from('family_publications').select(publicFields).eq('status', 'published')
  if (filters.contentTypes?.length) query = query.in('content_type', filters.contentTypes)
  if (filters.month && /^\d{4}-(0[1-9]|1[0-2])$/.test(filters.month)) query = query.gte('reference_date', `${filters.month}-01`).lt('reference_date', nextMonth(filters.month))
  if (filters.from && /^\d{4}-\d{2}-\d{2}$/.test(filters.from)) query = query.gte('reference_date', filters.from)
  if (filters.to && /^\d{4}-\d{2}-\d{2}$/.test(filters.to)) query = query.lt('reference_date', filters.to)
  if (filters.groupId === null) query = query.is('group_id', null)
  else if (filters.groupId) query = query.eq('group_id', filters.groupId)
  if (term) query = query.or(`title.ilike.%${term}%,public_content.ilike.%${term}%`)
  const { data, error } = await query.order('reference_date', { ascending: false }).order('published_at', { ascending: false }).range(page * pageSize, page * pageSize + pageSize)
  if (error) throw new Error(errorMessage(error))
  const items = (data ?? []).map(row => ({
    contentType: row.content_type as FamilyPublicationType,
    title: row.title as string,
    publicContent: row.public_content as string,
    referenceDate: row.reference_date as string,
    publishedAt: row.published_at as string | null,
    groupId: row.group_id as string | null,
  }))
  return { items: items.slice(0, pageSize), hasMore: items.length > pageSize }
}

export async function getOrganizationFamilyPublications(organizationId: string): Promise<FamilyPublication[]> {
  const { data, error } = await requireSupabase().from('family_publications').select('*')
    .eq('organization_id', organizationId).order('reference_date', { ascending: false })
  if (error) throw new Error(errorMessage(error))
  return (data ?? []).map(row => fromRow(row as PublicationRow))
}

export async function saveFamilyPublication(input: Omit<FamilyPublication, 'id' | 'publishedAt'> & { id?: string }): Promise<FamilyPublication> {
  const client = requireSupabase()
  const payload = {
    organization_id: input.organizationId, group_id: input.groupId, content_type: input.contentType, title: input.title.trim(),
    public_content: input.publicContent.trim(), reference_date: input.referenceDate, status: input.status,
    published_at: input.status === 'published' ? new Date().toISOString() : null,
  }
  const query = input.id
    ? client.from('family_publications').update(payload).eq('id', input.id).select('*').single()
    : client.from('family_publications').insert(payload).select('*').single()
  const { data, error } = await query
  if (error) throw new Error(errorMessage(error))
  return fromRow(data as PublicationRow)
}
