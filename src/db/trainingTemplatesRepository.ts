import { matchesRequestedGroup, requireLocalPermission } from './localAccess'
import type { TrainingTemplate, TrainingTemplatePhase } from '../types/domain'
import { dbPromise } from './scopedDb'
import { makeId } from './db'

export type SaveTrainingTemplateInput = {
  title: string
  description?: string
  ageGroup?: string
  expectedDurationMinutes: number
  minPlayers?: number
  maxPlayers?: number
  tags: string[]
  phases: TrainingTemplatePhase[]
}

export async function getTrainingTemplates(groupId?: string) {
  if (!matchesRequestedGroup(groupId)) return []
  const templates = await (await dbPromise).getAll('trainingTemplates')
  return templates.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function getTrainingTemplateById(id: string) {
  return (await dbPromise).get('trainingTemplates', id)
}

export async function createTrainingTemplate(input: SaveTrainingTemplateInput) {
  requireLocalPermission('templates.edit')
  const now = new Date().toISOString()
  const template: TrainingTemplate = {
    id: makeId(),
    title: input.title.trim(),
    description: input.description?.trim() || undefined,
    ageGroup: input.ageGroup?.trim() || undefined,
    expectedDurationMinutes: input.expectedDurationMinutes,
    minPlayers: input.minPlayers,
    maxPlayers: input.maxPlayers,
    tags: input.tags,
    phases: input.phases.map((phase, index) => ({ ...phase, id: phase.id || makeId(), order: index + 1 })),
    createdAt: now,
    updatedAt: now,
  }
  await (await dbPromise).put('trainingTemplates', template)
  return template
}

export async function updateTrainingTemplate(id: string, patch: Partial<SaveTrainingTemplateInput>) {
  requireLocalPermission('templates.edit')
  const db = await dbPromise
  const current = await db.get('trainingTemplates', id)
  if (!current) return undefined
  const next: TrainingTemplate = {
    ...current,
    ...patch,
    title: patch.title?.trim() ?? current.title,
    description: patch.description?.trim() || current.description,
    ageGroup: patch.ageGroup?.trim() || current.ageGroup,
    phases: patch.phases?.map((phase, index) => ({ ...phase, id: phase.id || makeId(), order: index + 1 })) ?? current.phases,
    updatedAt: new Date().toISOString(),
  }
  await db.put('trainingTemplates', next)
  return next
}

export async function duplicateTrainingTemplate(id: string) {
  const current = await getTrainingTemplateById(id)
  if (!current) return undefined
  return createTrainingTemplate({
    ...current,
    title: `${current.title} copia`,
    phases: current.phases.map((phase) => ({ ...phase, id: makeId() })),
  })
}

export async function deleteTrainingTemplate(id: string) {
  requireLocalPermission('templates.edit')
  await (await dbPromise).delete('trainingTemplates', id)
}
