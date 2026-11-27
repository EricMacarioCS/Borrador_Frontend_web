/** Tipo de boleto de un asiento: todas las opciones y sus precios a la vista. */
import { useId } from 'react'
import { Check } from 'lucide-react'
import type { TicketPrice } from '@/domain/models'
import { formatMoney } from '@/shared/lib/money'
import { cx } from '@/shared/lib/cx'
import styles from './TicketTypePicker.module.css'

interface Props {
  seatLabel: string
  prices: TicketPrice[]
  value: string
  onChange: (value: string) => void
}

export default function TicketTypePicker({ seatLabel, prices, value, onChange }: Props) {
  const uid = useId()
  const current = prices.find(price => price.ticketTypeId === value)
  return (
    <fieldset className={styles.seatTicket}>
      <legend className="visually-hidden">Tipo de boleto del asiento {seatLabel}</legend>
      <p className={styles.head} aria-hidden="true">
        <strong>Asiento {seatLabel}</strong>
        {current && <span>{current.name} · {formatMoney(current.priceCents)}</span>}
      </p>
      <div className={styles.options}>
        {prices.map(price => (
          <label key={price.ticketTypeId} className={cx(styles.option, value === price.ticketTypeId && styles.checked, !price.allowed && styles.off)}>
            <input className="visually-hidden" type="radio" name={uid} value={price.ticketTypeId} checked={value === price.ticketTypeId}
              disabled={!price.allowed} onChange={() => onChange(price.ticketTypeId)} />
            <span className={styles.mark} aria-hidden="true"><Check size={12} strokeWidth={3.5} /></span>
            <span className={styles.name}>{price.name}</span>
            <strong>{formatMoney(price.priceCents)}</strong>
            <small>{price.allowed ? price.description : price.reason ?? 'No disponible'}</small>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
