import type { ReactNode } from 'react'
import type { Movie, Quote, Screening, SeatLayout } from '@/domain/models'
import PosterArt from '@/shared/ui/PosterArt'
import { formatDate, formatTime } from '@/shared/lib/datetime'
import { formatMoney } from '@/shared/lib/money'
import { useAppStore } from '@/app/stores/app'
import styles from './OrderSummary.module.css'

interface Props {
  movie: Movie | undefined
  screening: Screening
  layout: SeatLayout | undefined
  seatIds: string[]
  quote: Quote | null
  quoting: boolean
  children?: ReactNode
}

export default function OrderSummary({ movie, screening, layout, seatIds, quote, quoting, children }: Props) {
  const complex = useAppStore(state => state.complexById(screening.complexId))
  const map = new Map(layout?.rows.flatMap(row => row.cells.flatMap(cell => cell ? [[cell.id, cell.label] as const] : [])) ?? [])
  const labels = seatIds.map(id => map.get(id) ?? id)

  return (
    <aside className={styles.summary} aria-label="Resumen de tu compra">
      <div className={styles.head}>
        {movie && <PosterArt className={styles.poster} title={movie.title} accent={movie.accent} src={movie.posterUrl} decorative />}
        <div>
          <strong className={styles.title}>{movie?.title ?? 'Función'}</strong>
          {movie && <span className="badge badge-rating">{movie.rating.code}</span>}
          <p>{complex?.name}</p>
          <p>{formatDate(screening.businessDate)} · {formatTime(screening.startsAt, complex?.timeZone)}</p>
          <p>{screening.room.label} · {screening.room.type.name} · {screening.projection.name} · {screening.language.name}</p>
        </div>
      </div>
      <div className={styles.body}>
        <p className={styles.seats}><span>Asientos</span><strong>{labels.length ? labels.join(', ') : 'Sin elegir'}</strong></p>
        {quote
          ? (
            <>
              <ul className={styles.lines} role="list" aria-busy={quoting}>
                {quote.lines.map((line, index) => (
                  <li key={index}>
                    <span>{line.quantity} × {line.description}{line.detail && <small>{line.detail}</small>}</span>
                    <span>{formatMoney(line.totalCents)}</span>
                  </li>
                ))}
                {quote.discountCents > 0 && <li className={styles.discount}><span>{quote.promotion?.title}</span><span>−{formatMoney(quote.discountCents)}</span></li>}
                {quote.serviceFeeCents > 0 && <li><span>Cargo por servicio en línea</span><span>{formatMoney(quote.serviceFeeCents)}</span></li>}
              </ul>
              <p className={styles.total}><span>Total</span><strong>{formatMoney(quote.totalCents)}</strong></p>
              {quote.promotion && !quote.promotion.applied && <p className="notice notice-warning">{quote.promotion.title}: {quote.promotion.reason}</p>}
            </>
          )
          : seatIds.length > 0 && <p className="muted">El total se calcula al confirmar tus asientos.</p>}
        {quoting && <p className={`muted ${styles.small}`} role="status">Actualizando total…</p>}
      </div>
      <div className={styles.actions}>{children}</div>
    </aside>
  )
}
