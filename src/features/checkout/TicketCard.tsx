/** Entrada digital. El QR usa la credencial de acceso del servidor, no el folio. */
import type { Purchase } from '@/domain/models'
import QrCode from '@/shared/ui/QrCode'
import { formatDateTime } from '@/shared/lib/datetime'
import { formatMoney } from '@/shared/lib/money'
import { PICKUP_LABELS } from '@/domain/labels'
import { useAppStore } from '@/app/stores/app'
import styles from './TicketCard.module.css'

export default function TicketCard({ purchase }: { purchase: Purchase }) {
  const timeZone = useAppStore(state => state.complexById(purchase.complex.id)?.timeZone)
  return (
    <article className={styles.ticket}>
      {purchase.admissionToken && purchase.status === 'confirmed' && (
        <div className={styles.qr}>
          <QrCode value={`CPA1:${purchase.admissionToken}`} label={`Código de acceso de la compra ${purchase.ticketCode ?? ''}`} />
          <small>Muéstralo en la entrada</small>
        </div>
      )}
      <div className={styles.detail}>
        <span className="eyebrow">{purchase.screening ? 'Entrada digital' : 'Pedido de dulcería'}</span>
        <h2>{purchase.screening?.movieTitle ?? purchase.complex.name}</h2>
        {purchase.screening && (
          <>
            <p>{purchase.complex.name}</p>
            <p>{formatDateTime(purchase.screening.startsAt, timeZone)}</p>
            <p>{purchase.screening.room} · {purchase.screening.roomType} · {purchase.screening.projection} · {purchase.screening.language}</p>
            <p className={styles.seats}>Asientos: <strong>{purchase.tickets.map(ticket => `${ticket.seatLabel} (${ticket.ticketType})`).join(', ')}</strong></p>
          </>
        )}
        {purchase.items.length > 0 && (
          <div className={styles.items}>
            <strong>Alimentos{purchase.pickup ? ` · ${PICKUP_LABELS[purchase.pickup]}` : ''}</strong>
            <ul role="list">
              {purchase.items.map((item, index) => <li key={index}>{item.quantity} × {item.name}{item.detail && <small> · {item.detail}</small>}</li>)}
            </ul>
          </div>
        )}
        {purchase.linkedTicketCode && <p className="muted">Vinculado al folio {purchase.linkedTicketCode}.</p>}
        <p className={styles.total}>Total: <strong>{formatMoney(purchase.totals.totalCents)}</strong></p>
        {purchase.ticketCode
          ? <p className={styles.code}>Folio <strong>{purchase.ticketCode}</strong></p>
          : purchase.linkedTicketCode
            ? <p className={`muted ${styles.small}`}>Recoge mostrando el folio de tus boletos.</p>
            : <p className={`muted ${styles.small}`}>Recoge con el nombre y correo de la compra.</p>}
      </div>
    </article>
  )
}
