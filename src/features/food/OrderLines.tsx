/** Productos elegidos con su cantidad. Lo usan el carrito, la pestaña Dulcería y la compra de boletos. */
import { Trash2 } from 'lucide-react'
import QuantityStepper from '@/shared/ui/QuantityStepper'
import { formatMoney } from '@/shared/lib/money'
import type { CartLine } from '@/app/stores/cart'
import styles from './OrderLines.module.css'

export default function OrderLines({ lines, onQuantity }: { lines: CartLine[]; onQuantity: (key: string, quantity: number) => void }) {
  return (
    <ul className={styles.lines} role="list">
      {lines.map(line => (
        <li key={line.key}>
          <div className={styles.info}>
            <strong>{line.name}</strong>
            {line.detail && <small>{line.detail}</small>}
            <span>{formatMoney(line.estimateCents * line.quantity)}</span>
          </div>
          <div className={styles.controls}>
            <QuantityStepper value={line.quantity} label={line.name} min={1} max={10} onChange={value => onQuantity(line.key, value)} />
            <button type="button" className={styles.remove} aria-label={`Quitar ${line.name}`} onClick={() => onQuantity(line.key, 0)}><Trash2 size={18} /></button>
          </div>
        </li>
      ))}
    </ul>
  )
}
