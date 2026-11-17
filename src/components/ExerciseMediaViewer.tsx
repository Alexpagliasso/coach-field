import { useEffect, useState } from 'react'
import { RotateCcw, X } from 'lucide-react'
import { Button } from './ui'

type Props = {
  title: string
  url: string
  kind?: 'cover' | 'gif'
  loading?: boolean
  onClose: () => void
  onError?: () => void
}

export function ExerciseMediaViewer({ title, url, kind = 'cover', loading = false, onClose, onError }: Props) {
  const [rotated, setRotated] = useState(false)
  const [failedUrl, setFailedUrl] = useState<string>()
  const failed = failedUrl === url
  const label = kind === 'gif' ? `Animazione di ${title}` : `Copertina di ${title}`

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      onClose()
    }
    window.addEventListener('keydown', close, true)
    return () => window.removeEventListener('keydown', close, true)
  }, [onClose])

  const handleError = () => {
    setFailedUrl(url)
    onError?.()
  }

  return <div className="field-mode-gif-viewer" role="dialog" aria-modal="true" aria-labelledby="exercise-media-title" onClick={onClose}>
    <div className={`field-mode-gif-panel ${rotated ? 'is-rotated' : ''}`} onClick={event => event.stopPropagation()}>
      <header>
        <h2 id="exercise-media-title">{title}</h2>
        <div className="field-mode-gif-actions">
          <Button type="button" size="sm" variant="secondary" aria-pressed={rotated} disabled={loading || failed} onClick={() => setRotated(value => !value)}><RotateCcw size={18} />Ruota 90°</Button>
          <Button type="button" size="sm" variant="secondary" onClick={onClose}><X size={18} />Chiudi</Button>
        </div>
      </header>
      <div className="field-mode-gif-canvas">
        {loading
          ? <p>Caricamento media…</p>
          : failed
            ? <div className="exercise-media-error" role="status"><strong>Immagine non disponibile</strong><span>Chiudi il visualizzatore e continua normalmente l’allenamento.</span></div>
            : <img src={url} alt={label} onError={handleError} />}
      </div>
    </div>
  </div>
}
