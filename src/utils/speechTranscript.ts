export type SpeechResultItem = { transcript: string }
export type SpeechResult = ArrayLike<SpeechResultItem> & { isFinal: boolean }
export type SpeechResultEvent = { resultIndex: number; results: ArrayLike<SpeechResult> }

export type SpeechTranscriptSession = { prefix: string; finals: Map<number, string>; interim: Map<number, string> }

const clean = (value: string) => value.trim().replace(/\s+/g, ' ')
const join = (prefix: string, values: string[]) => [clean(prefix), ...values.map(clean).filter(Boolean)].filter(Boolean).join(' ')

/** Keeps Web Speech interim replacements out of the persisted note draft. */
export function createSpeechTranscriptSession(prefix: string): SpeechTranscriptSession {
  return { prefix, finals: new Map(), interim: new Map() }
}

export function applySpeechResult(session: SpeechTranscriptSession, event: SpeechResultEvent) {
  for (let index = event.resultIndex; index < event.results.length; index += 1) {
    const result = event.results[index]
    const transcript = clean(result?.[0]?.transcript ?? '')
    if (result?.isFinal) { session.finals.set(index, transcript); session.interim.delete(index) }
    else session.interim.set(index, transcript)
  }
  const indexes = [...new Set([...session.finals.keys(), ...session.interim.keys()])].sort((a, b) => a - b)
  return join(session.prefix, indexes.map(index => session.finals.get(index) ?? session.interim.get(index) ?? ''))
}
