import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, Database, LockKeyhole, RefreshCw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useGroup } from '../groups/groupContext'
import { Badge, Button, Card, EmptyState, ErrorState, LoadingState, Select } from '../components/ui'
import { getExerciseLibrary, getCloudTrainingSessionsInRange, saveCloudTrainingSession, saveExercise, type ExerciseLibraryItem } from '../cloud/trainingCloudRepository'
import { getOrganizationTrainingObjectiveTags, setTrainingSessionObjectiveTags, type TrainingObjectiveTag } from '../cloud/trainingObjectiveTagsRepository'
import { u10Import } from '../data/u10TrainingImport'
import { planImportedExercises, type ImportExercisePlan } from '../utils/trainingImportPlan'

let importInProgress = false

type LoadState = { library: ExerciseLibraryItem[]; tags: TrainingObjectiveTag[]; existingSessionId?: string }
const targetOrganizationName = 'Auxilium Monterosa'
const targetGroupName = 'Rosso'

export function TrainingImportPage() {
  const navigate = useNavigate()
  const { activeGroup, availableGroups, data, switchGroup } = useGroup()
  const targetOrganization = data.organizations.find(item => item.name.trim().toLocaleLowerCase('it-IT') === targetOrganizationName.toLocaleLowerCase('it-IT'))
  const groups = availableGroups.filter(group => group.organizationId === targetOrganization?.id)
  const [groupId, setGroupId] = useState(activeGroup && activeGroup.organizationId === targetOrganization?.id ? activeGroup.id : '')
  const selectedGroup = groups.find(group => group.id === groupId)
  const [state, setState] = useState<LoadState>({ library: [], tags: [] })
  const [loading, setLoading] = useState(false), [error, setError] = useState(''), [busy, setBusy] = useState(false), [result, setResult] = useState(''), [createdRecords, setCreatedRecords] = useState<string[]>([])
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]), [pendingTagSessionId, setPendingTagSessionId] = useState<string>()
  const request = useRef(0)
  const isActiveTarget = selectedGroup?.id === activeGroup?.id
  const isRequestedTarget = selectedGroup?.name.trim().toLocaleLowerCase('it-IT') === targetGroupName.toLocaleLowerCase('it-IT')

  const load = useCallback(async () => {
    if (!selectedGroup || !isActiveTarget || !isRequestedTarget) return
    const current = ++request.current
    setLoading(true); setError(''); setPendingTagSessionId(undefined)
    try {
      const [library, tags, sessions] = await Promise.all([
        getExerciseLibrary(selectedGroup.organizationId),
        getOrganizationTrainingObjectiveTags(selectedGroup.organizationId),
        getCloudTrainingSessionsInRange(selectedGroup.id, u10Import.session.date, u10Import.session.date),
      ])
      if (current !== request.current) return
      const existing = sessions.find(session => session.title === u10Import.session.title)
      setState({ library, tags, existingSessionId: existing?.id })
      setSelectedTagIds(currentIds => currentIds.filter(id => tags.some(tag => tag.id === id)))
    } catch (cause) { if (current === request.current) setError(cause instanceof Error ? cause.message : 'Impossibile preparare l’anteprima cloud.') } finally { if (current === request.current) setLoading(false) }
  }, [isActiveTarget, isRequestedTarget, selectedGroup?.id])
  useEffect(() => { void load() }, [load])

  const advancedPlan = useMemo(() => planImportedExercises(u10Import.advanced, state.library, u10Import.sourceCollection), [state.library])
  const basePlan = useMemo(() => planImportedExercises(u10Import.base, state.library, u10Import.sourceCollection), [state.library])
  const possibleDuplicates = [...advancedPlan, ...basePlan].filter(item => item.possibleDuplicates.length > 0)

  const enterSelectedGroup = () => {
    if (!selectedGroup) return
    switchGroup(selectedGroup.id)
    navigate(`/app/${selectedGroup.id}/training-import`)
  }

  const resolveExercise = async (plan: ImportExercisePlan, library: ExerciseLibraryItem[], organizationId: string, created: string[]) => {
    const existing = library.find(item => item.sourceCollection === u10Import.sourceCollection && item.sourceId === plan.source.key) ?? plan.existing
    if (existing) return existing
    try {
      const saved = await saveExercise({ organizationId, name: plan.source.name, objective: plan.source.objective, shortDescription: plan.source.shortDescription, detailedDescription: plan.source.detailedDescription, suggestedDurationMinutes: plan.source.durationMinutes, materials: plan.source.materials, tags: plan.source.tags, sourceCollection: u10Import.sourceCollection, sourceId: plan.source.key })
      library.push(saved); created.push(saved.name); return saved
    } catch (cause) {
      const refreshed = await getExerciseLibrary(organizationId)
      const recovered = refreshed.find(item => item.sourceCollection === u10Import.sourceCollection && item.sourceId === plan.source.key)
      if (recovered) { library.splice(0, library.length, ...refreshed); return recovered }
      throw cause
    }
  }

  const confirm = async () => {
    if (!selectedGroup || !isActiveTarget || !isRequestedTarget || busy || importInProgress) return
    if (pendingTagSessionId) { setBusy(true); setError(''); try { await setTrainingSessionObjectiveTags(pendingTagSessionId, selectedTagIds); setResult(`Tag tecnici salvati per la seduta ${pendingTagSessionId}.`); setPendingTagSessionId(undefined); await load() } catch (cause) { setError(cause instanceof Error ? cause.message : 'Impossibile salvare i tag tecnici.') } finally { setBusy(false) }; return }
    importInProgress = true; setBusy(true); setError(''); setResult(''); setCreatedRecords([])
    const created: string[] = []
    try {
      const sessions = await getCloudTrainingSessionsInRange(selectedGroup.id, u10Import.session.date, u10Import.session.date)
      if (sessions.some(session => session.title === u10Import.session.title)) throw new Error('La seduta di importazione esiste già per questo WorkGroup e questa data. Nessun duplicato è stato creato.')
      const workingLibrary = [...state.library]
      const advanced = [] as ExerciseLibraryItem[]
      for (const plan of advancedPlan) advanced.push(await resolveExercise(plan, workingLibrary, selectedGroup.organizationId, created))
      for (const plan of basePlan) await resolveExercise(plan, workingLibrary, selectedGroup.organizationId, created)
      const secondCheck = await getCloudTrainingSessionsInRange(selectedGroup.id, u10Import.session.date, u10Import.session.date)
      if (secondCheck.some(session => session.title === u10Import.session.title)) throw new Error('Un’altra importazione ha già creato la seduta. Gli esercizi creati restano disponibili e non verranno duplicati al prossimo tentativo.')
      const sessionId = await saveCloudTrainingSession({ groupId: selectedGroup.id, sessionDate: u10Import.session.date, startTime: null, title: u10Import.session.title, objective: u10Import.session.objective, plannedDurationMinutes: u10Import.session.durationMinutes, coachNotes: u10Import.session.notes, status: 'planned', exercises: u10Import.advanced.map((source, index) => ({ exerciseId: advanced[index].id, snapshotName: source.name, snapshotObjective: source.objective, snapshotDescription: source.detailedDescription, durationMinutes: source.durationMinutes, coachNotes: '' })) })
      try { await setTrainingSessionObjectiveTags(sessionId, selectedTagIds) } catch (cause) { setPendingTagSessionId(sessionId); throw new Error(`Seduta ${sessionId} creata, ma i tag non sono stati salvati: ${cause instanceof Error ? cause.message : 'errore RPC'}. Usa “Riprova tag” senza creare una seconda seduta.`) }
      setResult(`Importazione completata: seduta ${sessionId}; esercizi creati: ${created.length || 'nessuno'}; esercizi riutilizzati: ${advancedPlan.length + basePlan.length - created.length}.`)
      await load()
    } catch (cause) { setCreatedRecords(created); setError(cause instanceof Error ? cause.message : 'Importazione non riuscita.') } finally { importInProgress = false; setBusy(false) }
  }

  if (!targetOrganization) return <section className="page"><EmptyState icon={Database} title="Auxilium Monterosa non disponibile" description="La società non è presente tra quelle autorizzate per questa sessione." /></section>
  return <section className="page"><header className="page-header"><span className="eyebrow">Procedura temporanea · cloud autenticato</span><h1>Importazione U10 · 15 ottobre</h1><p>L’anteprima non scrive nulla. La conferma userà esclusivamente la tua sessione Supabase e i permessi training.edit.</p></header><Card className="grid gap-3"><label className="grid gap-1 text-sm font-semibold">Organizzazione<Select value={targetOrganization.id} disabled><option value={targetOrganization.id}>{targetOrganization.name} · {targetOrganization.id}</option></Select></label><label className="grid gap-1 text-sm font-semibold">WorkGroup<Select value={groupId} onChange={event => setGroupId(event.target.value)}><option value="">Seleziona WorkGroup</option>{groups.map(group => <option key={group.id} value={group.id}>{group.name} · {group.id}</option>)}</Select></label>{!isRequestedTarget && <p className="text-sm text-app-warning">La destinazione richiesta è il WorkGroup “{targetGroupName}”.</p>}{selectedGroup && !isActiveTarget && <Button onClick={enterSelectedGroup}>Apri importazione nel WorkGroup selezionato</Button>}</Card>{!selectedGroup || !isActiveTarget || !isRequestedTarget ? <EmptyState icon={LockKeyhole} title="Seleziona il WorkGroup Rosso" description="Per proteggere l’importazione, l’anteprima e la conferma sono disponibili soltanto nel WorkGroup Rosso attivo autorizzato." /> : <>{loading ? <LoadingState label="Lettura catalogo, esercizi e sedute cloud..." /> : <><Preview title="Seduta avanzati da creare" items={advancedPlan} /><Preview title="Solo libreria · gruppo base" items={basePlan} />{possibleDuplicates.length > 0 && <Card className="grid gap-2 border-app-warning/50"><div className="flex items-center gap-2"><AlertTriangle className="text-app-warning" size={18} /><strong>Possibili duplicati: nessun riuso automatico</strong></div>{possibleDuplicates.map(item => <p key={item.source.key} className="text-sm">{item.source.name}: {item.possibleDuplicates.map(candidate => candidate.name).join(', ')}</p>)}</Card>}<Card className="grid gap-3"><div><h2>Tag tecnici disponibili</h2><p className="mt-1 text-sm text-app-muted">Selezionali esplicitamente: nessun tag viene creato automaticamente.</p></div>{state.tags.length === 0 ? <p className="text-sm text-app-muted">Catalogo vuoto: verrà salvata una seduta senza tag tecnici.</p> : <div className="flex flex-wrap gap-2">{state.tags.map(tag => <button key={tag.id} type="button" aria-pressed={selectedTagIds.includes(tag.id)} className={`rounded-full border px-3 py-1.5 text-sm ${selectedTagIds.includes(tag.id) ? 'border-app-primary bg-app-primary text-app-primary-fg' : 'border-app-border bg-app-elevated'}`} onClick={() => setSelectedTagIds(ids => ids.includes(tag.id) ? ids.filter(id => id !== tag.id) : [...ids, tag.id])}>{tag.name}</button>)}</div>}</Card><Card className="grid gap-2"><h2>Contenuti non rappresentabili nativamente</h2><p className="text-sm text-app-muted">I diagrammi SVG non hanno un campo media nella libreria. Le indicazioni visive sono conservate come descrizione testuale; la tabella delle dieci azioni è inclusa nel dettaglio del 3v2.</p></Card>{state.existingSessionId ? <ErrorState message={`La seduta risulta già presente: ${state.existingSessionId}. La conferma è disabilitata per evitare duplicati.`} /> : <Button variant="primary" loading={busy} onClick={() => void confirm()}>{pendingTagSessionId ? <><RefreshCw size={17} />Riprova tag</> : <><CheckCircle2 size={17} />Conferma importazione</>}</Button>}{error && <ErrorState message={error} />}{createdRecords.length > 0 && <p className="rounded-xl border border-app-warning/50 bg-app-warning/10 p-3 text-sm">Esercizi già creati in questo tentativo: {createdRecords.join(', ')}. Il prossimo tentativo li riutilizzerà tramite la chiave di importazione.</p>}{result && <p role="status" className="rounded-xl border border-app-success/50 bg-app-success/10 p-3 text-sm">{result}</p>}</>}</>}</section>
}

function Preview({ title, items }: { title: string; items: ImportExercisePlan[] }) { return <Card className="grid gap-3"><h2>{title}</h2>{items.map(item => <article key={item.source.key} className="rounded-xl border border-app-border bg-app-elevated p-3"><div className="flex flex-wrap items-center justify-between gap-2"><strong>{item.source.name}</strong><Badge variant={item.existing ? 'success' : 'primary'}>{item.existing ? `Riutilizza · ${item.existing.id}` : 'Crea se confermato'}</Badge></div><p className="mt-1 text-sm text-app-muted">{item.source.durationMinutes} min · {item.source.objective}</p><p className="mt-2 text-sm">{item.source.shortDescription}</p></article>)}</Card> }
