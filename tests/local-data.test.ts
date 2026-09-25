import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { dbPromise, initializeDatabase } from '../src/db/db'
import { bindLocalDataset, getLocalGroupBinding } from '../src/db/localGroupBinding'
import { setLocalAccess, clearLocalAccess } from '../src/db/localAccess'
import { resolvePermissions } from '../src/auth/permissions'
import { getPlayers, getPlayer, savePlayer, updatePlayerRating } from '../src/db/playersRepository'
import { getCurrentSession, createTrainingSessionFromScratch, updateTrainingSessionPhase, setCurrentTrainingSession } from '../src/db/sessionsRepository'
import { ensureAttendanceForSession, setPlayerAttendance, getAttendanceByPlayer } from '../src/db/attendanceRepository'
import { createMatch, getMatches } from '../src/db/matchesRepository'
import { upsertMatchPlayerEvaluation, getMatchPlayerEvaluationsByPlayer } from '../src/db/matchPlayerEvaluationsRepository'
import { createTrainingTemplate, getTrainingTemplates } from '../src/db/trainingTemplatesRepository'
import { upsertTrainingPlayerEvaluation, getTrainingPlayerEvaluationsByPlayer } from '../src/db/trainingPlayerEvaluationsRepository'
import { addObservation, getObservations } from '../src/db/observationsRepository'
import { saveVoiceNote, getVoiceNotes } from '../src/db/voiceNotesRepository'
import { createPlayerObjective, addPlayerObjectiveEvidence, createPlayerDevelopmentReview, getPlayerObjectives, getPlayerObjectiveEvidence, getPlayerDevelopmentReviews } from '../src/db/playerDevelopmentRepository'
import { exportCoachFieldData, restoreBackup } from '../src/db/backupRepository'
import { dbPromise as scopedDb } from '../src/db/scopedDb'
import { buildDevelopmentTimeline } from '../src/utils/playerDevelopment'

beforeEach(async () => {
  const db = await dbPromise
  const tx = db.transaction(Array.from(db.objectStoreNames), 'readwrite')
  for (const store of db.objectStoreNames) await tx.objectStore(store).clear()
  await tx.done
  clearLocalAccess()
  await bindLocalDataset('A', 'coach', resolvePermissions({ role: 'coach' }))
  setLocalAccess({ groupId: 'A', userId: 'coach', permissions: resolvePermissions({ role: 'coach' }) })
  await initializeDatabase()
  await db.put('players', { id: 'test-player', firstName: 'Fixture', lastName: 'Player', year: 2016, previousRoles: [], rating: null, idealRoles: [], goalkeeperCandidate: false })
  const win = new EventTarget() as EventTarget & { localStorage: { getItem: () => null } }
  win.localStorage = { getItem: () => null }
  vi.stubGlobal('window', win)
  vi.stubGlobal('FileReader', class {
    result = ''; onload?: () => void
    readAsDataURL(blob: Blob) { void blob.arrayBuffer().then(buffer => { this.result = `data:${blob.type};base64,${Buffer.from(buffer).toString('base64')}`; this.onload?.() }) }
  })
})
describe('local V1–V4 regressions and V5A isolation', () => {
  it('keeps version 5 and preserves existing legacy players during initialization', async () => {
    const db = await dbPromise
    const player = (await getPlayers())[0]
    await db.put('players', { ...player, id: 'legacy-custom', firstName: 'Preserved', rating: 4 })
    await db.delete('appState', 'playerSeedVersion')
    await initializeDatabase()
    expect(db.version).toBe(5)
    expect((await getPlayer('legacy-custom'))?.rating).toBe(4)
  })
  it('supports players, Today session, attendance, observations and audio', async () => {
    const player = (await getPlayers())[0], session = (await getCurrentSession())!
    expect(session.phases.length).toBeGreaterThan(0)
    await savePlayer({ ...player, id: 'guest', firstName: 'Guest', status: 'guest' })
    await updatePlayerRating('guest', 3.5)
    expect((await getPlayer('guest'))?.rating).toBe(3.5)
    await ensureAttendanceForSession(session.id, await getPlayers())
    await setPlayerAttendance(session.id, 'guest', true)
    expect((await getAttendanceByPlayer('guest'))[0].present).toBe(true)
    await addObservation({ playerId: player.id, sessionId: session.id, category: 'technique', value: 'positive' })
    await saveVoiceNote({ sessionId: session.id, playerId: player.id, durationSeconds: 1, mimeType: 'audio/webm', audio: new Blob(['audio'], { type: 'audio/webm' }) })
    expect(await getObservations()).toHaveLength(1)
    expect(await (await getVoiceNotes())[0].audio.text()).toBe('audio')
  })
  it('supports matches, training templates, session snapshots and evaluations', async () => {
    const player = (await getPlayers())[0]
    const match = await createMatch({ date: '2026-09-23', opponent: 'Opponents', matchType: 'friendly', homeAway: 'home' })
    await upsertMatchPlayerEvaluation(match.id, player.id, { rating: 4, selected: true })
    expect(await getMatches()).toHaveLength(1)
    expect((await getMatchPlayerEvaluationsByPlayer(player.id))[0].rating).toBe(4)
    await createTrainingTemplate({ title: 'Template', tags: [], phases: [], expectedDurationMinutes: 60 })
    expect((await getTrainingTemplates()).some(item => item.title === 'Template')).toBe(true)
    const session = await createTrainingSessionFromScratch({ title: 'Session', date: '2026-09-23', durationMinutes: 60, plannedPhases: [{ id: 'phase', title: 'Phase', order: 1, status: 'planned' }] })
    await setCurrentTrainingSession(session)
    expect((await getCurrentSession())?.id).toBe(session.id)
    await upsertTrainingPlayerEvaluation(session.id, player.id, { rating: 3 })
    expect((await getTrainingPlayerEvaluationsByPlayer(player.id))[0].rating).toBe(3)
    setLocalAccess({ groupId: 'A', userId: 'helper', permissions: resolvePermissions({ role: 'collaborator', overrides: [{ permission: 'training.evaluate', enabled: true }] }) })
    await expect(updateTrainingSessionPhase(session.id, 'phase', { coachRating: 4 })).resolves.toBeDefined()
  })
  it('supports development objectives, evidence, review and derived timeline', async () => {
    const player = (await getPlayers())[0]
    const objective = await createPlayerObjective({ playerId: player.id, title: 'Objective', category: 'technical', priority: 'medium' })
    await addPlayerObjectiveEvidence({ playerId: player.id, objectiveId: objective.id, outcome: 'positive' })
    await createPlayerDevelopmentReview({ playerId: player.id, date: '2026-09-23', strengths: ['Progress'], developmentAreas: [], suggestedRoles: ['CEN'] })
    const objectives = await getPlayerObjectives(player.id), evidence = await getPlayerObjectiveEvidence(player.id), reviews = await getPlayerDevelopmentReviews(player.id)
    expect(objectives).toHaveLength(1); expect(evidence).toHaveLength(1); expect(reviews).toHaveLength(1)
    expect(buildDevelopmentTimeline({ objectives, evidence, reviews, matches: [], trainings: [], observations: [], voiceNotes: [] }).length).toBeGreaterThanOrEqual(3)
  })
  it('blocks another group, direct ID access, rebind and stale database handles', async () => {
    const player = (await getPlayers())[0]
    const old = await scopedDb
    setLocalAccess({ groupId: 'B', userId: 'coach', permissions: resolvePermissions({ role: 'coach' }) })
    await expect(getPlayer(player.id)).rejects.toThrow('non associato')
    await expect(getPlayers()).rejects.toThrow('non associato')
    await expect(old.put('players', player)).rejects.toThrow('Contesto cambiato')
    await expect(bindLocalDataset('B', 'coach', resolvePermissions({ role: 'coach' }))).rejects.toThrow('già associato')
    expect((await getLocalGroupBinding())?.groupId).toBe('A')
  })
  it('filters explicit foreign records even in the bound dataset', async () => {
    const db = await dbPromise, player = (await getPlayers())[0]
    await db.put('players', { ...player, id: 'foreign', groupId: 'B' })
    expect(await getPlayer('foreign')).toBeUndefined()
    expect((await getPlayers()).some(item => item.id === 'foreign')).toBe(false)
    await expect(updatePlayerRating('foreign', 5)).resolves.toBeUndefined()
    expect((await db.get('players', 'foreign'))?.rating).toBe(player.rating)
  })
  it('collaborator cannot edit, export restricted data or read development', async () => {
    const player = (await getPlayers())[0]
    await createPlayerObjective({ playerId: player.id, title: 'Private', category: 'technical', priority: 'medium' })
    setLocalAccess({ groupId: 'A', userId: 'helper', permissions: resolvePermissions({ role: 'collaborator' }) })
    await expect(updatePlayerRating(player.id, 5)).rejects.toThrow('Permesso negato')
    await expect(exportCoachFieldData()).rejects.toThrow('Permesso negato')
    expect(await getPlayerObjectives(player.id)).toEqual([])
    expect(await ensureAttendanceForSession('new', [player])).toEqual([])
    await expect(bindLocalDataset('A', 'helper', resolvePermissions({ role: 'collaborator' }))).rejects.toThrow('Permesso negato')
    setLocalAccess({ groupId: 'A', userId: 'helper', permissions: resolvePermissions({ role: 'collaborator', overrides: [{ permission: 'players.create', enabled: true }] }) })
    await expect(savePlayer({ ...player, rating: 5 })).rejects.toThrow('Permesso negato')
  })
  it('backup restores audio, binding and current state; old backup removes binding safely', async () => {
    const session = (await getCurrentSession())!
    await saveVoiceNote({ sessionId: session.id, durationSeconds: 2, mimeType: 'audio/webm', audio: new Blob(['roundtrip'], { type: 'audio/webm' }) })
    const backup = await exportCoachFieldData()
    const serialized = JSON.stringify(backup)
    expect(serialized).not.toMatch(/access_token|refresh_token|SUPABASE/)
    await restoreBackup(JSON.parse(serialized))
    expect((await getLocalGroupBinding())?.groupId).toBe('A')
    expect(await (await getVoiceNotes())[0].audio.text()).toBe('roundtrip')
    expect((await getCurrentSession())?.id).toBe(session.id)
    delete backup.data.appState
    await restoreBackup(backup)
    expect(await getLocalGroupBinding()).toBeUndefined()
    await expect(getPlayers()).rejects.toThrow('non associato')
  })
  it('invalid and foreign backups leave existing data intact; logout retains IndexedDB', async () => {
    const backup = await exportCoachFieldData(), count = (await getPlayers()).length
    backup.data.appState = [{ id: 'localGroupBinding', groupId: 'B' }]
    await expect(restoreBackup(backup)).rejects.toThrow('altro gruppo')
    expect(await getPlayers()).toHaveLength(count)
    clearLocalAccess()
    await expect(getPlayers()).rejects.toThrow()
    expect(await (await dbPromise).count('players')).toBe(count)
  })
  it('optional group filters cannot widen the current dataset and backup excludes foreign rows', async () => {
    const db = await dbPromise, player = (await getPlayers())[0]
    await db.put('players', { ...player, id: 'other-group', groupId: 'B' })
    expect(await getPlayers('B')).toEqual([])
    expect(await getPlayer(player.id, 'B')).toBeUndefined()
    expect(await getPlayers('A')).toHaveLength(1)
    const backup = await exportCoachFieldData()
    expect(JSON.stringify(backup)).not.toContain('other-group')
  })
})
