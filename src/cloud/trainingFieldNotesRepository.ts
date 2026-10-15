import { requireSupabase } from '../lib/supabase'
import { fromRow } from './staffRepository'

export type TrainingFieldNote = { id: string; trainingSessionId: string; organizationId: string; exercisePosition?: number | null; body: string; createdBy: string; createdAt: string; updatedAt: string }

export async function getTrainingFieldNotes(trainingSessionId: string) {
  const { data, error } = await requireSupabase().from('training_session_field_notes').select('*').eq('training_session_id', trainingSessionId).order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(fromRow<TrainingFieldNote>)
}

export async function saveTrainingFieldNote(input: Pick<TrainingFieldNote, 'trainingSessionId' | 'organizationId' | 'body'> & { exercisePosition?: number }) {
  const { data, error } = await requireSupabase().from('training_session_field_notes').insert({ training_session_id: input.trainingSessionId, organization_id: input.organizationId, exercise_position: input.exercisePosition ?? null, body: input.body }).select('*').single()
  if (error) throw error
  return fromRow<TrainingFieldNote>(data)
}
