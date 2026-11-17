import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Mic, Minus, Pause, Play, Plus, RotateCcw, X } from 'lucide-react'
import { getExerciseExplanationGifUrl, type CloudTrainingSession } from '../cloud/trainingCloudRepository'
import { getTrainingFieldNotes, saveTrainingFieldNote, type TrainingFieldNote } from '../cloud/trainingFieldNotesRepository'
import { createFieldTimer, pauseFieldTimer, readFieldModeState, readFieldNoteDraft, resetFieldTimer, resizeFieldTimer, resumeFieldTimer, timerRemaining, writeFieldModeState, writeFieldNoteDraft, type FieldTimer } from '../utils/fieldTimer'
import { applySpeechResult, createSpeechTranscriptSession, type SpeechResultEvent, type SpeechTranscriptSession } from '../utils/speechTranscript'
import { Badge, Button, EmptyState, ErrorState, Textarea } from './ui'
import { DialogSheet } from './DialogSheet'
import { useGroup, usePermissions } from '../groups/groupContext'

type SpeechRecognitionLike = { lang: string; interimResults: boolean; continuous: boolean; start: () => void; stop: () => void; onresult: ((event: SpeechResultEvent) => void) | null; onend: (() => void) | null; onerror: ((event: { error: string }) => void) | null }
type SpeechConstructor = new () => SpeechRecognitionLike
const getSpeech = () => (window as unknown as { SpeechRecognition?: SpeechConstructor; webkitSpeechRecognition?: SpeechConstructor }).SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: SpeechConstructor }).webkitSpeechRecognition
const format = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`

export function ExerciseGifViewer({ title, url, loading = false, onClose, onError }: { title: string; url: string; loading?: boolean; onClose: () => void; onError?: () => void }) {
  return <div className="field-mode-gif-viewer" role="dialog" aria-modal="true" aria-labelledby="field-gif-title" onClick={onClose}><div className="field-mode-gif-panel" onClick={event => event.stopPropagation()}><header><h2 id="field-gif-title">{title}</h2><Button type="button" size="sm" variant="secondary" onClick={onClose}><X size={18} />Chiudi</Button></header><div className="field-mode-gif-canvas">{loading ? <p>Caricamento animazione…</p> : <img src={url} alt={`Animazione di ${title}`} onError={onError} />}</div></div></div>
}

export function FieldModeExperience({ session, onClose }: { session: CloudTrainingSession; onClose: () => void }) {
  const { isDemoViewer, can } = usePermissions()
  const { data } = useGroup()
  const notesEditable = can('training.edit')
  const exercises = session.exercises ?? []
  const restored = useMemo(() => readFieldModeState(session.id, exercises.length), [session.id, exercises.length])
  const [index, setIndex] = useState(restored?.exerciseIndex ?? 0), exercise = exercises[index]
  const initialIndex = restored?.exerciseIndex ?? 0
  const [exerciseTimers, setExerciseTimers] = useState<Record<number, FieldTimer>>(() => ({ ...(restored?.exerciseTimers ?? {}), [initialIndex]: restored?.exerciseTimers?.[initialIndex] ?? restored?.timer ?? createFieldTimer(exercises[initialIndex]?.durationMinutes ?? 1) })); const [, setNow] = useState(0)
  const timer = exerciseTimers[index] ?? createFieldTimer(exercise?.durationMinutes ?? 1)
  const [notes, setNotes] = useState<TrainingFieldNote[]>([]), [notesLoading, setNotesLoading] = useState(true), [noteError, setNoteError] = useState(''), [draft, setDraft] = useState(() => readFieldNoteDraft(session.id)), [noteScope, setNoteScope] = useState<'exercise' | 'session'>('exercise'), [saving, setSaving] = useState(false), [recording, setRecording] = useState(false)
  const [gifUrl, setGifUrl] = useState<string | null>(null), [gifOpen, setGifOpen] = useState(false), [gifLoading, setGifLoading] = useState(false), [gifError, setGifError] = useState('')
  const gifRetry = useRef(0), gifExerciseId = useRef<string | null>(null)
  const recognition = useRef<SpeechRecognitionLike | undefined>(undefined), dictationRun = useRef(0), transcript = useRef<SpeechTranscriptSession | undefined>(undefined)
  const speechAvailable = typeof window !== 'undefined' && Boolean(getSpeech())
  const remaining = timerRemaining(timer)
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 500), wake = () => setNow(Date.now())
    document.addEventListener('visibilitychange', wake); window.addEventListener('focus', wake)
    return () => { window.clearInterval(id); document.removeEventListener('visibilitychange', wake); window.removeEventListener('focus', wake); dictationRun.current += 1; recognition.current?.stop() }
  }, [])
  const loadNotes = async () => { setNotesLoading(true); setNoteError(''); try { setNotes(await getTrainingFieldNotes(session.id)) } catch (cause) { setNoteError(cause instanceof Error ? cause.message : 'Le note campo richiedono la migration 021.') } finally { setNotesLoading(false) } }
  useEffect(() => { void loadNotes() }, [session.id])
  useEffect(() => { writeFieldModeState(session.id, { exerciseIndex: index, timer, exerciseTimers }) }, [session.id, index, timer, exerciseTimers])
  useEffect(() => { writeFieldNoteDraft(session.id, draft) }, [draft, session.id])
  const loadGif = async (exerciseId?: string | null, resolvedUrl?: string | null) => {
    gifExerciseId.current = exerciseId ?? null
    setGifOpen(false); setGifError(''); setGifUrl(null); gifRetry.current = 0
    if (resolvedUrl) { setGifUrl(resolvedUrl); return }
    if (!exerciseId) return
    setGifLoading(true)
    try { const next = await getExerciseExplanationGifUrl(exerciseId); if (gifExerciseId.current === exerciseId) setGifUrl(next) }
    catch { if (gifExerciseId.current === exerciseId) setGifError('Animazione non disponibile. Puoi continuare normalmente l’allenamento.') }
    finally { if (gifExerciseId.current === exerciseId) setGifLoading(false) }
  }
  useEffect(() => { void loadGif(exercise?.exerciseId, exercise?.explanationGifUrl) }, [exercise?.exerciseId, exercise?.explanationGifUrl])
  useEffect(() => {
    if (!gifOpen) return
    const closeGif = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setGifOpen(false) } }
    window.addEventListener('keydown', closeGif, true)
    return () => window.removeEventListener('keydown', closeGif, true)
  }, [gifOpen])
  const refreshGif = async () => {
    if (!exercise?.exerciseId || gifRetry.current >= 1) { setGifOpen(false); setGifError('Animazione non disponibile. Puoi continuare normalmente l’allenamento.'); return }
    gifRetry.current += 1; setGifLoading(true)
    try { const next = await getExerciseExplanationGifUrl(exercise.exerciseId); setGifUrl(next); if (!next) setGifOpen(false) }
    catch { setGifOpen(false); setGifError('Animazione non disponibile. Puoi continuare normalmente l’allenamento.') }
    finally { setGifLoading(false) }
  }
  const timerTitle = useMemo(() => remaining === 0 ? 'Tempo scaduto' : timer.startedAt ? 'Timer attivo' : 'Timer in pausa', [timer.startedAt, remaining])
  const setTimer = (update: FieldTimer | ((current: FieldTimer) => FieldTimer)) => setExerciseTimers(current => ({ ...current, [index]: typeof update === 'function' ? update(current[index] ?? createFieldTimer(exercise?.durationMinutes ?? 1)) : update }))
  useEffect(() => { if (remaining === 0 && timer.startedAt) setTimer(current => pauseFieldTimer(current)) }, [remaining, timer.startedAt])
  const chooseExercise = (next: number) => { setTimer(current => pauseFieldTimer(current)); setIndex(Math.max(0, Math.min(exercises.length - 1, next))) }
  const setExerciseTimer = () => { if (!isDemoViewer && exercise) setTimer(createFieldTimer(exercise.durationMinutes)) }
  const chosenMinutes = Math.max(1, Math.round(timer.durationSeconds / 60))
  const changeDuration = (minutes: number) => { if (!isDemoViewer && !timer.startedAt) setTimer(current => resizeFieldTimer(current, minutes)) }
  const toggleTimer = () => { if (!isDemoViewer) setTimer(current => current.startedAt ? pauseFieldTimer(current) : resumeFieldTimer(current)) }
  const stopDictation = () => { dictationRun.current += 1; recognition.current?.stop(); recognition.current = undefined; setRecording(false) }
  const startDictation = () => {
    if (!notesEditable) return
    const Constructor = getSpeech()
    if (!Constructor) { setNoteError('Dettatura web non disponibile: usa il testo o la dettatura della tastiera iOS.'); return }
    const run = ++dictationRun.current; transcript.current = createSpeechTranscriptSession(draft)
    const instance = new Constructor(); recognition.current = instance; instance.lang = 'it-IT'; instance.interimResults = true; instance.continuous = true
    instance.onresult = event => { if (run !== dictationRun.current || !transcript.current) return; setDraft(applySpeechResult(transcript.current, event)) }
    instance.onerror = event => { if (run !== dictationRun.current) return; setRecording(false); setNoteError(`Dettatura non disponibile: ${event.error}. Usa il testo o la dettatura della tastiera iOS.`) }
    instance.onend = () => { if (run === dictationRun.current) setRecording(false) }
    setNoteError(''); setRecording(true)
    try { instance.start() } catch { setRecording(false); setNoteError('Impossibile avviare la dettatura. Usa il testo o la dettatura della tastiera iOS.') }
  }
  // Manual editing stops the current recognition run, preventing stale events from overwriting it.
  const editDraft = (value: string) => { if (!notesEditable) return; if (recording) stopDictation(); setDraft(value) }
  const saveNote = async () => { if (!notesEditable || !draft.trim()) return; setSaving(true); setNoteError(''); try { const note = await saveTrainingFieldNote({ trainingSessionId: session.id, organizationId: session.organizationId, exercisePosition: noteScope === 'exercise' && exercise ? index + 1 : undefined, body: draft.trim() }); setNotes(current => [note, ...current]); setDraft('') } catch (cause) { setNoteError(cause instanceof Error ? cause.message : 'Salvataggio nota non riuscito. Verifica migration e permessi.') } finally { setSaving(false) } }
  const groupName = data.groups.find(group => group.id === session.groupId)?.name
  const requestClose = () => { if (draft.trim() && !window.confirm('La nota non è ancora salvata. Chiudere Modalità Campo? La bozza resterà disponibile su questo dispositivo.')) return; onClose() }

  return <DialogSheet labelledBy="field-mode-title" onClose={requestClose} className="field-mode-sheet"><div className="field-mode-scroll">
    <header className="field-mode-header"><div><p className="eyebrow">{groupName ? `${groupName} · ` : ''}Modalità campo</p><h1 id="field-mode-title">{session.title}</h1>{exercise && <small>Esercizio {index + 1} di {exercises.length}</small>}</div><Button className="field-mode-close" size="sm" variant="secondary" aria-label="Chiudi Modalità Campo" onClick={requestClose}><X size={18} />Chiudi</Button></header>
    {exercise ? <><div className="field-mode-main"><section className={`field-mode-timer ${remaining === 0 ? 'is-finished' : ''}`}><div><p>{timerTitle}</p><strong aria-live="polite" data-testid="field-timer-value">{format(remaining)}</strong><small>Originale {exercise.durationMinutes} min · scelta {chosenMinutes} min</small></div><div className="field-mode-timer-actions"><Button type="button" size="icon" variant="primary" aria-label={timer.startedAt ? 'Pausa' : remaining < timer.durationSeconds ? 'Riprendi' : 'Avvia'} onClick={toggleTimer} disabled={isDemoViewer}>{timer.startedAt ? <Pause size={20} /> : <Play size={20} />}</Button><Button type="button" size="icon" aria-label="Reset timer" onClick={() => setTimer(current => resetFieldTimer(current))} disabled={isDemoViewer}><RotateCcw size={18} /></Button><Button type="button" size="sm" variant="ghost" onClick={setExerciseTimer} disabled={isDemoViewer || Boolean(timer.startedAt)}>Ripristina {exercise.durationMinutes} min</Button></div><div className="field-mode-duration" aria-label="Durata personalizzata"><span>Durata esercizio</span><div><Button type="button" size="icon" variant="ghost" aria-label="Riduci durata" disabled={isDemoViewer || Boolean(timer.startedAt) || chosenMinutes <= 1} onClick={() => changeDuration(chosenMinutes - 1)}><Minus size={17} /></Button>{[5, 10, 15, 20].map(minutes => <Button type="button" key={minutes} size="sm" variant={chosenMinutes === minutes ? 'primary' : 'ghost'} aria-pressed={chosenMinutes === minutes} disabled={isDemoViewer || Boolean(timer.startedAt)} onClick={() => changeDuration(minutes)}>{minutes}</Button>)}<Button type="button" size="icon" variant="ghost" aria-label="Aumenta durata" disabled={isDemoViewer || Boolean(timer.startedAt)} onClick={() => changeDuration(chosenMinutes + 1)}><Plus size={17} /></Button></div>{timer.startedAt && <small>Metti in pausa per modificare la durata.</small>}</div></section><section className="field-mode-exercise"><Badge variant="primary">Esercizio {index + 1} di {exercises.length}</Badge><h2>{exercise.snapshotName}</h2><p className="field-mode-objective">{exercise.snapshotObjective}</p>{(exercise.materials?.length || (exercise.fieldWidthM && exercise.fieldLengthM)) && <div className="field-mode-info">{exercise.materials?.length ? <span>Materiali: {exercise.materials.join(', ')}</span> : null}{exercise.fieldWidthM && exercise.fieldLengthM ? <span>Campo: {exercise.fieldWidthM} × {exercise.fieldLengthM} m</span> : null}</div>}{gifUrl && <Button type="button" className="field-mode-animation-button" variant="secondary" onClick={() => setGifOpen(true)}>Guarda animazione</Button>}{gifLoading && <small className="text-app-muted">Caricamento animazione…</small>}{gifError && <small role="status" className="text-app-muted">{gifError}</small>}<details className="field-mode-instructions" open><summary>Istruzioni</summary><p className="field-mode-description">{exercise.snapshotDescription || 'Nessuna istruzione aggiuntiva.'}</p>{exercise.coachNotes && <p className="field-mode-coach"><strong>Nota mister: </strong>{exercise.coachNotes}</p>}</details></section></div><nav className="field-mode-navigation" aria-label="Navigazione esercizi"><Button disabled={index === 0} onClick={() => chooseExercise(index - 1)}><ChevronLeft size={18} />Precedente</Button><Button variant="primary" disabled={index === exercises.length - 1} onClick={() => chooseExercise(index + 1)}>Successivo<ChevronRight size={18} /></Button></nav></> : <EmptyState title="Seduta senza esercizi" description="Aggiungi esercizi dall’editor della seduta." />}
    <section className="field-mode-notes"><div><p className="eyebrow">Note rapide</p><h2>Osservazioni di campo</h2></div>{!notesEditable && <p className="rounded-xl border border-app-primary/20 bg-app-primary/5 p-3 text-sm text-app-muted">Le osservazioni sono consultabili in sola lettura.</p>}{notesEditable && exercise && <div className="field-mode-note-scope" role="group" aria-label="Ambito nota"><Button size="sm" variant={noteScope === 'exercise' ? 'primary' : 'ghost'} aria-pressed={noteScope === 'exercise'} onClick={() => setNoteScope('exercise')}>Esercizio {index + 1}</Button><Button size="sm" variant={noteScope === 'session' ? 'primary' : 'ghost'} aria-pressed={noteScope === 'session'} onClick={() => setNoteScope('session')}>Seduta generale</Button></div>}<Textarea value={draft} onChange={event => editDraft(event.target.value)} placeholder="Scrivi un’osservazione rapida…" disabled={saving || !notesEditable} />{draft && <small className="field-mode-draft-status">Bozza conservata su questo dispositivo fino al salvataggio.</small>}{notesEditable && <div className="field-mode-note-actions">{speechAvailable ? <Button variant={recording ? 'danger' : 'ghost'} onClick={() => recording ? stopDictation() : startDictation()} aria-pressed={recording}><Mic size={17} />{recording ? 'Ferma dettatura' : 'Detta'}</Button> : <p>Dettatura web non disponibile: usa il testo o la dettatura della tastiera iOS.</p>}<Button variant="primary" disabled={!draft.trim()} loading={saving} onClick={() => void saveNote()}>Salva nota</Button></div>}{noteError && <ErrorState message={noteError} action={<Button size="sm" onClick={() => void loadNotes()}>Riprova</Button>} />}{notesLoading ? <p className="text-sm text-app-muted">Caricamento note…</p> : <div className="field-mode-note-list">{notes.map(note => <article key={note.id}><small>{new Date(note.createdAt).toLocaleString('it-IT')}{note.exercisePosition ? ` · Esercizio ${note.exercisePosition}` : ' · Seduta generale'}</small><p>{note.body}</p></article>)}{notes.length === 0 && !noteError && <p className="text-sm text-app-muted">Nessuna nota salvata per questa seduta.</p>}</div>}</section>
    {gifOpen && gifUrl && <ExerciseGifViewer title={exercise?.snapshotName ?? 'Esercizio'} url={gifUrl} loading={gifLoading} onClose={() => setGifOpen(false)} onError={() => void refreshGif()} />}
  </div></DialogSheet>
}
