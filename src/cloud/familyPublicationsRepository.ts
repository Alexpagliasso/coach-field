import { errorMessage, requireSupabase } from '../lib/supabase'

export type FamilyPublicationType = 'training' | 'objective' | 'match_reflection'
export type FamilyPublicationStatus = 'draft' | 'published'

export type FamilyPublication = {
  id: string
  organizationId: string
  contentType: FamilyPublicationType
  title: string
  publicContent: string
  referenceDate: string
  status: FamilyPublicationStatus
  publishedAt: string | null
}

export type PublishedFamilyPublication = Pick<FamilyPublication, 'contentType' | 'title' | 'publicContent' | 'referenceDate' | 'publishedAt'>
export type PublishedFamilyPublicationFilters = { contentTypes?: FamilyPublicationType[]; month?: string; from?: string; to?: string; search?: string }
export type PublishedFamilyPublicationPage = { items: PublishedFamilyPublication[]; hasMore: boolean }

type PublicationRow = {
  id: string; organization_id: string; content_type: FamilyPublicationType; title: string; public_content: string
  reference_date: string; status: FamilyPublicationStatus; published_at: string | null
}

const fromRow = (row: PublicationRow): FamilyPublication => ({
  id: row.id, organizationId: row.organization_id, contentType: row.content_type, title: row.title,
  publicContent: row.public_content, referenceDate: row.reference_date, status: row.status, publishedAt: row.published_at,
})

const publicFields = 'content_type,title,public_content,reference_date,published_at'
const nextMonth = (month: string) => { const [year, value] = month.split('-').map(Number); return `${value === 12 ? year + 1 : year}-${String(value === 12 ? 1 : value + 1).padStart(2, '0')}-01` }
const searchTerm = (value: string) => value.replace(/[,%_().]/g, ' ').trim()

export async function getPublishedFamilyPublicationPage(filters: PublishedFamilyPublicationFilters = {}, page = 0, pageSize = 12): Promise<PublishedFamilyPublicationPage> {
  let query = requireSupabase().from('family_publications').select(publicFields).eq('status', 'published')
  if (filters.contentTypes?.length) query = query.in('content_type', filters.contentTypes)
  if (filters.month && /^\d{4}-(0[1-9]|1[0-2])$/.test(filters.month)) query = query.gte('reference_date', `${filters.month}-01`).lt('reference_date', nextMonth(filters.month))
  if (filters.from && /^\d{4}-\d{2}-\d{2}$/.test(filters.from)) query = query.gte('reference_date', filters.from)
  if (filters.to && /^\d{4}-\d{2}-\d{2}$/.test(filters.to)) query = query.lt('reference_date', filters.to)
  const term = searchTerm(filters.search ?? '')
  if (term) query = query.or(`title.ilike.%${term}%,public_content.ilike.%${term}%`)
  const { data, error } = await query.order('reference_date', { ascending: false }).order('published_at', { ascending: false }).range(page * pageSize, page * pageSize + pageSize)
  if (error) throw new Error(errorMessage(error))
  const items = (data ?? []).map(row => ({
    contentType: row.content_type as FamilyPublicationType,
    title: row.title as string,
    publicContent: row.public_content as string,
    referenceDate: row.reference_date as string,
    publishedAt: row.published_at as string | null,
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
    organization_id: input.organizationId, content_type: input.contentType, title: input.title.trim(),
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
