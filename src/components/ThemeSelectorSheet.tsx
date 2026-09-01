import { useEffect, useState } from 'react'
import { Check, X } from 'lucide-react'
import { APP_THEMES, type AppTheme, useTheme } from '../theme'

type ThemeSelectorSheetProps = {
  onClose: () => void
}

export function ThemeSelectorSheet({ onClose }: ThemeSelectorSheetProps) {
  const { theme, setTheme } = useTheme()
  const [flash, setFlash] = useState('')

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const selectTheme = (nextTheme: AppTheme) => {
    setTheme(nextTheme)
    setFlash('Tema applicato ✓')
    window.setTimeout(() => setFlash(''), 1000)
  }

  return (
    <div className="sheet-backdrop" role="presentation" onClick={onClose}>
      <section className="theme-sheet" role="dialog" aria-modal="true" aria-labelledby="theme-title" onClick={(event) => event.stopPropagation()}>
        <div className="sheet-handle" />
        <header className="exercise-sheet-header">
          <div>
            <span className="eyebrow">Aspetto</span>
            <h1 id="theme-title">Tema dell'app</h1>
            {flash && <p>{flash}</p>}
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Chiudi tema">
            <X size={26} />
          </button>
        </header>

        <div className="theme-options" role="listbox" aria-label="Scegli tema">
          {APP_THEMES.map((item) => {
            const active = item.id === theme
            return (
              <button
                key={item.id}
                type="button"
                className={`theme-option ${active ? 'selected' : ''}`}
                onClick={() => selectTheme(item.id)}
                aria-pressed={active}
                aria-selected={active}
              >
                <span className={`theme-preview theme-preview-${item.id}`} aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
                <span>
                  <strong>{item.name}</strong>
                  <small>{item.description}</small>
                </span>
                {active && <Check size={22} aria-hidden="true" />}
              </button>
            )
          })}
        </div>
      </section>
    </div>
  )
}
