import { useEffect } from 'react'
import { X } from 'lucide-react'
import type { PhaseAdaptation } from '../utils/adaptation'

type AdaptationSheetProps = {
  adaptation: PhaseAdaptation
  onClose: () => void
}

export function AdaptationSheet({ adaptation, onClose }: AdaptationSheetProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div className="sheet-backdrop" role="presentation" onClick={onClose}>
      <section className="adaptation-sheet" role="dialog" aria-modal="true" aria-labelledby="adaptation-title" onClick={(event) => event.stopPropagation()}>
        <div className="sheet-handle" />
        <header className="exercise-sheet-header">
          <div>
            <span className="eyebrow">Adatta ai presenti</span>
            <h1 id="adaptation-title">{adaptation.presentCount} presenti</h1>
            <p>{adaptation.summary}</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Chiudi adattamento">
            <X size={26} />
          </button>
        </header>

        <div className="adaptation-scroll">
          {adaptation.fields.map((field) => (
            <article key={field.label} className="adaptation-detail-card">
              <span>{field.label}</span>
              <strong>{field.format}</strong>
              <p>{field.focus}</p>
              <small>{field.dimensions}</small>
              <small>{field.rotation}</small>
            </article>
          ))}

          <section className="mini-section">
            <h3>Indicazioni rapide</h3>
            <ul className="plain-list">
              {adaptation.notes.map((note) => <li key={note}>{note}</li>)}
            </ul>
          </section>
        </div>

        <footer className="sheet-footer">
          <button type="button" className="primary-action" onClick={onClose}>Ok, applico sul campo</button>
        </footer>
      </section>
    </div>
  )
}
