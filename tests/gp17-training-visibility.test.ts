import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync('supabase/migrations/202610200028_training_session_visibility.sql', 'utf8')
const repository = readFileSync('src/cloud/trainingCloudRepository.ts', 'utf8')
const training = readFileSync('src/pages/TrainingPage.tsx', 'utf8')
const analytics = readFileSync('src/cloud/dashboardAnalyticsRepository.ts', 'utf8')

describe('GP-17 training session visibility', () => {
  it('adds a reversible admin-protected visibility flag without deleting training data', () => {
    expect(migration).toContain('add column if not exists is_hidden boolean not null default false')
    expect(migration).toContain('guard_training_session_visibility_change')
    expect(migration).toContain('not private.is_admin(old.organization_id)')
    expect(migration).not.toContain('delete from public.training_sessions')
  })

  it('excludes hidden sessions from ordinary reads and metrics while allowing the admin archive view', () => {
    expect(repository).toContain("eq('is_hidden', false)")
    expect(repository).toContain("visibility?: 'visible' | 'hidden'")
    expect(repository).toContain("eq('is_hidden', options.visibility === 'hidden')")
    expect(analytics).toContain("eq('is_hidden', false)")
  })

  it('offers hide and restore actions only in the admin archive controls', () => {
    expect(training).toContain('Allenamenti nascosti')
    expect(training).toContain('setCloudTrainingSessionHidden')
    expect(training).toContain("session.isHidden ? 'Ripristina allenamento' : 'Nascondi allenamento'")
    expect(training).toContain('admin={isAdmin}')
    expect(training).toContain('disabled={session.isHidden}')
  })
})
