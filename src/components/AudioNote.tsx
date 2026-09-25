import { PermissionAction } from '../components/PermissionAction'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Pause, Play, Trash2 } from 'lucide-react'
import type { VoiceNote } from '../types/domain'

type AudioNoteProps = {
  note: VoiceNote
  title: string
  subtitle: string
  onDelete: (id: string) => void
}

export function AudioNote({ note, title, subtitle, onDelete }: AudioNoteProps) {
  const [playing, setPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const url = useMemo(() => URL.createObjectURL(note.audio), [note.audio])

  useEffect(() => () => URL.revokeObjectURL(url), [url])

  const toggle = async () => {
    if (!audioRef.current) return
    if (playing) {
      audioRef.current.pause()
      setPlaying(false)
    } else {
      await audioRef.current.play()
      setPlaying(true)
    }
  }

  return (
    <article className="list-card voice-card">
      <audio ref={audioRef} src={url} onEnded={() => setPlaying(false)} />
      <button type="button" className="icon-button" onClick={toggle} aria-label={playing ? 'Pausa' : 'Play'}>
        {playing ? <Pause size={22} /> : <Play size={22} />}
      </button>
      <div>
        <strong>{title}</strong>
        <span>{subtitle}</span>
        <small>{note.durationSeconds}s</small>
      </div>
      <PermissionAction permission="notes.delete"><button type="button" className="icon-button danger-text" onClick={() => onDelete(note.id)} aria-label="Elimina">
        <Trash2 size={21} />
      </button></PermissionAction>
    </article>
  )
}
