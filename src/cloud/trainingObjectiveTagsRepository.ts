import { requireSupabase } from '../lib/supabase'
import { fromRow } from './staffRepository'

/** Migration 020 has no archived/status column: every readable catalog row is current. */
export type TrainingObjectiveTag = { id: string; organizationId: string; name: string; slug: string; createdAt: string; active: true }
export type TrainingSessionObjectiveTag = { sessionId: string; tag: TrainingObjectiveTag }
export type TrainingObjectiveTagTotal = TrainingObjectiveTag & { count: number }

const mapTag = (row: object): TrainingObjectiveTag => ({ ...fromRow<Omit<TrainingObjectiveTag, 'active'>>(row), active: true })

export async function getOrganizationTrainingObjectiveTags(organizationId: string): Promise<TrainingObjectiveTag[]> {
  const { data, error } = await requireSupabase().from('training_objective_tags').select('*').eq('organization_id', organizationId).order('name')
  if (error) throw error
  return (data ?? []).map(mapTag)
}

export async function getTrainingSessionObjectiveTagIds(sessionId: string): Promise<string[]> {
  const { data, error } = await requireSupabase().from('training_session_objective_tags').select('objective_tag_id').eq('training_session_id', sessionId)
  if (error) throw error
  return (data ?? []).map(row => String((row as { objective_tag_id: string }).objective_tag_id))
}

export async function getTrainingSessionObjectiveTags(sessionId: string): Promise<TrainingObjectiveTag[]> {
  const { data, error } = await requireSupabase().from('training_session_objective_tags').select('tag:training_objective_tags(*)').eq('training_session_id', sessionId)
  if (error) throw error
  return (data ?? []).flatMap(row => {
    const tag = (row as { tag?: object | null }).tag
    return tag ? [mapTag(tag)] : []
  }).sort((a, b) => a.name.localeCompare(b.name))
}

export async function setTrainingSessionObjectiveTags(sessionId: string, tagIds: string[]): Promise<void> {
  const { error } = await requireSupabase().rpc('set_training_session_objective_tags', { p_session_id: sessionId, p_tag_ids: [...new Set(tagIds)] })
  if (error) throw error
}

export async function getWorkGroupTrainingObjectiveTagAssociations(groupId: string, options: { from?: string; to?: string } = {}): Promise<TrainingSessionObjectiveTag[]> {
  let query = requireSupabase().from('training_session_objective_tags').select('training_session_id, tag:training_objective_tags(*), session:training_sessions!inner(group_id,session_date)')
  query = query.eq('session.group_id', groupId)
  if (options.from) query = query.gte('session.session_date', options.from)
  if (options.to) query = query.lte('session.session_date', options.to)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []).flatMap(row => {
    const record = row as { training_session_id: string; tag?: object | null }
    return record.tag ? [{ sessionId: String(record.training_session_id), tag: mapTag(record.tag) }] : []
  })
}

export function aggregateTrainingObjectiveTags(items: TrainingSessionObjectiveTag[]): TrainingObjectiveTagTotal[] {
  const totals = new Map<string, TrainingObjectiveTagTotal>()
  for (const item of items) {
    const current = totals.get(item.tag.id) ?? { ...item.tag, count: 0 }
    current.count += 1; totals.set(item.tag.id, current)
  }
  return [...totals.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}
