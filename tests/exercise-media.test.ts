import { beforeEach, describe, expect, it, vi } from 'vitest'

const upload = vi.fn()
const maybeSingle = vi.fn()
const eq = vi.fn(() => ({ maybeSingle }))
const select = vi.fn(() => ({ eq }))
const createSignedUrl = vi.fn()
vi.mock('../src/lib/supabase', () => ({ requireSupabase: () => ({ from: () => ({ select }), storage: { from: () => ({ upload, createSignedUrl }) } }) }))

import { getExerciseExplanationGifUrl, uploadExerciseMedia } from '../src/cloud/trainingCloudRepository'

describe('exercise media storage', () => {
  beforeEach(() => { upload.mockReset().mockResolvedValue({ error: null }); maybeSingle.mockReset(); createSignedUrl.mockReset() })

  it('uploads a private object path scoped by organization and exercise', async () => {
    const file = new File(['gif'], 'demo.gif', { type: 'image/gif' })
    const path = await uploadExerciseMedia('org-1', 'exercise-1', 'explanation', file)
    expect(path).toMatch(/^org-1\/exercise-1\/explanation-[\w-]+\.gif$/)
    expect(upload).toHaveBeenCalledWith(path, file, { contentType: 'image/gif', upsert: false })
  })

  it('rejects non-GIF explanatory media before Storage is called', async () => {
    await expect(uploadExerciseMedia('org-1', 'exercise-1', 'explanation', new File(['x'], 'photo.jpg', { type: 'image/jpeg' }))).rejects.toThrow('file GIF')
    expect(upload).not.toHaveBeenCalled()
  })

  it('resolves a fresh signed GIF URL without persisting it', async () => {
    maybeSingle.mockResolvedValue({ data: { explanation_gif_path: 'org/exercise/demo.gif' }, error: null })
    createSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://signed.example/demo.gif' }, error: null })
    await expect(getExerciseExplanationGifUrl('exercise-1')).resolves.toBe('https://signed.example/demo.gif')
    expect(createSignedUrl).toHaveBeenCalledWith('org/exercise/demo.gif', 3600)
  })

  it('keeps field mode unchanged when the exercise has no GIF', async () => {
    maybeSingle.mockResolvedValue({ data: { explanation_gif_path: null }, error: null })
    await expect(getExerciseExplanationGifUrl('exercise-1')).resolves.toBeNull()
    expect(createSignedUrl).not.toHaveBeenCalled()
  })
})
