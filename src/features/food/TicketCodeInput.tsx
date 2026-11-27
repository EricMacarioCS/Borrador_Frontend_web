/**
 * Folio de boletos: se valida solo cuando el formato está completo, sin botón.
 * Espera 300 ms, cancela la validación anterior y respeta el límite de intentos del servidor.
 */
import { useEffect, useRef, useState } from 'react'
import { CircleCheck, LoaderCircle, Ticket, X } from 'lucide-react'
import { useServices } from '@/app/services'
import type { TicketCodeGrant } from '@/domain/models'
import { completeTicketCode } from '@/shared/lib/text'
import { toApiError } from '@/shared/lib/errors'
import { errorMessage } from '@/shared/lib/messages'
import { formatDateTime } from '@/shared/lib/datetime'
import { cx } from '@/shared/lib/cx'
import styles from './TicketCodeInput.module.css'

interface Props {
  complexId: string
  initial?: string | null
  grant: TicketCodeGrant | null
  onValidated: (grant: TicketCodeGrant | null) => void
}

export default function TicketCodeInput({ complexId, initial, grant, onValidated }: Props) {
  const { checkout } = useServices()
  const [value, setValue] = useState(initial ?? grant?.ticketCode ?? '')
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState('')
  const run = useRef(0)
  // Valores actuales para la validación diferida, sin volver a dispararla.
  const latest = useRef({ grant, onValidated })
  useEffect(() => { latest.current = { grant, onValidated } })

  useEffect(() => {
    const code = completeTicketCode(value)
    const { grant: current, onValidated: emit } = latest.current
    if (current && code === current.ticketCode && current.complexId === complexId) return
    if (current) emit(null)
    setError('')
    const attempt = ++run.current
    setChecking(false)
    if (!code) return
    const timer = window.setTimeout(() => {
      setChecking(true)
      checkout.validateTicketCode(code, complexId)
        .then(result => { if (attempt === run.current) latest.current.onValidated(result) })
        .catch((failure: unknown) => {
          if (attempt !== run.current) return
          setError(errorMessage(toApiError(failure)))
          latest.current.onValidated(null)
        })
        .finally(() => { if (attempt === run.current) setChecking(false) })
    }, 300)
    return () => clearTimeout(timer)
  }, [value, complexId, checkout])

  function clear() {
    setValue('')
    onValidated(null)
  }

  return (
    <div className={cx(grant && styles.ok, error && styles.error)}>
      <label className="field">
        <span>Folio de tus boletos</span>
        <span className={styles.inputWrap}>
          <Ticket size={18} aria-hidden="true" />
          <input value={value} onChange={event => setValue(event.target.value)} className="input" placeholder="CIN-XXXX-XXXX-XXXX" autoComplete="off"
            spellCheck={false} autoCapitalize="characters" aria-invalid={!!error} aria-describedby="folio-estado" />
          {checking
            ? <LoaderCircle size={18} className={styles.spin} aria-hidden="true" />
            : value && <button type="button" className={styles.clear} aria-label="Borrar folio" onClick={clear}><X size={16} /></button>}
        </span>
      </label>
      <p id="folio-estado" className={styles.status} aria-live="polite">
        {checking
          ? 'Validando folio…'
          : grant
            ? <><CircleCheck size={16} aria-hidden="true" /> <span>Boletos de <strong>{grant.movieTitle}</strong>, {formatDateTime(grant.startsAt)}</span></>
            : error}
      </p>
    </div>
  )
}
