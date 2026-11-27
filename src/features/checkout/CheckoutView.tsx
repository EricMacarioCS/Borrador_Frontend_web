import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Check, Radio, WifiOff } from 'lucide-react'
import BrandMark from '@/app/layout/BrandMark'
import SeatMap from '@/features/seats/SeatMap'
import { useSeatMap } from '@/features/seats/useSeatMap'
import FoodCatalog from '@/features/food/FoodCatalog'
import OrderLines from '@/features/food/OrderLines'
import OrderSummary from './OrderSummary'
import PaymentForm, { type PaymentFormHandle } from './PaymentForm'
import TicketTypePicker from './TicketTypePicker'
import { promotionApplies } from './promotions'
import { STEPS, useCheckout, type Step } from './useCheckout'
import BaseSelect from '@/shared/ui/BaseSelect'
import CountdownTimer from '@/shared/ui/CountdownTimer'
import StateView from '@/shared/ui/StateView'
import { usePromotions, useScreening } from '@/app/queries'
import { useServices } from '@/app/services'
import { useAppStore } from '@/app/stores/app'
import { setLeaveGuard } from '@/app/navigation'
import { confirmAction, toast } from '@/shared/feedback'
import { formatMoney } from '@/shared/lib/money'
import { errorMessage } from '@/shared/lib/messages'
import { cx } from '@/shared/lib/cx'
import { PICKUP_LABELS } from '@/domain/labels'
import type { SeatCell } from '@/domain/models'
import type { CartLine } from '@/app/stores/cart'
import styles from './CheckoutView.module.css'

const EXCLUDED_FOOD = ['promocionales']
const PICKUP_OPTIONS = [
  { value: 'before' as const, label: PICKUP_LABELS.before },
  { value: 'during' as const, label: PICKUP_LABELS.during }
]
const CHANNEL_TEXT = {
  connected: 'Disponibilidad en tiempo real',
  connecting: 'Conectando…',
  reconnecting: 'Reconectando. Los asientos se actualizarán al volver la conexión.',
  disconnected: 'Sin tiempo real: la disponibilidad se revisa periódicamente.'
}

const confirmLeave = () => confirmAction({
  title: 'Salir de la compra',
  text: 'Si sales, perderás los asientos que elegiste y volverán a estar disponibles para otras personas.',
  cancelLabel: 'Seguir comprando',
  confirmLabel: 'Salir',
  danger: true
})

export default function CheckoutView() {
  const { screeningId = '' } = useParams()
  const navigate = useNavigate()
  const max = useAppStore(state => state.limits.maxSeatsPerPurchase)
  const email = useAppStore(state => state.session.email)
  const { catalog, checkout: checkoutPort } = useServices()

  const screening = useScreening(screeningId)
  const movieId = screening.data?.movieId
  const movie = useQuery({
    queryKey: ['movie-by-id', movieId],
    queryFn: ({ signal }) => catalog.getMovie(movieId!, signal),
    enabled: Boolean(movieId)
  })
  const prices = useQuery({
    queryKey: ['ticket-prices', screeningId],
    queryFn: ({ signal }) => checkoutPort.getTicketPrices(screeningId, signal)
  })
  const promotions = usePromotions()
  const complexId = screening.data?.complexId ?? null
  const [foodCategory, setFoodCategory] = useState('todas')

  const checkout = useCheckout(screeningId, complexId)
  const { state, set, restore, toggleSeat, confirmSeats, goTo, expire, pay, release } = checkout
  const seatMap = useSeatMap(screeningId, screening.data?.layout ?? null)

  const selectedSet = useMemo(() => new Set(state.selected), [state.selected])
  const stepIndex = STEPS.findIndex(step => step.id === state.step)
  const paymentForm = useRef<PaymentFormHandle>(null)
  const leaving = useRef(false)

  useEffect(() => {
    let active = true
    void restore().then(paidId => {
      if (active && paidId) void navigate(`/compras/${paidId}`, { replace: true })
    })
    return () => { active = false }
    // Solo al montar: la compra se recupera una vez por pantalla.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** Solo las promociones que pueden aplicar al día, formato y horario de esta función. */
  const timeZone = useAppStore(app => screening.data ? app.complexById(screening.data.complexId)?.timeZone : undefined)
  const eligiblePromotions = useMemo(() => {
    const current = screening.data
    if (!current) return []
    return (promotions.data ?? []).filter(item => promotionApplies(item, current, timeZone))
  }, [screening.data, promotions.data, timeZone])
  const promotionOptions = [
    { value: '', label: 'Sin promoción' },
    ...eligiblePromotions.map(item => ({ value: item.id, label: item.title, hint: item.description }))
  ]
  // Una promoción recuperada de la sesión que ya no se ofrece no debe quedar elegida sin verse.
  const hasScreening = Boolean(screening.data)
  const hasPromotions = Boolean(promotions.data)
  useEffect(() => {
    if (!hasScreening || !hasPromotions || !state.promotionId) return
    if (!eligiblePromotions.some(item => item.id === state.promotionId)) set({ promotionId: null })
  }, [eligiblePromotions, hasScreening, hasPromotions, state.promotionId, state.restored, set])

  const layout = seatMap.layout.data
  const seatLabel = (id: string) => layout?.rows.flatMap(row => row.cells).find(cell => cell?.id === id)?.label ?? id

  // Si alguien más aparta un asiento que aquí solo estaba marcado, se quita de la selección y se avisa.
  const snapshot = seatMap.snapshot
  useEffect(() => {
    const current = checkout.store.getState()
    // Mientras se confirma, el evento puede llegar antes que la respuesta del propio apartado.
    if (!snapshot || current.step !== 'seats' || current.busy) return
    const mine = new Set(current.hold?.seatIds ?? [])
    const lost = current.selected.filter(id => !mine.has(id) && (snapshot.seats[id] ?? 'available') !== 'available')
    if (!lost.length) return
    const label = (id: string) => layout?.rows.flatMap(row => row.cells).find(cell => cell?.id === id)?.label ?? id
    set({
      selected: current.selected.filter(id => !lost.includes(id)),
      error: lost.length === 1
        ? `Otra persona acaba de apartar el asiento ${label(lost[0]!)}. Elige otro lugar.`
        : `Otra persona acaba de apartar los asientos ${lost.map(label).join(', ')}. Elige otros lugares.`
    })
  }, [snapshot, layout, checkout.store, set])

  function onSeat(seat: SeatCell) {
    toggleSeat(seat.id, max)
  }

  function addItem(line: Omit<CartLine, 'key'>) {
    const key = `${line.productId}|${JSON.stringify(line.choices)}`
    const items = checkout.store.getState().items
    const existing = items.find(item => item.key === key)
    set({
      items: existing
        ? items.map(item => item.key === key ? { ...item, quantity: Math.min(10, item.quantity + line.quantity) } : item)
        : [...items, { ...line, key }]
    })
    toast(`${line.name} agregado a tu compra.`)
  }
  function setItemQuantity(key: string, quantity: number) {
    const items = checkout.store.getState().items
    set({ items: quantity <= 0 ? items.filter(item => item.key !== key) : items.map(item => item.key === key ? { ...item, quantity } : item) })
  }

  /** Sale de la compra sin volver a preguntar. */
  function leaveTo(path: string, replace = false) {
    leaving.current = true
    setLeaveGuard(null)
    void navigate(path, { replace })
  }

  async function next() {
    if (state.step === 'seats') return confirmSeats(seatMap.refresh)
    if (state.step === 'tickets') return goTo('food')
    if (state.step === 'food') return goTo('payment')
    const data = paymentForm.current?.submit()
    if (!data) return
    const purchaseId = await pay(data.customer, data.method)
    if (purchaseId) leaveTo(`/compras/${purchaseId}?nueva=1`, true)
  }

  const shownIds = state.hold && state.step !== 'seats' ? state.hold.seatIds : state.selected
  const mobileTotal = state.step !== 'seats' && state.quote ? formatMoney(state.quote.totalCents) : `${state.selected.length} de ${max}`
  const mobileDetail = !shownIds.length
    ? 'Ningún asiento elegido'
    : state.step === 'seats' ? shownIds.map(seatLabel).join(', ') : `Total · ${shownIds.map(seatLabel).join(', ')}`

  function back(step: Step) {
    if (STEPS.findIndex(item => item.id === step) < stepIndex) goTo(step)
  }

  const nextLabel = state.step === 'seats'
    ? state.selected.length ? `Confirmar ${state.selected.length} ${state.selected.length === 1 ? 'asiento' : 'asientos'}` : 'Elige tus asientos'
    : state.step === 'tickets'
      ? 'Continuar a alimentos'
      : state.step === 'food'
        ? state.items.length ? 'Continuar al pago' : 'Omitir alimentos'
        : state.quote ? `Pagar ${formatMoney(state.quote.totalCents)}` : 'Pagar'
  const nextDisabled = state.busy || (state.step === 'seats' ? !state.selected.length : !state.quote || state.quoting || Boolean(state.quoteError))

  async function leave() {
    if (checkout.store.getState().hold) {
      const ok = await confirmLeave()
      if (!ok) return
      await release()
    }
    leaveTo(movie.data ? `/peliculas/${movie.data.slug}` : '/cartelera')
  }

  // Con asientos apartados, cualquier navegación pide confirmar y libera el apartado.
  const hasHold = state.hold !== null
  useEffect(() => {
    if (!hasHold || leaving.current) return
    setLeaveGuard(async () => {
      if (leaving.current || !checkout.store.getState().hold) return true
      const ok = await confirmLeave()
      if (ok) await release()
      return ok
    })
    return () => setLeaveGuard(null)
  }, [hasHold, checkout.store, release])

  // Al cerrar la pestaña el apartado vence solo; se avisa por si fue un descuido.
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (checkout.store.getState().hold && !leaving.current) event.preventDefault()
    }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [checkout.store])

  const data = screening.data
  const nextButton = (className: string) => (
    <button type="button" className={className} disabled={nextDisabled} onClick={() => void next()}>
      {state.busy ? 'Procesando…' : nextLabel}
    </button>
  )

  return (
    <div className={styles.checkout}>
      <header className={styles.top}>
        <button type="button" className={styles.back} onClick={() => void leave()}><ArrowLeft size={20} /> <span>Salir</span></button>
        <Link to="/" className={styles.brand} aria-label="Inicio"><BrandMark /></Link>
        {state.hold && <CountdownTimer until={state.hold.expiresAt} onExpired={expire} />}
      </header>

      <StateView loading={screening.isPending || !state.restored} error={screening.error} skeleton="block" className="container page" onRetry={() => void screening.refetch()}>
        {data && data.status !== 'on-sale' && !state.hold
          ? (
            <div className="container page">
              <div className={`card ${styles.closed}`}>
                <h1>Esta función no está disponible</h1>
                <p className="muted">{data.status === 'sold-out' ? 'Se agotaron los boletos.' : 'La venta en línea ya cerró.'}</p>
                <Link to="/cartelera" className="btn btn-primary">Ver otros horarios</Link>
              </div>
            </div>
          )
          : data && (
            <div className={`container ${styles.layout}`}>
              <section>
                <ol className={styles.steps} aria-label="Pasos de la compra">
                  {STEPS.map((step, index) => (
                    <li key={step.id} className={cx(step.id === state.step && styles.current, index < stepIndex && styles.done)}>
                      <button type="button" disabled={index >= stepIndex} aria-current={step.id === state.step ? 'step' : undefined} onClick={() => back(step.id)}>
                        <i>{index < stepIndex ? <Check size={14} /> : index + 1}</i>{step.label}
                      </button>
                    </li>
                  ))}
                </ol>
                {state.error && <p className={`notice notice-error ${styles.notice}`} role="alert">{state.error}</p>}
                {state.quoteError && state.step !== 'seats' && <p className={`notice notice-error ${styles.notice}`} role="alert">{errorMessage(state.quoteError)}</p>}

                {state.step === 'seats'
                  ? (
                    <div className={styles.panel}>
                      <div className={styles.panelHead}>
                        <h1>Elige tus asientos</h1>
                        <p className={cx(styles.live, styles[seatMap.channel])}>
                          {seatMap.channel === 'connected' ? <Radio size={16} /> : <WifiOff size={16} />} {CHANNEL_TEXT[seatMap.channel]}
                        </p>
                      </div>
                      <p className="muted">Hasta {max} asientos por compra. Al confirmarlos se apartan por un tiempo limitado.</p>
                      <StateView loading={seatMap.layout.isPending || !seatMap.snapshot} error={seatMap.layout.error} skeleton="block" onRetry={() => void seatMap.layout.refetch()}>
                        {layout && seatMap.snapshot && (
                          <SeatMap layout={layout} statuses={seatMap.snapshot.seats} selected={selectedSet} limitReached={state.selected.length >= max} onToggle={onSeat} />
                        )}
                      </StateView>
                      {seatMap.stale && <p className="notice notice-warning" role="status">No pudimos actualizar la disponibilidad. Reintentando…</p>}
                    </div>
                  )
                  : state.step === 'tickets'
                    ? (
                      <div className={styles.panel}>
                        <h1>Tipos de boleto</h1>
                        <p className="muted">Todos tus boletos empiezan como <strong>General</strong>. Si alguno es para otra persona, cambia su tipo aquí.</p>
                        <StateView loading={prices.isPending} error={prices.error} skeleton="rows" onRetry={() => void prices.refetch()}>
                          <div className={styles.ticketRows}>
                            {(state.hold?.seatIds ?? []).map(seatId => (
                              <TicketTypePicker key={seatId} value={state.types[seatId] ?? ''} onChange={value => set({ types: { ...checkout.store.getState().types, [seatId]: value } })}
                                seatLabel={seatLabel(seatId)} prices={prices.data ?? []} />
                            ))}
                          </div>
                        </StateView>
                        {eligiblePromotions.length > 0
                          ? (
                            <div className={styles.promotion}>
                              <BaseSelect value={state.promotionId ?? ''} onChange={value => set({ promotionId: value || null })} label="Promoción para esta función" options={promotionOptions} />
                              <p className={`muted ${styles.small}`}>Solo se aplica una promoción por compra.</p>
                            </div>
                          )
                          : promotions.data
                            ? <p className={`muted ${styles.small}`}>No hay promociones para esta función.</p>
                            : promotions.error && <p className={`muted ${styles.small}`}>No pudimos consultar las promociones. Puedes continuar sin ellas.</p>}
                      </div>
                    )
                    : state.step === 'food'
                      ? (
                        <div className={styles.panel}>
                          <h1>¿Quieres algo de la dulcería?</h1>
                          <p className="muted">El mismo menú de la dulcería. Se entrega con tus boletos, sin necesidad de folio. Es opcional.</p>
                          {state.items.length > 0 && (
                            <div className={styles.added}>
                              <h2>Agregado a tu compra</h2>
                              <OrderLines lines={state.items} onQuantity={setItemQuantity} />
                              <BaseSelect value={state.pickup} onChange={value => set({ pickup: value })} label="¿Cuándo los recoges?" options={PICKUP_OPTIONS} />
                            </div>
                          )}
                          <FoodCatalog category={foodCategory} onCategory={setFoodCategory} complexId={complexId} excludeCategories={EXCLUDED_FOOD} onAdd={addItem} />
                        </div>
                      )
                      : (
                        <div className={styles.panel}>
                          <h1>Revisa y paga</h1>
                          <PaymentForm ref={paymentForm} initialEmail={email} />
                        </div>
                      )}
              </section>

              <OrderSummary movie={movie.data} screening={data} layout={layout}
                seatIds={shownIds} quote={state.step === 'seats' ? null : state.quote} quoting={state.quoting}>
                {nextButton(`btn btn-primary btn-block ${styles.wideOnly}`)}
                {stepIndex > 0 && <button type="button" className="btn btn-ghost btn-block" onClick={() => goTo(STEPS[stepIndex - 1]!.id)}>Atrás</button>}
              </OrderSummary>

              {/* En pantallas angostas el resumen queda abajo: la acción principal siempre está a la mano. */}
              <div className={styles.mobileBar}>
                <p>
                  <strong>{mobileTotal}</strong>
                  <small>{mobileDetail}</small>
                </p>
                {nextButton('btn btn-primary')}
              </div>
            </div>
          )}
      </StateView>
    </div>
  )
}

