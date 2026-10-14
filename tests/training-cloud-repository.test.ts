import { beforeEach, describe, expect, it, vi } from 'vitest'

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('../src/lib/supabase', () => ({ requireSupabase: () => ({ rpc }) }))

import { duplicateCloudTrainingSession, saveCloudTrainingSession } from '../src/cloud/trainingCloudRepository'

const session = {
  groupId: 'group-a', sessionDate: '2026-10-10', startTime: '18:30', title: 'Possesso', objective: 'Tecnica', plannedDurationMinutes: 75, coachNotes: 'Pressing', status: 'planned' as const,
  exercises: [{ exerciseId: 'exercise-a', snapshotName: 'Rondo', snapshotObjective: 'Possesso', snapshotDescription: '4v1', durationMinutes: 15, coachNotes: 'Due tocchi' }],
}

describe('training cloud repository', () => {
  beforeEach(() => vi.clearAllMocks())
  it('creates and updates only through the transactional save RPC', async () => {
    rpc.mockResolvedValue({ data: 'session-a', error: null })
    await expect(saveCloudTrainingSession(session)).resolves.toBe('session-a')
    await expect(saveCloudTrainingSession({ ...session, id: 'session-a', title: 'Aggiornata' })).resolves.toBe('session-a')
    expect(rpc).toHaveBeenNthCalledWith(1, 'save_training_session', expect.objectContaining({ p_session_id: null, p_group_id: 'group-a', p_date: '2026-10-10', p_exercises: [expect.objectContaining({ exerciseId: 'exercise-a', durationMinutes: 15, snapshotName: 'Rondo' })] }))
    expect(rpc).toHaveBeenNthCalledWith(2, 'save_training_session', expect.objectContaining({ p_session_id: 'session-a', p_title: 'Aggiornata' }))
    expect(rpc).toHaveBeenCalledTimes(2)
  })

  it('duplicates through the dedicated RPC and propagates errors', async () => {
    rpc.mockResolvedValueOnce({ data: 'copy-a', error: null }).mockResolvedValueOnce({ data: null, error: { message: 'Permission denied' } })
    await expect(duplicateCloudTrainingSession('session-a', '2026-10-17')).resolves.toBe('copy-a')
    await expect(duplicateCloudTrainingSession('session-a')).rejects.toEqual({ message: 'Permission denied' })
    expect(rpc).toHaveBeenNthCalledWith(1, 'duplicate_training_session', { p_session_id: 'session-a', p_date: '2026-10-17' })
  })
})
