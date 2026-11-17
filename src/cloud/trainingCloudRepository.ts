import { requireSupabase } from '../lib/supabase'
import { fromRow } from './staffRepository'
import { collectPagedSessions } from '../utils/cloudPagination'
import { matchesTrainingArchive, paginateTrainingArchive, sortTrainingArchive, type TrainingArchiveFilters, type TrainingArchiveSort } from '../utils/trainingArchive'

export type ExerciseLibraryItem = { id: string; organizationId: string; name: string; objective: string; shortDescription: string; detailedDescription?: string | null; suggestedDurationMinutes?: number | null; suggestedPlayerCount?: number | null; materials: string[]; tags: string[]; category?: string | null; sourceCollection?: string | null; sourceId?: string | null; coverImagePath?: string | null; explanationGifPath?: string | null; coverImageUrl?: string | null; explanationGifUrl?: string | null; fieldWidthM?: number | null; fieldLengthM?: number | null }
export type TrainingSessionExercise = { id: string; exerciseId?: string | null; position: number; snapshotName: string; snapshotObjective: string; snapshotDescription: string; durationMinutes: number; coachNotes: string; explanationGifUrl?: string | null; materials?: string[]; fieldWidthM?: number | null; fieldLengthM?: number | null }
export type CloudTrainingSession = { id: string; organizationId: string; groupId: string; sessionDate: string; startTime?: string | null; title: string; objective: string; plannedDurationMinutes: number; coachNotes: string; status: 'planned' | 'completed'; isHidden: boolean; exercises?: TrainingSessionExercise[] }
export type TrainingSessionPage = { sessions: CloudTrainingSession[]; total: number }
export type TrainingSessionCounts = { total: number; planned: number; completed: number }
export type TrainingSessionPageOptions = { page: number; pageSize: number; query?: string; from?: string; to?: string; ascending?: boolean; filter?: 'all' | 'planned' | 'history'; today?: string; visibility?: 'visible' | 'hidden' }
const row = (value: object) => Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined).map(([k, v]) => [k.replace(/[A-Z]/g, c => `_${c.toLowerCase()}`), v]))

async function withExerciseMediaUrls(items: ExerciseLibraryItem[]) { const paths=[...new Set(items.flatMap(item=>[item.coverImagePath,item.explanationGifPath]).filter((value): value is string=>Boolean(value)))]; if(!paths.length) return items; const {data,error}=await requireSupabase().storage.from('exercise-media').createSignedUrls(paths,3600); if(error) throw error; const urls=new Map((data??[]).map(item=>[item.path,item.signedUrl])); return items.map(item=>({...item,coverImageUrl:item.coverImagePath?urls.get(item.coverImagePath)??null:null,explanationGifUrl:item.explanationGifPath?urls.get(item.explanationGifPath)??null:null})) }
export async function getExerciseExplanationGifUrl(exerciseId: string) {
  const client = requireSupabase()
  const { data, error } = await client.from('exercise_library_items').select('explanation_gif_path').eq('id', exerciseId).maybeSingle()
  if (error) throw error
  const path = (data as { explanation_gif_path?: string | null } | null)?.explanation_gif_path
  if (!path) return null
  const signed = await client.storage.from('exercise-media').createSignedUrl(path, 3600)
  if (signed.error) throw signed.error
  return signed.data.signedUrl
}
export async function getExerciseFieldDetails(exerciseId: string) {
  const { data, error } = await requireSupabase().from('exercise_library_items').select('materials,field_width_m,field_length_m').eq('id', exerciseId).maybeSingle()
  if (error) throw error
  const item = data as { materials?: string[]; field_width_m?: number | null; field_length_m?: number | null } | null
  return { materials: item?.materials ?? [], fieldWidthM: item?.field_width_m ?? null, fieldLengthM: item?.field_length_m ?? null }
}
export async function getExerciseLibrary(organizationId: string) { const { data, error } = await requireSupabase().from('exercise_library_items').select('*').eq('organization_id', organizationId).order('name'); if (error) throw error; return withExerciseMediaUrls((data ?? []).map(fromRow<ExerciseLibraryItem>)) }
export async function saveExercise(
  input: Partial<ExerciseLibraryItem> &
    Pick<ExerciseLibraryItem, 'organizationId' | 'name'>
) {
  const {
    coverImageUrl: _coverImageUrl,
    explanationGifUrl: _explanationGifUrl,
    normalizedIdentity: _normalizedIdentity,
    ...persisted
  } = input as typeof input & {
    normalizedIdentity?: string
  }

  const client = requireSupabase()

  const request = persisted.id
    ? client
        .from('exercise_library_items')
        .update(row(persisted))
        .eq('id', persisted.id)
    : client
        .from('exercise_library_items')
        .insert(row(persisted))

  const { data, error } = await request.select('*').single()

  if (error) throw error

  return fromRow<ExerciseLibraryItem>(data)
}export async function uploadExerciseMedia(organizationId:string,exerciseId:string,kind:'cover'|'explanation',file:File){ const allowed=kind==='explanation'?['image/gif']:['image/jpeg','image/png','image/webp','image/gif']; if(!allowed.includes(file.type)) throw new Error(kind==='explanation'?'La GIF esplicativa deve essere un file GIF.':'Formato immagine non supportato.'); if(file.size>10*1024*1024) throw new Error('Il file supera il limite di 10 MB.'); const extension=(file.name.split('.').pop()|| (kind==='explanation'?'gif':'jpg')).toLowerCase().replace(/[^a-z0-9]/g,''); const path=`${organizationId}/${exerciseId}/${kind}-${crypto.randomUUID()}.${extension}`; const {error}=await requireSupabase().storage.from('exercise-media').upload(path,file,{contentType:file.type,upsert:false}); if(error) throw error; return path }
export async function deleteExercise(id: string) { const { error } = await requireSupabase().from('exercise_library_items').delete().eq('id', id); if (error) throw error }
export async function duplicateExercise(item: ExerciseLibraryItem) { const { id: _id, sourceCollection: _sourceCollection, sourceId: _sourceId, ...copy } = item; return saveExercise({ ...copy, name: `${item.name} · variante`, sourceCollection: null, sourceId: null }) }
export async function getExerciseFavoriteIds(organizationId: string) { const { data, error } = await requireSupabase().from('exercise_library_favorites').select('exercise_id').eq('organization_id', organizationId); if (error) throw error; return (data ?? []).map(item => String((item as { exercise_id: string }).exercise_id)) }
export async function setExerciseFavorite(organizationId: string, exerciseId: string, favorite: boolean) { const client = requireSupabase(); if (!favorite) { const { error } = await client.from('exercise_library_favorites').delete().eq('organization_id', organizationId).eq('exercise_id', exerciseId); if (error) throw error; return } const { error } = await client.from('exercise_library_favorites').insert({ organization_id: organizationId, exercise_id: exerciseId }); if (error) throw error }
export async function getRecentExerciseIds(groupId: string, limit = 12) { const { data, error } = await requireSupabase().from('training_sessions').select('exercises:training_session_exercises(exercise_id)').eq('group_id', groupId).eq('is_hidden', false).order('session_date', { ascending: false }).order('created_at', { ascending: false }).limit(50); if (error) throw error; const ids: string[] = []; for (const row of data ?? []) for (const exercise of ((row as { exercises?: Array<{ exercise_id?: string | null }> }).exercises ?? [])) if (exercise.exercise_id && !ids.includes(exercise.exercise_id)) ids.push(exercise.exercise_id); return ids.slice(0, limit) }
export async function getCloudTrainingSessions(groupId: string) { const { data, error } = await requireSupabase().from('training_sessions').select('*, exercises:training_session_exercises(*)').eq('group_id', groupId).eq('is_hidden', false).order('session_date'); if (error) throw error; return (data ?? []).map(value => { const record = value as Record<string, unknown>; const { exercises, ...session } = record; return { ...fromRow<CloudTrainingSession>(session), exercises: ((exercises as object[] | undefined) ?? []).map(fromRow<TrainingSessionExercise>).sort((a,b) => a.position-b.position) } }) }
export async function getCloudTrainingSessionPage(groupId: string, options: TrainingSessionPageOptions): Promise<TrainingSessionPage> { let request = requireSupabase().from('training_sessions').select('*, exercises:training_session_exercises(*)', { count: 'exact' }).eq('group_id', groupId).eq('is_hidden', options.visibility === 'hidden'); const today = options.today; if (options.filter === 'planned' && today) request = request.neq('status', 'completed').gte('session_date', today); if (options.filter === 'history' && today) request = request.or(`status.eq.completed,session_date.lt.${today}`); if (options.query?.trim()) { const term = options.query.trim().replace(/[%_,()]/g, ' '); request = request.or(`title.ilike.%${term}%,objective.ilike.%${term}%,coach_notes.ilike.%${term}%`) } if (options.from) request = request.gte('session_date', options.from); if (options.to) request = request.lte('session_date', options.to); const start = Math.max(0, (options.page - 1) * options.pageSize); const { data, error, count } = await request.order('session_date', { ascending: options.ascending ?? false }).order('start_time', { ascending: options.ascending ?? false }).range(start, start + options.pageSize - 1); if (error) throw error; return { total: count ?? 0, sessions: (data ?? []).map(value => { const record = value as Record<string, unknown>; const { exercises, ...session } = record; return { ...fromRow<CloudTrainingSession>(session), exercises: ((exercises as object[] | undefined) ?? []).map(fromRow<TrainingSessionExercise>).sort((a,b) => a.position-b.position) } }) } }
/**
 * The archive deliberately reads every authorized server page before filtering.
 * This keeps accent-insensitive and exercise-snapshot search correct across the
 * complete WorkGroup history without introducing an RPC or N+1 requests.
 */
export async function getCloudTrainingArchive(groupId: string, filters: TrainingArchiveFilters, sort: TrainingArchiveSort, page: number, pageSize: number): Promise<TrainingSessionPage> {
  const sessions = await collectPagedSessions((nextPage, batchSize) => getCloudTrainingSessionPage(groupId, { page: nextPage, pageSize: batchSize, visibility: filters.visibility }))
  return paginateTrainingArchive(sortTrainingArchive(sessions.filter(session => matchesTrainingArchive(session, filters)), sort, filters.today), page, pageSize)
}
export async function getCloudTrainingSessionsInRange(groupId: string, from: string, to: string) { return collectPagedSessions((page, pageSize) => getCloudTrainingSessionPage(groupId, { page, pageSize, from, to, ascending: true })) }
export async function getCloudTrainingSession(id: string, groupId: string) { const { data, error } = await requireSupabase().from('training_sessions').select('*, exercises:training_session_exercises(*)').eq('id', id).eq('group_id', groupId).eq('is_hidden', false).single(); if (error) throw error; const record = data as Record<string, unknown>; const { exercises, ...session } = record; const mapped=((exercises as object[] | undefined) ?? []).map(fromRow<TrainingSessionExercise>).sort((a,b) => a.position-b.position); const media=await Promise.all(mapped.map(async item=>item.exerciseId?{ explanationGifUrl:await getExerciseExplanationGifUrl(item.exerciseId).catch(()=>null), ...await getExerciseFieldDetails(item.exerciseId).catch(()=>({materials:[],fieldWidthM:null,fieldLengthM:null}))}:{explanationGifUrl:null,materials:[],fieldWidthM:null,fieldLengthM:null})); return { ...fromRow<CloudTrainingSession>(session), exercises:mapped.map((item,index)=>({...item,...media[index]})) } }
export async function getCloudTrainingSessionCounts(groupId: string, today: string): Promise<TrainingSessionCounts> { const client=requireSupabase(); const [total,planned,completed]=await Promise.all([client.from('training_sessions').select('id',{count:'exact',head:true}).eq('group_id',groupId).eq('is_hidden',false),client.from('training_sessions').select('id',{count:'exact',head:true}).eq('group_id',groupId).eq('is_hidden',false).neq('status','completed').gte('session_date',today),client.from('training_sessions').select('id',{count:'exact',head:true}).eq('group_id',groupId).eq('is_hidden',false).eq('status','completed')]); for(const result of [total,planned,completed]) if(result.error) throw result.error; return {total:total.count??0,planned:planned.count??0,completed:completed.count??0} }
export async function saveCloudTrainingSession(input: Omit<CloudTrainingSession, 'id' | 'organizationId' | 'isHidden' | 'exercises'> & { id?: string; exercises: Array<Omit<TrainingSessionExercise, 'id' | 'position'>> }) { const { data, error } = await requireSupabase().rpc('save_training_session', { p_session_id: input.id ?? null, p_group_id: input.groupId, p_date: input.sessionDate, p_start_time: input.startTime ?? null, p_title: input.title, p_objective: input.objective, p_duration: input.plannedDurationMinutes, p_notes: input.coachNotes, p_status: input.status, p_exercises: input.exercises.map(item => ({ exerciseId: item.exerciseId, snapshotName: item.snapshotName, snapshotObjective: item.snapshotObjective, snapshotDescription: item.snapshotDescription, durationMinutes: item.durationMinutes, coachNotes: item.coachNotes })) }); if (error) throw error; return String(data) }
export async function duplicateCloudTrainingSession(id: string, date?: string) { const { data, error } = await requireSupabase().rpc('duplicate_training_session', { p_session_id: id, p_date: date ?? null }); if (error) throw error; return String(data) }
/** Hidden sessions remain stored, but their visibility is an admin-only decision enforced by a trigger. */
export async function setCloudTrainingSessionHidden(sessionId: string, isHidden: boolean) { const { data, error } = await requireSupabase().from('training_sessions').update({ is_hidden: isHidden }).eq('id', sessionId).select('*').single(); if (error) throw error; return fromRow<CloudTrainingSession>(data) }
