import { useEffect, useRef, type ReactNode } from 'react'

type Props = {
  children: ReactNode
  onClose: () => void
  labelledBy?: string
  label?: string
  busy?: boolean
  className?: string
  closeOnBackdrop?: boolean
}

const focusable = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function DialogSheet({ children, onClose, labelledBy, label, busy = false, className = 'add-player-sheet', closeOnBackdrop = true }: Props) {
  const dialogRef = useRef<HTMLElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const dialog = dialogRef.current
    const initial = dialog?.querySelector<HTMLElement>('[autofocus]') ?? dialog?.querySelector<HTMLElement>(focusable)
    initial?.focus()
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) { event.preventDefault(); onCloseRef.current(); return }
      if (event.key !== 'Tab' || !dialog) return
      const nodes = Array.from(dialog.querySelectorAll<HTMLElement>(focusable))
      if (nodes.length === 0) { event.preventDefault(); dialog.focus(); return }
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', keydown)
    return () => { document.removeEventListener('keydown', keydown); document.body.style.overflow = previousOverflow; previous?.focus() }
  }, [busy])
  return <div className="sheet-backdrop add-player-backdrop" role="presentation" onMouseDown={event => { if (closeOnBackdrop && !busy && event.target === event.currentTarget) onClose() }}><section ref={dialogRef} className={className} role="dialog" aria-modal="true" aria-labelledby={labelledBy} aria-label={label} tabIndex={-1}>{children}</section></div>
}
