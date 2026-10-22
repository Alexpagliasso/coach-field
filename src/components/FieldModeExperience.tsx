import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Mic, Pause, Play, RotateCcw, X } from 'lucide-react'
import type { CloudTrainingSession } from '../cloud/trainingCloudRepository'
import { getTrainingFieldNotes, saveTrainingFieldNote, type TrainingFieldNote } from '../cloud/trainingFieldNotesRepository'
import { createFieldTimer, pauseFieldTimer, readFieldModeState, resetFieldTimer, resumeFieldTimer, timerRemaining, writeFieldModeState, type FieldTimer } from '../utils/fieldTimer'
import { applySpeechResult, createSpeechTranscriptSession, type SpeechResultEvent, type SpeechTranscriptSession } from '../utils/speechTranscript'
import { Badge, Button, EmptyState, ErrorState, Textarea } from './ui'
import { DialogSheet } from './DialogSheet'
import { usePermissions } from '../groups/groupContext'

type SpeechRecognitionLike = { lang: string; interimResults: boolean; continuous: boolean; start: () => void; stop: () => void; onresult: ((event: SpeechResultEvent) => void) | null; onend: (() => void) | null; onerror: ((event: { error: string }) => void) | null }
type SpeechConstructor = new () => SpeechRecognitionLike
const getSpeech = () => (window as unknown as { SpeechRecognition?: SpeechConstructor; webkitSpeechRecognition?: SpeechConstructor }).SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: SpeechConstructor }).webkitSpeechRecognition
const format = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`

export function FieldModeExperience({ session, onClose }: { session: CloudTrainingSession; onClose: () => void }) {
  const { isDemoViewer } = usePermissions()
  const exercises = session.exercises ?? []
  const restored = useMemo(() => readFieldModeState(session.id, exercises.length), [session.id, exercises.length])
  const [index, setIndex] = useState(restored?.exerciseIndex ?? 0), exercise = exercises[index]
  const [timer, setTimer] = useState<FieldTimer>(() => restored?.timer ?? createFieldTimer(exercises[restored?.exerciseIndex ?? 0]?.durationMinutes ?? 1)); const [, setNow] = useState(0)
  const [notes, setNotes] = useState<TrainingFieldNote[]>([]), [notesLoading, setNotesLoading] = useState(true), [noteError, setNoteError] = useState(''), [draft, setDraft] = useState(''), [saving, setSaving] = useState(false), [recording, setRecording] = useState(false)
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
  useEffect(() => { writeFieldModeState(session.id, { exerciseIndex: index, timer }) }, [session.id, index, timer])
  const timerTitle = useMemo(() => timer.startedAt ? 'Timer attivo' : remaining === 0 ? 'Tempo scaduto' : 'Timer in pausa', [timer.startedAt, remaining])
  const chooseExercise = (next: number) => setIndex(Math.max(0, Math.min(exercises.length - 1, next)))
  const setExerciseTimer = () => { if (!isDemoViewer && exercise) setTimer(createFieldTimer(exercise.durationMinutes)) }
  const toggleTimer = () => { if (!isDemoViewer) setTimer(current => current.startedAt ? pauseFieldTimer(current) : resumeFieldTimer(current)) }
  const stopDictation = () => { dictationRun.current += 1; recognition.current?.stop(); recognition.current = undefined; setRecording(false) }
  const startDictation = () => {
    if (isDemoViewer) return
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
  const editDraft = (value: string) => { if (isDemoViewer) return; if (recording) stopDictation(); setDraft(value) }
  const saveNote = async () => { if (isDemoViewer || !draft.trim()) return; setSaving(true); setNoteError(''); try { const note = await saveTrainingFieldNote({ trainingSessionId: session.id, organizationId: session.organizationId, exercisePosition: exercise ? index + 1 : undefined, body: draft.trim() }); setNotes(current => [note, ...current]); setDraft('') } catch (cause) { setNoteError(cause instanceof Error ? cause.message : 'Salvataggio nota non riuscito. Verifica migration e permessi.') } finally { setSaving(false) } }

  return <DialogSheet labelledBy="field-mode-title" onClose={onClose} className="field-mode-sheet"><div className="field-mode-scroll">
    <header className="field-mode-header"><div><p className="eyebrow">Modalità campo</p><h1 id="field-mode-title">{session.title}</h1></div><Button size="icon" variant="ghost" aria-label="Chiudi" onClick={onClose}><X size={18} /></Button></header>
    {exercise ? <><section className={`field-mode-timer ${remaining === 0 ? 'is-finished' : ''}`}><div><p>{timerTitle}{timer.startedAt && ` · ${exercise.snapshotName}`}</p><strong aria-live="polite">{format(remaining)}</strong><small>{isDemoViewer ? 'Cronometro consultabile nella demo.' : `${exercise.durationMinutes} min previsti · il timer resta attivo cambiando esercizio`}</small></div><div className="field-mode-timer-actions"><Button size="icon" variant="primary" aria-label={timer.startedAt ? 'Pausa' : 'Avvia'} onClick={toggleTimer} disabled={isDemoViewer}>{timer.startedAt ? <Pause size={20} /> : <Play size={20} />}</Button><Button size="icon" aria-label="Reset timer" onClick={() => setTimer(resetFieldTimer(timer))} disabled={isDemoViewer}><RotateCcw size={18} /></Button><Button size="sm" variant="ghost" onClick={setExerciseTimer} disabled={isDemoViewer}>Imposta {exercise.durationMinutes} min</Button></div></section><section className="field-mode-exercise"><Badge variant="primary">Esercizio {index + 1} di {exercises.length}</Badge><h2>{exercise.snapshotName}</h2><p className="field-mode-objective">{exercise.snapshotObjective}</p><p className="field-mode-description">{exercise.snapshotDescription || 'Nessuna istruzione aggiuntiva.'}</p>{exercise.coachNotes && <p className="field-mode-coach"><strong>Nota mister: </strong>{exercise.coachNotes}</p>}</section><nav className="field-mode-navigation" aria-label="Navigazione esercizi"><Button disabled={index === 0} onClick={() => chooseExercise(index - 1)}><ChevronLeft size={18} />Precedente</Button><Button variant="primary" disabled={index === exercises.length - 1} onClick={() => chooseExercise(index + 1)}>Successivo<ChevronRight size={18} /></Button></nav></> : <EmptyState title="Seduta senza esercizi" description="Aggiungi esercizi dall’editor della seduta." />}
    <section className="field-mode-notes"><div><p className="eyebrow">Note rapide</p><h2>Osservazioni di campo</h2></div>{isDemoViewer && <p className="rounded-xl border border-app-primary/20 bg-app-primary/5 p-3 text-sm text-app-muted">Nella demo le osservazioni sono consultabili, ma non puoi aggiungere note o usare la dettatura.</p>}<Textarea value={draft} onChange={event => editDraft(event.target.value)} placeholder="Scrivi un’osservazione sulla seduta o sull’esercizio corrente…" disabled={saving || isDemoViewer} /><div className="field-mode-note-actions">{speechAvailable ? <Button variant={recording ? 'danger' : 'ghost'} onClick={() => recording ? stopDictation() : startDictation()} aria-pressed={recording} disabled={isDemoViewer}><Mic size={17} />{recording ? 'Ferma dettatura' : 'Detta'}</Button> : <p>Dettatura web non disponibile: usa il testo o la dettatura della tastiera iOS.</p>}<Button variant="primary" disabled={!draft.trim() || isDemoViewer} loading={saving} onClick={() => void saveNote()}>Salva nota</Button></div>{noteError && <ErrorState message={noteError} action={<Button size="sm" onClick={() => void loadNotes()}>Riprova</Button>} />}{notesLoading ? <p className="text-sm text-app-muted">Caricamento note…</p> : <div className="field-mode-note-list">{notes.map(note => <article key={note.id}><small>{new Date(note.createdAt).toLocaleString('it-IT')}{note.exercisePosition ? ` · Esercizio ${note.exercisePosition}` : ''}</small><p>{note.body}</p></article>)}{notes.length === 0 && !noteError && <p className="text-sm text-app-muted">Nessuna nota salvata per questa seduta.</p>}</div>}</section>
  </div></DialogSheet>
}
