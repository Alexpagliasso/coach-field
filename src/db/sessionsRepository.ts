import { matchesRequestedGroup, requireLocalPermission } from './localAccess'
import { sessionSeed } from '../data/sessionSeed'
import type { TrainingSession, TrainingSessionPhase } from '../types/domain'
import { legacySessionToPlannedPhases, templateToSessionPhases } from '../utils/training'
import { dbPromise } from './scopedDb'
import { makeId } from './db'
import { getAppState, saveAppState } from './appStateRepository'
import { getTrainingTemplateById } from './trainingTemplatesRepository'

export async function getCurrentSession() {
  const db = await dbPromise
  const appState = await getAppState()
  if (appState?.sessionId) {
    const current = await db.get('sessions', appState.sessionId)
    if (current) return normalizeSession(current)
  }
  const seeded = await db.get('sessions', sessionSeed.id)
  return seeded ? normalizeSession(seeded) : undefined
}

export async function saveSession(session: TrainingSession) {
  requireLocalPermission('training.edit')
  await (await dbPromise).put('sessions', session)
}

export function normalizeSession(session: TrainingSession): TrainingSession {
  const plannedPhases = legacySessionToPlannedPhases(session)
  return {
    ...session,
    date: session.date ?? new Date().toISOString().slice(0, 10),
    durationMinutes: session.durationMinutes ?? plannedPhases.reduce((sum, phase) => sum + (phase.plannedDurationMinutes ?? 0), 0),
    status: session.status ?? 'planned',
    phases: session.phases ?? [],
    plannedPhases,
    createdAt: session.createdAt ?? new Date().toISOString(),
    updatedAt: session.updatedAt ?? new Date().toISOString(),
  }
}

export async function getTrainingSessions(groupId?: string) {
  if (!matchesRequestedGroup(groupId)) return []
  const sessions = await (await dbPromise).getAll('sessions')
  return sessions.map(normalizeSession).sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '') || (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
}

export async function getTrainingSessionById(id: string) {
  const session = await (await dbPromise).get('sessions', id)
  return session ? normalizeSession(session) : undefined
}

export async function updateTrainingSession(id: string, patch: Partial<TrainingSession>) {
  requireLocalPermission('training.edit')
  const db = await dbPromise
  const current = await getTrainingSessionById(id)
  if (!current) return undefined
  const next = normalizeSession({ ...current, ...patch, updatedAt: new Date().toISOString() })
  await db.put('sessions', next)
  return next
}

export async function updateTrainingSessionPhase(sessionId: string, phaseId: string, patch: Partial<TrainingSessionPhase>) {
  requireLocalPermission('training.evaluate')
  const db = await dbPromise
  const current = await getTrainingSessionById(sessionId)
  if (!current) return undefined
  const evaluationPatch = Object.fromEntries(Object.entries(patch).filter(([key]) => ['actualDurationMinutes', 'status', 'coachRating', 'coachNotes', 'variationUsed'].includes(key)))
  const plannedPhases = (current.plannedPhases ?? []).map((phase) => (
    phase.id === phaseId ? { ...phase, ...evaluationPatch } : phase
  ))
  const next = normalizeSession({ ...current, plannedPhases, updatedAt: new Date().toISOString() })
  await db.put('sessions', next)
  return next
}

export async function createTrainingSessionFromTemplate(templateId: string, date: string, startTime?: string) {
  requireLocalPermission('training.create')
  const template = await getTrainingTemplateById(templateId)
  if (!template) throw new Error('Template not found')
  const now = new Date().toISOString()
  const session: TrainingSession = {
    id: makeId(),
    date,
    startTime: startTime || undefined,
    title: template.title,
    templateId: template.id,
    durationMinutes: template.expectedDurationMinutes,
    status: 'planned',
    phases: [],
    plannedPhases: templateToSessionPhases(template).map((phase) => ({ ...phase, id: makeId() })),
    generalNotes: '',
    takeaways: '',
    createdAt: now,
    updatedAt: now,
  }
  await (await dbPromise).put('sessions', session)
  return session
}

export async function createTrainingSessionFromScratch(input: Pick<TrainingSession, 'title' | 'date' | 'startTime' | 'durationMinutes' | 'plannedPhases' | 'generalNotes' | 'takeaways'>) {
  requireLocalPermission('training.create')
  const now = new Date().toISOString()
  const session: TrainingSession = {
    id: makeId(),
    title: input.title.trim(),
    date: input.date,
    startTime: input.startTime || undefined,
    durationMinutes: input.durationMinutes,
    status: 'planned',
    phases: [],
    plannedPhases: (input.plannedPhases ?? []).map((phase, index) => ({ ...phase, id: phase.id || makeId(), order: index + 1 })),
    generalNotes: input.generalNotes ?? '',
    takeaways: input.takeaways ?? '',
    createdAt: now,
    updatedAt: now,
  }
  await (await dbPromise).put('sessions', session)
  return session
}

export async function setCurrentTrainingSession(session: TrainingSession) {
  requireLocalPermission('training.edit')
  const state = await getAppState()
  const phases = normalizeSession(session).plannedPhases ?? []
  if (!state) return
  await saveAppState({
    ...state,
    sessionId: session.id,
    currentPhaseId: phases[0]?.id ?? state.currentPhaseId,
    timer: {
      phaseId: phases[0]?.id ?? state.timer.phaseId,
      status: 'idle',
      elapsedBeforeSeconds: 0,
    },
  })
}

export async function deleteTrainingSession(id: string) {
  requireLocalPermission('training.edit')
  const db = await dbPromise
  const [evaluations, attendance, voiceNotes, observations] = await Promise.all([
    db.getAllFromIndex('trainingPlayerEvaluations', 'by-session', id),
    db.getAllFromIndex('attendance', 'by-session', id),
    db.getAll('voiceNotes'),
    db.getAll('observations'),
  ])
  const tx = db.transaction(['sessions', 'trainingPlayerEvaluations', 'attendance', 'voiceNotes', 'observations'], 'readwrite')
  await Promise.all([
    tx.objectStore('sessions').delete(id),
    ...evaluations.map((evaluation) => tx.objectStore('trainingPlayerEvaluations').delete(evaluation.id)),
    ...attendance.map((item) => tx.objectStore('attendance').delete(item.id)),
    ...voiceNotes.filter((note) => note.sessionId === id && !note.matchId).map((note) => tx.objectStore('voiceNotes').delete(note.id)),
    ...observations.filter((observation) => observation.sessionId === id).map((observation) => tx.objectStore('observations').delete(observation.id)),
    tx.done,
  ])
}
