import type { CloudTrainingSession, ExerciseLibraryItem } from '../cloud/trainingCloudRepository'

export const GROWPITCH_TRAINING_FORMAT = 'growpitch-training/v1' as const
export const MAX_TRAINING_JSON_BYTES = 1_000_000

export type JsonExercise = {
  ref: string; name: string; objective: string; shortDescription: string
  detailedDescription?: string | null; suggestedDurationMinutes?: number | null
  suggestedPlayerCount?: number | null; materials?: string[]; tags?: string[]
  category?: string | null; sourceCollection?: string | null; sourceId?: string | null
}
export type JsonSessionExercise = {
  exerciseRef?: string; existingExerciseId?: string; snapshotName: string
  snapshotObjective: string; snapshotDescription: string; durationMinutes: number; coachNotes?: string
}
export type JsonSession = {
  ref: string; kind: 'planned'; date: string; startTime?: string | null; title: string
  objective: string; durationMinutes: number; notes?: string; status?: 'planned' | 'completed'
  exercises: JsonSessionExercise[]
}
export type TrainingJsonDocument = {
  format: typeof GROWPITCH_TRAINING_FORMAT; mode: 'exercises' | 'sessions' | 'bundle'
  exercises?: JsonExercise[]; sessions?: JsonSession[]
}
export type TrainingJsonIssue = { path: string; message: string; severity: 'error' | 'warning' }
export type TrainingJsonPreview = { document: TrainingJsonDocument; issues: TrainingJsonIssue[]; totalDurationMinutes: number }

const object = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const unsafe = /<\s*\/?\s*(script|iframe|object|embed|style)|javascript\s*:|on\w+\s*=/i
const text = (value: unknown, path: string, issues: TrainingJsonIssue[], required = true) => {
  if (typeof value !== 'string' || (required && !value.trim())) { issues.push({ path, message: required ? 'Testo obbligatorio.' : 'Deve essere testo.', severity: 'error' }); return '' }
  if (unsafe.test(value)) issues.push({ path, message: 'Contenuto HTML o script non sicuro.', severity: 'error' })
  return value.trim()
}
const optionalText = (value: unknown, path: string, issues: TrainingJsonIssue[]) => value == null ? undefined : text(value, path, issues, false)
const integer = (value: unknown, path: string, issues: TrainingJsonIssue[], min: number, max: number) => {
  if (!Number.isInteger(value) || Number(value) < min || Number(value) > max) { issues.push({ path, message: `Deve essere un intero tra ${min} e ${max}.`, severity: 'error' }); return min }
  return Number(value)
}
const strings = (value: unknown, path: string, issues: TrainingJsonIssue[]) => {
  if (value == null) return []
  if (!Array.isArray(value)) { issues.push({ path, message: 'Deve essere un elenco di testi.', severity: 'error' }); return [] }
  return value.map((item, index) => text(item, `${path}[${index}]`, issues)).filter(Boolean)
}
const known = (value: Record<string, unknown>, keys: string[], path: string, issues: TrainingJsonIssue[]) => Object.keys(value).filter(key => !keys.includes(key)).forEach(key => issues.push({ path: `${path}.${key}`, message: 'Campo sconosciuto: non verrà importato.', severity: 'warning' }))

export function parseTrainingJson(raw: string): TrainingJsonPreview {
  if (new TextEncoder().encode(raw).byteLength > MAX_TRAINING_JSON_BYTES) throw new Error('Il file supera il limite di 1 MB.')
  let input: unknown
  try { input = JSON.parse(raw) } catch { throw new Error('Il contenuto non contiene JSON valido.') }
  if (!object(input)) throw new Error('Il documento JSON deve essere un oggetto.')
  const issues: TrainingJsonIssue[] = []
  known(input, ['format', 'mode', 'exercises', 'sessions'], '$', issues)
  if (input.format !== GROWPITCH_TRAINING_FORMAT) issues.push({ path: '$.format', message: `Formato atteso: ${GROWPITCH_TRAINING_FORMAT}.`, severity: 'error' })
  if (!['exercises', 'sessions', 'bundle'].includes(String(input.mode))) issues.push({ path: '$.mode', message: 'Modalità ammessa: exercises, sessions o bundle.', severity: 'error' })
  const refs = new Set<string>()
  const exercises = (Array.isArray(input.exercises) ? input.exercises : []).map((value, index): JsonExercise => {
    const path = `$.exercises[${index}]`; if (!object(value)) { issues.push({ path, message: 'Deve essere un oggetto.', severity: 'error' }); value = {} }
    known(value, ['ref','name','objective','shortDescription','detailedDescription','suggestedDurationMinutes','suggestedPlayerCount','materials','tags','category','sourceCollection','sourceId'], path, issues)
    const ref = text(value.ref, `${path}.ref`, issues); if (refs.has(ref)) issues.push({ path: `${path}.ref`, message: 'Riferimento duplicato.', severity: 'error' }); refs.add(ref)
    return { ref, name: text(value.name, `${path}.name`, issues), objective: text(value.objective, `${path}.objective`, issues, false), shortDescription: text(value.shortDescription, `${path}.shortDescription`, issues, false), detailedDescription: optionalText(value.detailedDescription, `${path}.detailedDescription`, issues) ?? null, suggestedDurationMinutes: value.suggestedDurationMinutes == null ? null : integer(value.suggestedDurationMinutes, `${path}.suggestedDurationMinutes`, issues, 1, 480), suggestedPlayerCount: value.suggestedPlayerCount == null ? null : integer(value.suggestedPlayerCount, `${path}.suggestedPlayerCount`, issues, 1, 100), materials: strings(value.materials, `${path}.materials`, issues), tags: strings(value.tags, `${path}.tags`, issues), category: optionalText(value.category, `${path}.category`, issues) ?? null, sourceCollection: optionalText(value.sourceCollection, `${path}.sourceCollection`, issues) ?? null, sourceId: optionalText(value.sourceId, `${path}.sourceId`, issues) ?? null }
  })
  const sessionRefs = new Set<string>()
  const sessions = (Array.isArray(input.sessions) ? input.sessions : []).map((value, index): JsonSession => {
    const path = `$.sessions[${index}]`; if (!object(value)) { issues.push({ path, message: 'Deve essere un oggetto.', severity: 'error' }); value = {} }
    known(value, ['ref','kind','date','startTime','title','objective','durationMinutes','notes','status','exercises'], path, issues)
    const ref = text(value.ref, `${path}.ref`, issues); if (sessionRefs.has(ref)) issues.push({ path: `${path}.ref`, message: 'Riferimento seduta duplicato.', severity: 'error' }); sessionRefs.add(ref)
    if (value.kind !== 'planned') issues.push({ path: `${path}.kind`, message: 'Il modello attuale supporta solo sedute pianificate.', severity: 'error' })
    const date = text(value.date, `${path}.date`, issues); if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) issues.push({ path: `${path}.date`, message: 'Usa una data YYYY-MM-DD.', severity: 'error' })
    const status = value.status == null ? 'planned' : value.status; if (!['planned','completed'].includes(String(status))) issues.push({ path: `${path}.status`, message: 'Stato ammesso: planned o completed.', severity: 'error' })
    const rawSessionExercises: unknown[] = Array.isArray(value.exercises) ? value.exercises : []
    const sessionExercises = rawSessionExercises.map((entry: unknown, exerciseIndex: number): JsonSessionExercise => {
      const ep = `${path}.exercises[${exerciseIndex}]`; const record: Record<string, unknown> = object(entry) ? entry : {}
      if (!object(entry)) issues.push({ path: ep, message: 'Deve essere un oggetto.', severity: 'error' })
      known(record, ['exerciseRef','existingExerciseId','snapshotName','snapshotObjective','snapshotDescription','durationMinutes','coachNotes'], ep, issues)
      const exerciseRef = optionalText(record.exerciseRef, `${ep}.exerciseRef`, issues); const existingExerciseId = optionalText(record.existingExerciseId, `${ep}.existingExerciseId`, issues)
      if (exerciseRef && existingExerciseId) issues.push({ path: ep, message: 'Usa exerciseRef oppure existingExerciseId, non entrambi.', severity: 'error' })
      if (exerciseRef && !refs.has(exerciseRef)) issues.push({ path: `${ep}.exerciseRef`, message: 'Riferimento esercizio mancante nel bundle.', severity: 'error' })
      return { exerciseRef, existingExerciseId, snapshotName: text(record.snapshotName, `${ep}.snapshotName`, issues), snapshotObjective: text(record.snapshotObjective, `${ep}.snapshotObjective`, issues, false), snapshotDescription: text(record.snapshotDescription, `${ep}.snapshotDescription`, issues, false), durationMinutes: integer(record.durationMinutes, `${ep}.durationMinutes`, issues, 1, 480), coachNotes: optionalText(record.coachNotes, `${ep}.coachNotes`, issues) ?? '' }
    })
    return { ref, kind: 'planned', date, startTime: optionalText(value.startTime, `${path}.startTime`, issues) ?? null, title: text(value.title, `${path}.title`, issues), objective: text(value.objective, `${path}.objective`, issues, false), durationMinutes: integer(value.durationMinutes, `${path}.durationMinutes`, issues, 1, 480), notes: optionalText(value.notes, `${path}.notes`, issues) ?? '', status: status === 'completed' ? 'completed' : 'planned', exercises: sessionExercises }
  })
  if (input.mode === 'exercises' && (!exercises.length || sessions.length)) issues.push({ path: '$', message: 'La modalità exercises richiede solo exercises.', severity: 'error' })
  if (input.mode === 'sessions' && (!sessions.length || exercises.length)) issues.push({ path: '$', message: 'La modalità sessions richiede solo sessions.', severity: 'error' })
  if (input.mode === 'bundle' && (!exercises.length || !sessions.length)) issues.push({ path: '$', message: 'La modalità bundle richiede exercises e sessions.', severity: 'error' })
  return { document: { format: GROWPITCH_TRAINING_FORMAT, mode: input.mode as TrainingJsonDocument['mode'], exercises, sessions }, issues, totalDurationMinutes: sessions.reduce((sum, session) => sum + session.durationMinutes, 0) }
}

export const hasTrainingJsonErrors = (preview: TrainingJsonPreview) => preview.issues.some(issue => issue.severity === 'error')
export const exerciseFromJson = (item: JsonExercise): Omit<ExerciseLibraryItem, 'id' | 'organizationId'> => ({ name: item.name, objective: item.objective, shortDescription: item.shortDescription, detailedDescription: item.detailedDescription ?? null, suggestedDurationMinutes: item.suggestedDurationMinutes ?? null, suggestedPlayerCount: item.suggestedPlayerCount ?? null, materials: item.materials ?? [], tags: item.tags ?? [], category: item.category ?? null, sourceCollection: item.sourceCollection ?? null, sourceId: item.sourceId ?? null })
export function exportExercisesJson(items: ExerciseLibraryItem[]): TrainingJsonDocument { return { format: GROWPITCH_TRAINING_FORMAT, mode: 'exercises', exercises: items.map((item, index) => ({ ref: `exercise-${index + 1}`, name: item.name, objective: item.objective, shortDescription: item.shortDescription, detailedDescription: item.detailedDescription ?? null, suggestedDurationMinutes: item.suggestedDurationMinutes ?? null, suggestedPlayerCount: item.suggestedPlayerCount ?? null, materials: item.materials, tags: item.tags, category: item.category ?? null, sourceCollection: item.sourceCollection ?? null, sourceId: item.sourceId ?? null })) } }
export function exportSessionsJson(items: CloudTrainingSession[]): TrainingJsonDocument { return { format: GROWPITCH_TRAINING_FORMAT, mode: 'sessions', sessions: items.map((session, index) => ({ ref: `session-${index + 1}`, kind: 'planned', date: session.sessionDate, startTime: session.startTime ?? null, title: session.title, objective: session.objective, durationMinutes: session.plannedDurationMinutes, notes: session.coachNotes, status: session.status, exercises: (session.exercises ?? []).map(exercise => ({ existingExerciseId: exercise.exerciseId ?? undefined, snapshotName: exercise.snapshotName, snapshotObjective: exercise.snapshotObjective, snapshotDescription: exercise.snapshotDescription, durationMinutes: exercise.durationMinutes, coachNotes: exercise.coachNotes })) })) } }
export function downloadTrainingJson(document: TrainingJsonDocument, filename: string) { const url = URL.createObjectURL(new Blob([JSON.stringify(document, null, 2)], { type: 'application/json' })); const link = window.document.createElement('a'); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url) }
