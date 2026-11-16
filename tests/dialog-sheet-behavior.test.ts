import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const dialog = readFileSync('src/components/DialogSheet.tsx', 'utf8')
const fieldMode = readFileSync('src/components/FieldModeExperience.tsx', 'utf8')

describe('DialogSheet modal behavior', () => {
  it('portals dialogs outside page stacking contexts and locks both document roots', () => {
    expect(dialog).toContain('createPortal(')
    expect(dialog).toContain(', document.body)')
    expect(dialog).toContain("root.style.overflow = 'hidden'")
    expect(dialog).toContain("document.body.style.position = 'fixed'")
    expect(dialog).toContain('document.body.style.top = `-${scrollY}px`')
  })
  it('restores scroll, focus and handles Escape through current refs', () => {
    expect(dialog).toContain('window.scrollTo(0, scrollY)')
    expect(dialog).toContain('previous?.focus()')
    expect(dialog).toContain("event.key === 'Escape'")
    expect(dialog).toContain('onCloseRef.current()')
  })
  it('keeps draft confirmation and exposes an explicit Field Mode close action', () => {
    expect(fieldMode).toContain("window.confirm('La nota non è ancora salvata.")
    expect(fieldMode).toContain('aria-label="Chiudi Modalità Campo"')
    expect(fieldMode).toContain('<X size={18} />Chiudi')
  })
})
