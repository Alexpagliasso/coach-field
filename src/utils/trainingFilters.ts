import type { CloudTrainingSession } from '../cloud/trainingCloudRepository'

export type TrainingHubFilter = 'all' | 'planned' | 'history'
export const localSessionDate = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
export function isPlanned(session: Pick<CloudTrainingSession, 'status' | 'sessionDate'>, today = localSessionDate()) { return session.status !== 'completed' && session.sessionDate >= today }
export function isHistory(session: Pick<CloudTrainingSession, 'status' | 'sessionDate'>, today = localSessionDate()) { return session.status === 'completed' || session.sessionDate < today }
export function matchesTrainingHubFilter(session: Pick<CloudTrainingSession, 'status' | 'sessionDate'>, filter: TrainingHubFilter, today = localSessionDate()) { return filter === 'all' || (filter === 'planned' ? isPlanned(session, today) : isHistory(session, today)) }
export function seasonBounds(season?: string) { const match = season?.match(/(\d{4})\D+(\d{4})/); return match ? { from: `${match[1]}-07-01`, to: `${match[2]}-06-30` } : undefined }
