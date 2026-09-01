import { useRef, useState } from 'react'
import { Mic, Square } from 'lucide-react'
import { saveVoiceNote } from '../db/voiceNotesRepository'

type VoiceRecorderProps = {
  sessionId: string
  phaseId?: string
  exerciseId?: string
  playerId?: string
  matchId?: string
  onSaved?: () => void
}

export function VoiceRecorder({ sessionId, phaseId, exerciseId, playerId, matchId, onSaved }: VoiceRecorderProps) {
  const [recording, setRecording] = useState(false)
  const [error, setError] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const startedAtRef = useRef(0)
  const intervalRef = useRef<number | undefined>(undefined)

  const stopTracks = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }

  const startRecording = async () => {
    setError('')
    if (!('mediaDevices' in navigator) || !('MediaRecorder' in window)) {
      setError('Registrazione vocale non disponibile su questo browser.')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      chunksRef.current = []
      startedAtRef.current = Date.now()

      const recorder = new MediaRecorder(stream)
      recorderRef.current = recorder
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }
      recorder.onstop = async () => {
        const durationSeconds = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000))
        const mimeType = recorder.mimeType || 'audio/webm'
        const audio = new Blob(chunksRef.current, { type: mimeType })
        stopTracks()
        window.clearInterval(intervalRef.current)
        setRecording(false)
        setElapsed(0)
        await saveVoiceNote({ sessionId, phaseId, exerciseId, playerId, matchId, durationSeconds, mimeType, audio })
        onSaved?.()
      }

      recorder.start()
      setRecording(true)
      intervalRef.current = window.setInterval(() => {
        setElapsed(Math.round((Date.now() - startedAtRef.current) / 1000))
      }, 500)
    } catch {
      stopTracks()
      setError('Microfono non autorizzato o non disponibile.')
    }
  }

  const stopRecording = () => {
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop()
    }
  }

  return (
    <div className="voice-recorder">
      {recording ? (
        <button type="button" className="primary-action danger" onClick={stopRecording}>
          <Square aria-hidden="true" size={24} fill="currentColor" />
          Stop {elapsed}s
        </button>
      ) : (
        <button type="button" className="primary-action" onClick={startRecording}>
          <Mic aria-hidden="true" size={24} />
          Nota vocale
        </button>
      )}
      {recording && <div className="recording-dot">Registrazione in corso</div>}
      {error && <p className="error-text">{error}</p>}
    </div>
  )
}
