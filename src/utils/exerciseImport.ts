import type { ExerciseLibraryItem } from '../cloud/trainingCloudRepository'

export type ImportExercise = Omit<ExerciseLibraryItem, 'id' | 'organizationId'>
const identity = (name: string, objective: string) => `${name.trim().toLocaleLowerCase()}\u0000${objective.trim().toLocaleLowerCase()}`

export function isExerciseDuplicate(item: ImportExercise, existing: Array<Pick<ExerciseLibraryItem, 'name' | 'objective' | 'sourceCollection' | 'sourceId'>>) {
  return existing.some(value => (Boolean(item.sourceCollection && item.sourceId) && value.sourceCollection === item.sourceCollection && value.sourceId === item.sourceId) || identity(value.name, value.objective) === identity(item.name, item.objective))
}

export function importableExerciseIds(preview: ImportExercise[], existing: Array<Pick<ExerciseLibraryItem, 'name' | 'objective' | 'sourceCollection' | 'sourceId'>>) {
  return preview.filter(item => !isExerciseDuplicate(item, existing)).map(item => item.sourceId ?? identity(item.name, item.objective))
}

export function parseExerciseImport(raw: string): { collection: string; exercises: ImportExercise[] } {
  let data: { collection?: unknown; exercises?: unknown }
  try { data = JSON.parse(raw) as { collection?: unknown; exercises?: unknown } } catch { throw new Error('Il file non contiene JSON valido.') }
  if (typeof data.collection !== 'string' || !data.collection.trim() || !Array.isArray(data.exercises)) throw new Error('File JSON non valido: collection ed exercises sono obbligatori.')
  const collection = data.collection.trim()
  return { collection, exercises: data.exercises.map((value, index) => {
    const x = value as Record<string, unknown>
    if (typeof x.id !== 'string' || !x.id.trim() || typeof x.name !== 'string' || !x.name.trim() || typeof x.objective !== 'string' || typeof x.shortDescription !== 'string') throw new Error(`Esercizio ${index + 1} non valido.`)
    const duration = typeof x.suggestedDurationMinutes === 'number' ? x.suggestedDurationMinutes : null
    const players = typeof x.playerCount === 'number' ? x.playerCount : null
    if ((duration !== null && (!Number.isInteger(duration) || duration < 1 || duration > 480)) || (players !== null && (!Number.isInteger(players) || players < 1 || players > 100))) throw new Error(`Esercizio ${index + 1} contiene valori numerici non validi.`)
    const category = typeof x.category === 'string' && x.category.trim() ? x.category.trim() : null
    const tags = Array.isArray(x.tags) ? x.tags.filter((tag): tag is string => typeof tag === 'string' && Boolean(tag.trim())).map(tag => tag.trim()) : []
    return { name: x.name.trim(), objective: x.objective.trim(), shortDescription: x.shortDescription.trim(), detailedDescription: typeof x.longDescription === 'string' ? x.longDescription.trim() || null : null, suggestedDurationMinutes: duration, suggestedPlayerCount: players, materials: Array.isArray(x.materials) ? x.materials.filter((material): material is string => typeof material === 'string' && Boolean(material.trim())).map(material => material.trim()) : [], tags: [...new Set(category ? [...tags, category] : tags)], category, sourceCollection: collection, sourceId: x.id.trim() }
  }) }
}
