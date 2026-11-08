import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const page = readFileSync('src/pages/TrainingPage.tsx', 'utf8')
const repository = readFileSync('src/cloud/trainingCloudRepository.ts', 'utf8')
const fieldMode = readFileSync('src/components/FieldModeExperience.tsx', 'utf8')
const trainingMigration = readFileSync('supabase/migrations/202610080013_cloud_training_library.sql', 'utf8')
const readOnlyMigration = readFileSync('supabase/migrations/202611080033_shared_training_collaborator_read_only.sql', 'utf8')

describe('shared cloud training MVP', () => {
  it('uses only cloud sessions and preserves ordered snapshots in list and detail queries', () => {
    expect(repository).toContain("from('training_sessions').select('*, exercises:training_session_exercises(*)')")
    expect(repository).toContain('.sort((a,b) => a.position-b.position)')
    expect(repository).not.toContain('IndexedDB')
    expect(page).not.toContain('sessionsRepository')
    expect(page).toContain('Cloud · condiviso nel gruppo')
  })
  it('keeps collaborator read-only actions hidden and Field Mode notes read-only', () => {
    expect(page).toContain("editable={can('training.edit')}")
    expect(page).toContain('{!session.isHidden && editable &&')
    expect(page).toContain('{isAdmin && <><Button')
    expect(fieldMode).toContain("const notesEditable = can('training.edit')")
    expect(fieldMode).toContain('Le osservazioni sono consultabili in sola lettura.')
    expect(trainingMigration).toContain("requested in ('training.view', 'templates.view')")
    expect(readOnlyMigration).toContain("m.role = 'collaborator'")
    expect(readOnlyMigration).toContain("and requested in ('training.view', 'templates.view')")
    expect(readOnlyMigration).not.toContain("p.permission = 'training.edit'")
  })
})
