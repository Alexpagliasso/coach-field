import type { CloudTrainingSession } from '../cloud/trainingCloudRepository'

export type TrainingArchiveStatus = 'all' | 'planned' | 'completed'
export type TrainingArchiveSort = 'recent' | 'oldest' | 'upcoming' | 'title'
export type TrainingArchiveFilters = { query?: string; status?: TrainingArchiveStatus; theme?: string; from?: string; to?: string; today: string }

const collator = new Intl.Collator('it', { sensitivity: 'base', numeric: true })

export function normalizeTrainingText(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('it').trim()
}

export function matchesTrainingArchive(session: CloudTrainingSession, filters: TrainingArchiveFilters) {
  if (filters.status && filters.status !== 'all' && session.status !== filters.status) return false
  if (filters.from && session.sessionDate < filters.from) return false
  if (filters.to && session.sessionDate > filters.to) return false
  const theme = normalizeTrainingText(filters.theme ?? '')
  if (theme && !normalizeTrainingText(session.objective).includes(theme)) return false
  const query = normalizeTrainingText(filters.query ?? '')
  if (!query) return true
  const text = [
    session.title, session.objective, session.coachNotes, session.sessionDate,
    ...(session.exercises ?? []).flatMap(exercise => [exercise.snapshotName, exercise.snapshotObjective, exercise.snapshotDescription]),
  ].map(normalizeTrainingText).join(' ')
  return text.includes(query)
}

export function sortTrainingArchive(sessions: CloudTrainingSession[], sort: TrainingArchiveSort, today: string) {
  return sessions.map((session, index) => ({ session, index })).sort((left, right) => {
    const time = (item: CloudTrainingSession) => `${item.sessionDate}T${item.startTime ?? '00:00:00'}`
    let comparison = 0
    if (sort === 'title') comparison = collator.compare(left.session.title, right.session.title)
    else if (sort === 'oldest') comparison = time(left.session).localeCompare(time(right.session))
    else if (sort === 'upcoming') {
      const leftUpcoming = left.session.sessionDate >= today && left.session.status !== 'completed'
      const rightUpcoming = right.session.sessionDate >= today && right.session.status !== 'completed'
      comparison = leftUpcoming === rightUpcoming ? time(left.session).localeCompare(time(right.session)) : leftUpcoming ? -1 : 1
    } else comparison = time(right.session).localeCompare(time(left.session))
    return comparison || left.index - right.index
  }).map(item => item.session)
}

export function paginateTrainingArchive(sessions: CloudTrainingSession[], page: number, pageSize: number) {
  const safePage = Math.max(1, page)
  return { total: sessions.length, sessions: sessions.slice((safePage - 1) * pageSize, safePage * pageSize) }
}
