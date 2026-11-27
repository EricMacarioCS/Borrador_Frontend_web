import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { CircleAlert, CircleCheck, LoaderCircle, Popcorn } from 'lucide-react'
import TicketCard from './TicketCard'
import { forgetCheckout } from './useCheckout'
import StateView from '@/shared/ui/StateView'
import { keys, usePurchase } from '@/app/queries'
import { useServices } from '@/app/services'
import { confirmAction, toast } from '@/shared/feedback'
import { PURCHASE_STATUS_LABELS } from '@/domain/labels'
import { formatDateTime } from '@/shared/lib/datetime'
import { formatMoney } from '@/shared/lib/money'
import { newIdempotencyKey } from '@/shared/lib/ids'
import { errorMessage } from '@/shared/lib/messages'
import { toApiError } from '@/shared/lib/errors'
import { cx } from '@/shared/lib/cx'
import styles from './PurchaseView.module.css'

export default function PurchaseView() {
  const { purchaseId = '' } = useParams()
  const [query] = useSearchParams()
  const navigate = useNavigate()
  const { checkout } = useServices()
  const queryClient = useQueryClient()
  const purchase = usePurchase(purchaseId)
  const isNew = query.get('nueva') === '1'
  const [cancelling, setCancelling] = useState(false)
  const cancelKey = useRef<string | null>(null)
  const data = purchase.data

  // Con el pago resuelto ya no hay nada que reintentar en esa función.
  useEffect(() => {
    if (data?.screening && data.status !== 'payment-pending' && data.status !== 'payment-failed') forgetCheckout(data.screening.id)
  }, [data])

  async function cancel() {
    if (!data) return
    const ok = await confirmAction({
      title: 'Cancelar compra',
      text: `Se reembolsarán ${formatMoney(data.totals.totalCents)} al método de pago original${data.ticketCode ? '. También se cancelan los pedidos de alimentos vinculados que no se hayan preparado' : ''}.`,
      confirmLabel: 'Cancelar compra',
      cancelLabel: 'Conservar',
      danger: true
    })
    if (!ok) return
    setCancelling(true)
    cancelKey.current ??= newIdempotencyKey()
    try {
      const updated = await checkout.cancelPurchase(data.id, cancelKey.current)
      queryClient.setQueryData(keys.purchase(data.id), updated)
      void queryClient.invalidateQueries({ queryKey: keys.purchases() })
      toast('Cancelación registrada. El reembolso está en proceso.')
    } catch (error) {
      toast(errorMessage(toApiError(error)), 'error')
    } finally {
      setCancelling(false)
    }
  }

  return (
    <div className={`container page ${styles.narrow}`}>
      <StateView loading={purchase.isPending} error={purchase.error} skeleton="block" onRetry={() => void purchase.refetch()}>
        {data && (
          <>
            <div className={cx(styles.status, styles[data.status])} role="status">
              {data.status === 'payment-pending'
                ? <LoaderCircle size={30} className={styles.spin} aria-hidden="true" />
                : data.status === 'confirmed' ? <CircleCheck size={30} aria-hidden="true" /> : <CircleAlert size={30} aria-hidden="true" />}
              <div>
                <h1>
                  {data.status === 'payment-pending'
                    ? 'Estamos confirmando tu pago'
                    : data.status === 'confirmed'
                      ? (isNew ? '¡Compra confirmada!' : 'Compra confirmada')
                      : data.status === 'payment-failed' ? 'El pago no se completó' : PURCHASE_STATUS_LABELS[data.status]}
                </h1>
                {data.status === 'payment-pending'
                  ? <p>No cierres esta página. Tarda unos segundos.</p>
                  : data.status === 'payment-failed'
                    ? <p>No se realizó ningún cargo. Tus asientos siguen apartados mientras dure el tiempo.</p>
                    : data.refund.status !== 'none'
                      ? <p>Reembolso: {formatMoney(data.refund.amountCents)} · {data.refund.status === 'completed' ? 'completado' : 'en proceso'}</p>
                      : <p className="muted">Compra del {formatDateTime(data.createdAt)}</p>}
              </div>
            </div>

            {data.status === 'payment-failed' && data.screening && (
              <button type="button" className="btn btn-primary" onClick={() => void navigate(`/compra/${data.screening!.id}`)}>Intentar de nuevo</button>
            )}

            {data.status !== 'payment-failed' && <TicketCard purchase={data} />}

            <div className={styles.actions}>
              {data.ticketCode && data.status === 'confirmed' && (
                <Link to={`/dulceria?${new URLSearchParams({ folio: data.ticketCode, complejo: data.complex.id }).toString()}`} className="btn btn-secondary">
                  <Popcorn size={18} /> Pedir alimentos con este folio
                </Link>
              )}
              <Link to="/mi-cuenta" className="btn btn-ghost">Ver mis compras</Link>
              {data.cancellation.allowed && (
                <button type="button" className={`btn btn-ghost ${styles.danger}`} disabled={cancelling} onClick={() => void cancel()}>
                  {cancelling ? 'Cancelando…' : 'Cancelar compra'}
                </button>
              )}
            </div>
            {data.status === 'confirmed' && data.cancellation.until && (
              <p className={`muted ${styles.small}`}>
                {data.cancellation.allowed ? `Puedes cancelar hasta el ${formatDateTime(data.cancellation.until)}.` : data.cancellation.reason}
              </p>
            )}
          </>
        )}
      </StateView>
    </div>
  )
}
