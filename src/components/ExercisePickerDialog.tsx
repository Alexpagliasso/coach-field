import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Check, Eye, Plus, Search, Star, X } from 'lucide-react'
import { getExerciseFavoriteIds, getRecentExerciseIds, saveExercise, setExerciseFavorite, type ExerciseLibraryItem } from '../cloud/trainingCloudRepository'
import { EXERCISE_CATEGORIES, EXERCISE_OBJECTIVES, exerciseCategoryLabel, filterExerciseLibrary } from '../utils/exerciseTaxonomy'
import { errorMessage } from '../lib/supabase'
import { DialogSheet } from './DialogSheet'
import { Badge, Button, EmptyState, Input, Select, Textarea } from './ui'

type Props = {
  open: boolean
  library: ExerciseLibraryItem[]
  existingExerciseIds: string[]
  groupId: string
  organizationId: string
  busy?: boolean
  onClose: () => void
  onConfirm: (items: ExerciseLibraryItem[]) => void
  onExerciseCreated: (item: ExerciseLibraryItem) => void
}

export function ExercisePickerDialog({ open, library, existingExerciseIds, groupId, organizationId, busy = false, onClose, onConfirm, onExerciseCreated }: Props) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [objective, setObjective] = useState('')
  const [playerCount, setPlayerCount] = useState('')
  const [view, setView] = useState<'all' | 'favorites' | 'recent'>('all')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [recent, setRecent] = useState<string[]>([])
  const [favoritesAvailable, setFavoritesAvailable] = useState(true)
  const [quickOpen, setQuickOpen] = useState(false)
  const [preview, setPreview] = useState<ExerciseLibraryItem>()
  const [created, setCreated] = useState<ExerciseLibraryItem[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    let active = true
    void Promise.all([getExerciseFavoriteIds(organizationId).catch(() => null), getRecentExerciseIds(groupId).catch(() => [])]).then(([ids, recentIds]) => {
      if (!active) return
      setFavoritesAvailable(ids !== null)
      setFavorites(new Set(ids ?? []))
      setRecent(recentIds)
    })
    return () => { active = false }
  }, [groupId, open, organizationId])

  const items = useMemo(() => {
    const byId = new Map(library.map(item => [item.id, item]))
    for (const item of created) byId.set(item.id, item)
    return [...byId.values()]
  }, [created, library])
  const available = filterExerciseLibrary(items, { query, category, objective, playerCount })
    .filter(item => view !== 'favorites' || favorites.has(item.id))
    .sort((a, b) => view === 'recent' ? recent.indexOf(a.id) - recent.indexOf(b.id) : a.name.localeCompare(b.name))
  const selected = selectedIds.map(id => items.find(item => item.id === id)).filter((item): item is ExerciseLibraryItem => Boolean(item))
  const selectedMinutes = selected.reduce((total, item) => total + (item.suggestedDurationMinutes ?? 10), 0)
  const existing = new Set(existingExerciseIds)

  const toggle = (id: string) => setSelectedIds(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id])
  const resetFilters = () => { setQuery(''); setCategory(''); setObjective(''); setPlayerCount(''); setView('all') }
  const cancel = () => { if (saving || busy) return; setSelectedIds([]); setPreview(undefined); setQuickOpen(false); setError(''); onClose() }
  const confirm = () => { if (!selected.length) return; onConfirm(selected); setSelectedIds([]); setPreview(undefined); setQuickOpen(false) }
  const toggleFavorite = async (item: ExerciseLibraryItem) => {
    if (!favoritesAvailable) return
    setSaving(true); setError('')
    try {
      const next = !favorites.has(item.id)
      await setExerciseFavorite(organizationId, item.id, next)
      setFavorites(current => { const updated = new Set(current); if (next) updated.add(item.id); else updated.delete(item.id); return updated })
    } catch (cause) { setError(errorMessage(cause)) } finally { setSaving(false) }
  }
  const createQuickExercise = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget); const name = String(form.get('name') ?? '').trim()
    if (!name) return
    setSaving(true); setError('')
    try {
      const item = await saveExercise({ organizationId, name, objective: String(form.get('objective') ?? '').trim(), shortDescription: String(form.get('description') ?? '').trim(), category: String(form.get('category') ?? '') || null, tags: String(form.get('tags') ?? '').split(',').map(value => value.trim()).filter(Boolean), materials: String(form.get('materials') ?? '').split(',').map(value => value.trim()).filter(Boolean), suggestedDurationMinutes: Number(form.get('duration')) || null, suggestedPlayerCount: Number(form.get('players')) || null })
      setCreated(current => [...current, item]); onExerciseCreated(item); setSelectedIds(current => [...current, item.id]); setQuickOpen(false)
    } catch (cause) { setError(errorMessage(cause)) } finally { setSaving(false) }
  }

  if (!open) return null
  return <DialogSheet labelledBy="exercise-picker-title" busy={busy || saving} onClose={cancel} className="exercise-picker-sheet">
    <div className="exercise-picker-layout">
      <header className="exercise-picker-header"><div><p className="eyebrow">Libreria condivisa</p><h1 id="exercise-picker-title">Aggiungi esercizi</h1><p>Seleziona le card nell’ordine in cui vuoi inserirle nella seduta.</p></div><Button size="icon" variant="ghost" aria-label="Chiudi selettore esercizi" onClick={cancel}><X size={18} /></Button></header>
      <div className="exercise-picker-body" tabIndex={0} aria-label="Elenco e dettagli esercizi">
      <div className="exercise-picker-tools">
        <label className="search-field flex items-center gap-2"><Search size={17} /><input className="min-w-0 flex-1" value={query} onChange={event => setQuery(event.target.value)} placeholder="Cerca nome, descrizione, obiettivo o tag" /></label>
        <div className="exercise-picker-filters"><Select value={category} onChange={event => setCategory(event.target.value)} aria-label="Categoria esercizio"><option value="">Categorie</option>{EXERCISE_CATEGORIES.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</Select><Select value={objective} onChange={event => setObjective(event.target.value)} aria-label="Obiettivo esercizio"><option value="">Obiettivi</option>{EXERCISE_OBJECTIVES.map(item => <option key={item} value={item}>{item}</option>)}</Select><Select value={playerCount} onChange={event => setPlayerCount(event.target.value)} aria-label="Numero giocatori"><option value="">Giocatori</option><option value="6">Fino a 6</option><option value="10">Fino a 10</option><option value="16">Fino a 16</option></Select><Button size="sm" variant="ghost" onClick={resetFilters}>Azzera</Button></div>
        <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex gap-1" role="group" aria-label="Viste esercizi"><Button size="sm" variant={view === 'all' ? 'primary' : 'ghost'} onClick={() => setView('all')}>Tutti</Button><Button size="sm" variant={view === 'favorites' ? 'primary' : 'ghost'} disabled={!favoritesAvailable} onClick={() => setView('favorites')}><Star size={14} />Preferiti</Button><Button size="sm" variant={view === 'recent' ? 'primary' : 'ghost'} onClick={() => setView('recent')}>Recenti</Button></div><Button size="sm" onClick={() => setQuickOpen(value => !value)}><Plus size={15} />Nuovo esercizio</Button></div>
      </div>
      {quickOpen && <form className="exercise-picker-quick" onSubmit={createQuickExercise}><strong>Crea e seleziona</strong><Input name="name" required autoFocus placeholder="Titolo esercizio" /><div className="grid gap-2 sm:grid-cols-2"><Input name="objective" placeholder="Obiettivo" /><Select name="category" defaultValue=""><option value="">Categoria</option>{EXERCISE_CATEGORIES.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</Select><Input name="duration" type="number" min="1" max="480" placeholder="Durata min" /><Input name="players" type="number" min="1" max="100" placeholder="Giocatori" /></div><Textarea name="description" placeholder="Descrizione breve" /><details><summary>Campi avanzati</summary><div className="mt-2 grid gap-2"><Input name="tags" placeholder="Tag / obiettivi, separati da virgole" /><Input name="materials" placeholder="Materiali, separati da virgole" /></div></details><div className="flex justify-end gap-2"><Button type="button" size="sm" variant="ghost" onClick={() => setQuickOpen(false)}>Annulla</Button><Button type="submit" size="sm" variant="primary" loading={saving}>Crea</Button></div></form>}
      {error && <p className="exercise-picker-error" role="alert">{error}</p>}
      {preview ? <section className="exercise-picker-preview" aria-labelledby="exercise-preview-title"><div className="flex items-start justify-between gap-3"><div><p className="eyebrow">Anteprima esercizio</p><h2 id="exercise-preview-title">{preview.name}</h2></div><Button size="icon" variant="ghost" aria-label="Chiudi anteprima" onClick={() => setPreview(undefined)}><X size={18} /></Button></div><p className="font-semibold text-app-primary">{preview.objective || 'Obiettivo da definire'}</p><p className="whitespace-pre-wrap text-sm text-app-muted">{preview.shortDescription || 'Nessuna descrizione breve.'}</p>{preview.detailedDescription && <p className="whitespace-pre-wrap text-sm text-app-muted">{preview.detailedDescription}</p>}<div className="flex flex-wrap gap-1">{preview.category && <Badge>{exerciseCategoryLabel(preview.category)}</Badge>}{preview.suggestedDurationMinutes && <Badge>{preview.suggestedDurationMinutes} min</Badge>}{preview.suggestedPlayerCount && <Badge>{preview.suggestedPlayerCount} giocatori</Badge>}{preview.tags.map(tag => <Badge key={tag} variant="info">{tag}</Badge>)}</div>{preview.materials.length > 0 && <p className="text-sm"><strong>Materiali:</strong> {preview.materials.join(', ')}</p>}<Button variant={selectedIds.includes(preview.id) ? 'secondary' : 'primary'} onClick={() => toggle(preview.id)}>{selectedIds.includes(preview.id) ? 'Rimuovi dalla selezione' : 'Seleziona esercizio'}</Button></section> : <div className="exercise-picker-results" aria-live="polite">{available.map(item => { const checked = selectedIds.includes(item.id); const order = selectedIds.indexOf(item.id) + 1; return <article key={item.id} className={`exercise-picker-card ${checked ? 'is-selected' : ''}`}><button type="button" className="exercise-picker-card-select" aria-pressed={checked} onClick={() => toggle(item.id)}><span className="exercise-picker-checkbox" aria-hidden="true">{checked ? <Check size={16} /> : null}</span><span className="min-w-0 flex-1"><strong>{item.name}</strong><small>{item.objective || exerciseCategoryLabel(item.category)}</small></span>{checked && <Badge variant="primary">{order}</Badge>}</button><p>{item.shortDescription || 'Nessuna descrizione breve.'}</p><div className="flex flex-wrap gap-1">{existing.has(item.id) && <Badge variant="warning">Già in seduta</Badge>}{item.suggestedDurationMinutes && <Badge>{item.suggestedDurationMinutes} min</Badge>}{item.tags.slice(0, 2).map(tag => <Badge key={tag} variant="info">{tag}</Badge>)}</div><div className="exercise-picker-card-actions"><Button size="sm" variant="ghost" onClick={() => setPreview(item)}><Eye size={15} />Anteprima</Button><Button size="icon" variant="ghost" disabled={!favoritesAvailable || saving} aria-label={`${favorites.has(item.id) ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'} ${item.name}`} onClick={() => void toggleFavorite(item)}><Star size={15} fill={favorites.has(item.id) ? 'currentColor' : 'none'} /></Button></div></article>})}{available.length === 0 && <EmptyState icon={Search} title="Nessun esercizio trovato" description="Modifica ricerca o filtri, oppure crea un esercizio." />}</div>}
      </div>
      <footer className="exercise-picker-footer"><div><strong>{selected.length} selezionati</strong><span>{selectedMinutes} min totali</span></div><Button onClick={cancel} disabled={saving || busy}>Annulla</Button><Button variant="primary" disabled={!selected.length} onClick={confirm}>Aggiungi {selected.length} esercizi</Button></footer>
    </div>
  </DialogSheet>
}
