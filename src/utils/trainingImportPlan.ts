import type { ExerciseLibraryItem } from '../cloud/trainingCloudRepository'
import type { U10ImportExercise } from '../data/u10TrainingImport'

const normalized = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const words = (value: string) => new Set(normalized(value).split(' ').filter(word => word.length > 2))

export type ImportExercisePlan = { source: U10ImportExercise; existing?: ExerciseLibraryItem; possibleDuplicates: ExerciseLibraryItem[] }

export function planImportedExercises(items: readonly U10ImportExercise[], library: ExerciseLibraryItem[], sourceCollection: string): ImportExercisePlan[] {
  return items.map(source => {
    const sourceMatch = library.find(item => item.sourceCollection === sourceCollection && item.sourceId === source.key)
    const exact = sourceMatch ?? library.find(item => normalized(item.name) === normalized(source.name))
    const candidateWords = words(source.name)
    const possibleDuplicates = exact ? [] : library.filter(item => {
      const overlap = [...words(item.name)].filter(word => candidateWords.has(word)).length
      return overlap >= 2
    }).slice(0, 3)
    return { source, existing: exact, possibleDuplicates }
  })
}
