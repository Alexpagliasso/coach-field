import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

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
  const busyRef = useRef(busy)
  onCloseRef.current = onClose
  busyRef.current = busy
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : undefined
    const root = document.documentElement
    const scrollY = window.scrollY
    const previousOverflow = document.body.style.overflow
    const previousHtmlOverflow = root.style.overflow
    const previousPosition = document.body.style.position
    const previousTop = document.body.style.top
    const previousWidth = document.body.style.width
    root.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollY}px`
    document.body.style.width = '100%'
    const dialog = dialogRef.current
    const initial = dialog?.querySelector<HTMLElement>('[autofocus]') ?? dialog?.querySelector<HTMLElement>(focusable)
    initial?.focus()
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busyRef.current) { event.preventDefault(); onCloseRef.current(); return }
      if (event.key !== 'Tab' || !dialog) return
      const nodes = Array.from(dialog.querySelectorAll<HTMLElement>(focusable))
      if (nodes.length === 0) { event.preventDefault(); dialog.focus(); return }
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', keydown)
    return () => { document.removeEventListener('keydown', keydown); root.style.overflow = previousHtmlOverflow; document.body.style.overflow = previousOverflow; document.body.style.position = previousPosition; document.body.style.top = previousTop; document.body.style.width = previousWidth; window.scrollTo(0, scrollY); previous?.focus() }
  }, [])
  return createPortal(<div className="sheet-backdrop add-player-backdrop" role="presentation" onMouseDown={event => { if (closeOnBackdrop && !busy && event.target === event.currentTarget) onCloseRef.current() }}><section ref={dialogRef} className={className} role="dialog" aria-modal="true" aria-labelledby={labelledBy} aria-label={label} tabIndex={-1}>{children}</section></div>, document.body)
}
