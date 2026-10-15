import { describe, expect, it } from 'vitest'
import { applySpeechResult, createSpeechTranscriptSession } from '../src/utils/speechTranscript'

const result = (text: string, isFinal = false) => Object.assign([{ transcript: text }], { isFinal })

describe('speech transcript composition', () => {
  it('replaces interim text rather than appending it repeatedly', () => {
    const session = createSpeechTranscriptSession('Nota manuale')
    expect(applySpeechResult(session, { resultIndex: 0, results: [result(' passaggio')] })).toBe('Nota manuale passaggio')
    expect(applySpeechResult(session, { resultIndex: 0, results: [result(' passaggio veloce')] })).toBe('Nota manuale passaggio veloce')
  })

  it('keeps final text once and adds a later interim result once', () => {
    const session = createSpeechTranscriptSession('')
    expect(applySpeechResult(session, { resultIndex: 0, results: [result('ottimo controllo', true)] })).toBe('ottimo controllo')
    expect(applySpeechResult(session, { resultIndex: 1, results: [result('ottimo controllo', true), result(' sulla destra')] })).toBe('ottimo controllo sulla destra')
  })

  it('starts a new dictation from the manually preserved draft', () => {
    const session = createSpeechTranscriptSession('Testo corretto a mano')
    expect(applySpeechResult(session, { resultIndex: 0, results: [result(' nuova frase', true)] })).toBe('Testo corretto a mano nuova frase')
  })
})
