import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { MapPin, ShoppingBag } from 'lucide-react'
import FoodCatalog from './FoodCatalog'
import OrderLines from './OrderLines'
import BaseSelect from '@/shared/ui/BaseSelect'
import { appStore, useAppStore } from '@/app/stores/app'
import { cartStore, useCartStore, type CartLine } from '@/app/stores/cart'
import { confirmAction, toast } from '@/shared/feedback'
import { useQueryParam } from '@/features/billboard/filters'
import { PENDING_TICKET_CODE_KEY } from './selection'
import { session } from '@/shared/lib/storage'
import { formatMoney } from '@/shared/lib/money'
import { completeTicketCode } from '@/shared/lib/text'
import styles from './FoodView.module.css'

export default function FoodView() {
  const complexes = useAppStore(state => state.complexes)
  const selectedCity = useAppStore(state => state.selectedCity)
  const lines = useCartStore(state => state.lines)
  const cartComplexId = useCartStore(state => state.complexId)
  const needsTicketCode = useCartStore(state => state.needsTicketCode)
  const estimateCents = useCartStore(state => state.estimateCents)
  const setQuantity = useCartStore(state => state.setQuantity)
  const cartComplex = useAppStore(state => cartComplexId ? state.complexById(cartComplexId) ?? null : null)
  const [query, setQuery] = useSearchParams()

  const [complexId, setComplexId] = useState<string | null>(() =>
    query.get('complejo') ?? cartStore.getState().complexId ?? appStore.getState().primaryComplex?.id ?? null)
  const [category, setCategory] = useQueryParam('categoria', 'todas')

  // Un folio llegado desde la confirmación se recuerda para el pago y se quita de la URL
  // para que no quede en el historial ni en enlaces compartidos.
  const [pendingCode, setPendingCode] = useState(() => {
    const raw = query.get('folio')
    const incoming = raw ? completeTicketCode(raw) : null
    if (incoming) session.set(PENDING_TICKET_CODE_KEY, incoming)
    return session.get<string | null>(PENDING_TICKET_CODE_KEY, null)
  })
  const hasFolio = query.has('folio')
  useEffect(() => {
    if (!hasFolio) return
    setQuery(current => {
      const next = new URLSearchParams(current)
      next.delete('folio')
      return next
    }, { replace: true, preventScrollReset: true })
  }, [hasFolio, setQuery])

  function forgetPendingCode() {
    session.remove(PENDING_TICKET_CODE_KEY)
    setPendingCode(null)
  }

  // Los cines de la ciudad elegida van primero.
  const complexOptions = [...complexes]
    .sort((a, b) => Number(b.city === selectedCity) - Number(a.city === selectedCity))
    .map(complex => ({ value: complex.id, label: complex.name, hint: complex.city }))

  async function add(line: Omit<CartLine, 'key'>) {
    if (!complexId) return
    if (!cartStore.getState().canAdd(complexId)) {
      const ok = await confirmAction({
        title: 'Cambiar de complejo',
        text: 'Tu carrito tiene productos de otro complejo. Si continúas, se vaciará.',
        confirmLabel: 'Vaciar y agregar'
      })
      if (!ok) return
    }
    cartStore.getState().add(complexId, line)
    toast(`${line.name} agregado al carrito.`)
  }

  return (
    <div className="container page">
      <p className="eyebrow">Dulcería</p>
      <h1 className="page-title">Pide antes de llegar</h1>
      <p className="page-lead">Los alimentos se recogen con el folio de tus boletos del mismo complejo. Los artículos promocionales sin alimentos no requieren folio.</p>

      {pendingCode && (
        <p className={`notice ${styles.pendingCode}`}>
          <span>Usaremos el folio <strong>{pendingCode}</strong> al pagar.</span>
          <button type="button" className="btn btn-ghost btn-small" onClick={forgetPendingCode}>Usar otro</button>
        </p>
      )}

      <div className={styles.layout}>
        <section className={styles.main} aria-label="Productos">
          <div className={`card ${styles.where}`}>
            <BaseSelect value={complexId} onChange={setComplexId} label="¿En qué complejo recoges?" options={complexOptions} placeholder="Elige un complejo"
              icon={<MapPin size={18} />} />
          </div>
          {complexId
            ? <FoodCatalog category={category} onCategory={setCategory} complexId={complexId} onAdd={line => void add(line)} />
            : (
              <div className={`card ${styles.choose}`}>
                <MapPin size={30} aria-hidden="true" />
                <h2>Elige el complejo donde recogerás tu pedido</h2>
                <p className="muted">Cada complejo tiene su propio menú y existencias.</p>
              </div>
            )}
        </section>

        <aside className={`card ${styles.order}`} aria-labelledby="tu-pedido">
          <h2 id="tu-pedido"><ShoppingBag size={20} aria-hidden="true" /> Tu pedido</h2>
          {lines.length
            ? (
              <>
                <p className={`muted ${styles.small}`}>Recoges en <strong>{cartComplex?.name}</strong></p>
                <OrderLines lines={lines} onQuantity={setQuantity} />
                {needsTicketCode && <p className="notice">Necesitarás el folio de tus boletos de este complejo.</p>}
                <div className={styles.total}><span>Total estimado</span><strong>{formatMoney(estimateCents)}</strong></div>
                <Link to="/dulceria/pago" className="btn btn-primary btn-block">Continuar al pago</Link>
              </>
            )
            : <p className={`muted ${styles.empty}`}>Agrega productos para armar tu pedido.</p>}
        </aside>
      </div>
    </div>
  )
}
