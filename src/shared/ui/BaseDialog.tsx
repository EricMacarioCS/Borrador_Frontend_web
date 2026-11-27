/**
 * Ventana basada en <dialog>: el navegador da foco atrapado, Esc y fondo inerte.
 * `side` la convierte en panel lateral (carrito, menú).
 */
import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cx } from '@/shared/lib/cx'
import styles from './BaseDialog.module.css'

interface Props {
  open: boolean
  label: string
  onClose: () => void
  side?: 'center' | 'right' | 'left'
  size?: 'small' | 'medium' | 'large'
  closeOnBackdrop?: boolean
  hideClose?: boolean
  header?: ReactNode
  footer?: ReactNode
  children?: ReactNode
}

export default function BaseDialog({
  open, label, onClose, side = 'center', size = 'medium', closeOnBackdrop = true, hideClose = false, header, footer, children
}: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const body = useRef<HTMLDivElement>(null)
  const opener = useRef<HTMLElement | null>(null)
  // Valores actuales para los eventos nativos, sin volver a registrar nada.
  const latest = useRef({ open, onClose })
  useLayoutEffect(() => { latest.current = { open, onClose } })

  useEffect(() => {
    const element = dialog.current
    if (!element) return
    if (open && !element.open) {
      opener.current = document.activeElement as HTMLElement | null
      element.showModal()
      document.documentElement.style.overflow = 'hidden'
      const target = element.querySelector<HTMLElement>('[autofocus], [data-autofocus]')
        ?? body.current?.querySelector<HTMLElement>('input, button, select, textarea, [tabindex="0"]')
      target?.focus()
    } else if (!open && element.open) {
      element.close()
    }
  }, [open])

  useEffect(() => () => {
    if (dialog.current?.open) {
      dialog.current.close()
      document.documentElement.style.overflow = ''
    }
  }, [])

  function onClosed() {
    document.documentElement.style.overflow = ''
    if (opener.current?.isConnected) opener.current.focus()
    if (latest.current.open) latest.current.onClose()
  }

  return (
    <dialog ref={dialog} className={cx(styles.dialog, styles[side], styles[size])} aria-label={label}
      onCancel={event => { event.preventDefault(); onClose() }} onClose={onClosed}
      onClick={event => { if (closeOnBackdrop && event.target === dialog.current) onClose() }}>
      <div className={styles.panel}>
        {(header || !hideClose) && (
          <header className={styles.header}>
            {header}
            {!hideClose && <button type="button" className={styles.close} aria-label="Cerrar" onClick={onClose}><X size={22} /></button>}
          </header>
        )}
        <div ref={body} className={styles.body}>{children}</div>
        {footer && <footer className={styles.footer}>{footer}</footer>}
      </div>
    </dialog>
  )
}
