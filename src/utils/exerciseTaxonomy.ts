import type { ExerciseLibraryItem } from '../cloud/trainingCloudRepository'

export const EXERCISE_CATEGORIES = [
  { id: 'individual-technique', label: 'Tecnica individuale' },
  { id: 'perception-decision', label: 'Percezione e decisione' },
  { id: 'possession-collaboration', label: 'Collaborazione e possesso' },
  { id: 'duels-transitions', label: 'Duelli e transizioni' },
  { id: 'finishing', label: 'Finalizzazione' },
  { id: 'games-themed', label: 'Giochi e partite a tema' },
] as const

export const EXERCISE_OBJECTIVES = ['passaggio', 'controllo orientato', 'conduzione', 'dribbling', 'tiro', 'smarcamento', 'sostegno', 'scanning', 'superiorità numerica', 'possesso', 'riconquista', 'transizione offensiva', 'transizione difensiva', 'finalizzazione', 'collaborazione', 'orientamento del corpo', 'scelta e velocità decisionale'] as const

export type ExerciseFilters = { query?: string; category?: string; objective?: string; playerCount?: string; maxDuration?: string }

export function normalizeExerciseText(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().replace(/\s+/g, ' ').trim()
}

export function filterExerciseLibrary(items: ExerciseLibraryItem[], filters: ExerciseFilters) {
  const query = normalizeExerciseText(filters.query ?? '')
  return items.filter(item => {
    const haystack = normalizeExerciseText([item.name, item.objective, item.shortDescription, item.detailedDescription ?? '', ...item.tags].join(' '))
    const tags = item.tags.map(normalizeExerciseText)
    return (!query || haystack.includes(query))
      && (!filters.category || item.category === filters.category)
      && (!filters.objective || tags.includes(normalizeExerciseText(filters.objective)) || normalizeExerciseText(item.objective).includes(normalizeExerciseText(filters.objective)))
      && (!filters.playerCount || (item.suggestedPlayerCount ?? Infinity) <= Number(filters.playerCount))
      && (!filters.maxDuration || (item.suggestedDurationMinutes ?? Infinity) <= Number(filters.maxDuration))
  })
}

export function exerciseCategoryLabel(category?: string | null) {
  return EXERCISE_CATEGORIES.find(item => item.id === category)?.label ?? category ?? 'Senza categoria'
}
