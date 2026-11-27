/** Pago de dulcería sin boletos nuevos: folio (si aplica), momento de recolección, cotización y pago. */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { ArrowLeft } from 'lucide-react'
import BrandMark from '@/app/layout/BrandMark'
import TicketCodeInput from './TicketCodeInput'
import PaymentForm, { type PaymentFormHandle } from '@/features/checkout/PaymentForm'
import BaseSelect from '@/shared/ui/BaseSelect'
import { useServices } from '@/app/services'
import { cartStore, useCartStore } from '@/app/stores/cart'
import { useAppStore } from '@/app/stores/app'
import type { Quote } from '@/domain/models'
import { PICKUP_LABELS } from '@/domain/labels'
import { formatMoney } from '@/shared/lib/money'
import { newIdempotencyKey } from '@/shared/lib/ids'
import { toApiError, type ApiError } from '@/shared/lib/errors'
import { errorMessage } from '@/shared/lib/messages'
import { serverNow } from '@/shared/lib/clock'
import { session } from '@/shared/lib/storage'
import { PENDING_TICKET_CODE_KEY } from './selection'
import styles from './FoodCheckoutView.module.css'

type Pickup = 'before' | 'during'

export default function FoodCheckoutView() {
  const { checkout } = useServices()
  const lines = useCartStore(state => state.lines)
  const grant = useCartStore(state => state.grant)
  const complexId = useCartStore(state => state.complexId)
  const needsTicketCode = useCartStore(state => state.needsTicketCode)
  const setGrant = useCartStore(state => state.setGrant)
  const complex = useAppStore(state => complexId ? state.complexById(complexId) : undefined)
  const email = useAppStore(state => state.session.email)
  const navigate = useNavigate()

  const [chosenPickup, setPickup] = useState<Pickup>('before')
  const [quote, setQuote] = useState<Quote | null>(null)
  const [quoteError, setQuoteError] = useState<ApiError | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const form = useRef<PaymentFormHandle>(null)
  const [pendingCode] = useState(() => session.get<string | null>(PENDING_TICKET_CODE_KEY, null))
  const purchaseKey = useRef<string | null>(null)
  const latestQuote = useRef<Quote | null>(null)

  const ready = lines.length > 0 && (!needsTicketCode || grant !== null)
  // Si la función ya empezó, solo se puede recoger durante la película.
  const started = grant ? grant.startsAt.getTime() <= serverNow() : false
  const pickupOptions = (['before', 'during'] as const).filter(value => !(started && value === 'before')).map(value => ({ value, label: PICKUP_LABELS[value] }))
  const pickup = pickupOptions.some(option => option.value === chosenPickup) ? chosenPickup : pickupOptions[0]!.value

  const run = useRef(0)
  const requote = useCallback(async () => {
    const cart = cartStore.getState()
    const isReady = cart.lines.length > 0 && (!cart.needsTicketCode || cart.grant !== null)
    const current = ++run.current
    if (!isReady || !cart.complexId) {
      latestQuote.current = null
      setQuote(null)
      return
    }
    try {
      const result = await checkout.createQuote({
        complexId: cart.complexId, holdId: null, ticketCodeGrant: cart.grant?.grant ?? null, tickets: [],
        items: cart.lines.map(({ productId, quantity, choices }) => ({ productId, quantity, choices })),
        promotionId: null, pickup
      })
      if (current === run.current) {
        latestQuote.current = result
        setQuote(result)
        setQuoteError(null)
        purchaseKey.current = null
      }
    } catch (failure) {
      if (current === run.current) {
        latestQuote.current = null
        setQuote(null)
        setQuoteError(toApiError(failure))
      }
    }
  }, [checkout, pickup])

  useEffect(() => {
    void requote()
  }, [lines, grant, requote])

  async function pay() {
    const data = form.current?.submit()
    if (!data || !latestQuote.current || busy) return
    setBusy(true)
    setError('')
    try {
      if (latestQuote.current.expiresAt.getTime() - serverNow() < 5000) await requote()
      const current = latestQuote.current
      if (!current) return
      const key = purchaseKey.current ??= newIdempotencyKey()
      const purchase = await checkout.createPurchase({ quoteId: current.id, customer: data.customer, paymentMethod: data.method }, key)
        .catch(async (failure: unknown) => {
          const apiError = toApiError(failure)
          const found = apiError.status === 0 || apiError.status >= 500 ? await checkout.findPurchaseByKey(key).catch(() => null) : null
          if (found) return found
          throw apiError
        })
      cartStore.getState().clear()
      session.remove(PENDING_TICKET_CODE_KEY)
      if (purchase.payment.kind === 'redirect') window.location.assign(purchase.payment.url)
      else void navigate(`/compras/${purchase.id}?nueva=1`, { replace: true })
    } catch (failure) {
      const apiError = toApiError(failure)
      setError(errorMessage(apiError))
      if (apiError.code === 'QUOTE_EXPIRED' || apiError.code === 'OUT_OF_STOCK') await requote()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <header className={styles.top}>
        <Link to="/dulceria" className={styles.back}><ArrowLeft size={20} /> Seguir comprando</Link>
        <Link to="/" className={styles.brand} aria-label="Inicio"><BrandMark /></Link>
      </header>
      <div className={`container ${styles.layout}`}>
        <section className={styles.main}>
          <h1>Pago de dulcería</h1>
          {!lines.length
            ? (
              <div className={`card ${styles.empty}`}>
                <p>Tu carrito está vacío.</p>
                <Link to="/dulceria" className="btn btn-primary">Ver dulcería</Link>
              </div>
            )
            : (
              <>
                <div className={styles.panel}>
                  <p>Recoges en <strong>{complex?.name}</strong></p>
                  {needsTicketCode && complexId
                    ? <TicketCodeInput complexId={complexId} initial={pendingCode} grant={grant} onValidated={setGrant} />
                    : <p className="notice">Tu pedido no requiere folio. Lo recoges con el nombre y correo de la compra.</p>}
                  <BaseSelect value={pickup} onChange={setPickup} label="¿Cuándo lo recoges?" options={pickupOptions} />
                </div>
                <PaymentForm ref={form} initialEmail={email} />
                {error && <p className="notice notice-error" role="alert">{error}</p>}
              </>
            )}
        </section>
        {lines.length > 0 && (
          <aside className={`card ${styles.summary}`} aria-label="Resumen del pedido">
            <h2>Tu pedido</h2>
            <ul className={styles.lines} role="list">
              {(quote?.lines ?? []).map(line => (
                <li key={line.description + line.detail}>
                  <span>{line.quantity} × {line.description}{line.detail && <small>{line.detail}</small>}</span>
                  <span>{formatMoney(line.totalCents)}</span>
                </li>
              ))}
            </ul>
            {!quote && !quoteError && <p className="muted">{needsTicketCode && !grant ? 'Valida tu folio para ver el total.' : ready ? 'Calculando total…' : ''}</p>}
            {quoteError && <p className="notice notice-error" role="alert">{errorMessage(quoteError)}</p>}
            {quote && <p className={styles.total}><span>Total</span><strong>{formatMoney(quote.totalCents)}</strong></p>}
            <button type="button" className="btn btn-primary btn-block" disabled={!quote || busy} onClick={() => void pay()}>
              {busy ? 'Procesando…' : quote ? `Pagar ${formatMoney(quote.totalCents)}` : 'Pagar'}
            </button>
          </aside>
        )}
      </div>
    </div>
  )
}
