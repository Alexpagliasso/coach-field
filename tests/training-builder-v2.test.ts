import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { EXERCISE_CATEGORIES, filterExerciseLibrary, normalizeExerciseText } from '../src/utils/exerciseTaxonomy'

const item = (patch: Record<string, unknown> = {}) => ({
  id: 'exercise-1', organizationId: 'org-1', name: 'Passàggio orientato', objective: 'Controllo e scelta', shortDescription: 'Ricezione sotto pressione', detailedDescription: null,
  suggestedDurationMinutes: 12, suggestedPlayerCount: 8, materials: ['coni'], tags: ['passaggio', 'scanning'], category: 'individual-technique', sourceCollection: null, sourceId: null,
  ...patch,
})

describe('Training Builder V2', () => {
  it('normalizes accents and combines text, category, objective and player filters', () => {
    const matching = item()
    const other = item({ id: 'exercise-2', name: 'Finalizzazione', tags: ['tiro'], category: 'finishing', suggestedPlayerCount: 14 })
    expect(normalizeExerciseText('  Passàggio  ')).toBe('passaggio')
    expect(filterExerciseLibrary([matching, other], { query: 'passaggio', category: 'individual-technique', objective: 'scanning', playerCount: '10' }).map(value => value.id)).toEqual(['exercise-1'])
  })

  it('uses stable taxonomy identifiers without assigning categories to historical exercises', () => {
    expect(EXERCISE_CATEGORIES.map(item => item.id)).toContain('duels-transitions')
    expect(filterExerciseLibrary([item({ category: null })], { category: 'individual-technique' })).toEqual([])
  })

  it('keeps shared exercises and session snapshots separate in the cloud repository', () => {
    const repository = readFileSync('src/cloud/trainingCloudRepository.ts', 'utf8')
    expect(repository).toContain("from('exercise_library_items')")
    expect(repository).toContain("from('exercise_library_favorites')")
    expect(repository).not.toContain("onConflict: 'training_session_id,player_id'")
    expect(repository).toContain('snapshotName: item.snapshotName')
    expect(repository).toContain('getRecentExerciseIds')
  })

  it('mounts quick cloud exercise creation in the training editor and adds the returned item to the draft', () => {
    const training = readFileSync('src/pages/TrainingPage.tsx', 'utf8')
    const picker = readFileSync('src/components/ExercisePickerDialog.tsx', 'utf8')
    expect(training).toContain('Training Builder V2')
    expect(picker).toContain('Crea e seleziona')
    expect(picker).toContain('const item = await saveExercise')
    expect(picker).toContain('onExerciseCreated(item)')
    expect(picker).toContain('getExerciseFavoriteIds(organizationId)')
    expect(picker).toContain('getRecentExerciseIds(groupId)')
    expect(training).not.toContain('IndexedDB')
  })

  it('uses one modal exercise picker and keeps the session sequence as the main workspace', () => {
    const training = readFileSync('src/pages/TrainingPage.tsx', 'utf8')
    const picker = readFileSync('src/components/ExercisePickerDialog.tsx', 'utf8')
    expect(training).toContain('const [pickerOpen, setPickerOpen] = useState(false)')
    expect(training).toContain('<ExercisePickerDialog open={pickerOpen}')
    expect(picker).toContain('labelledBy="exercise-picker-title"')
    expect(training).toContain('onClick={() => setPickerOpen(true)}><Plus size={17} />Aggiungi esercizi')
    expect(training).toContain('{sequencePanel}{exercisePicker}')
    expect(training).not.toContain('const libraryPanel')
    expect(training).not.toContain("setMobileTab('session')")
    expect(training).toContain('snapshotName: item.name')
    expect(training).toContain('Sposta su')
    expect(training).toContain('Rimuovi esercizio')
  })

  it('keeps multiselect local until one ordered confirmation', () => {
    const picker = readFileSync('src/components/ExercisePickerDialog.tsx', 'utf8')
    const training = readFileSync('src/pages/TrainingPage.tsx', 'utf8')
    expect(picker).toContain("const [selectedIds, setSelectedIds] = useState<string[]>([])")
    expect(picker).toContain('current.includes(id) ? current.filter')
    expect(picker).toContain('[...current, id]')
    expect(picker).toContain('onConfirm(selected)')
    expect(picker).toContain('setSelectedIds([])')
    expect(picker).toContain('setPreview(item)')
    expect(picker).toContain('Già in seduta')
    expect(picker).toContain('Aggiungi {selected.length} esercizi')
    expect(picker).toContain('selectedMinutes')
    expect(training).toContain('...items.map(item => ({ exerciseId: item.id, snapshotName: item.name')
  })

  it('defines personal favorites with organization integrity and row-level security', () => {
    const migration = readFileSync('supabase/migrations/202610140019_training_builder_favorites.sql', 'utf8')
    expect(migration).toContain('create table public.exercise_library_favorites')
    expect(migration).toContain('Favorite and exercise must belong to the same organization')
    expect(migration).toContain('enable row level security')
    expect(migration).toContain('user_id = auth.uid()')
  })
})
