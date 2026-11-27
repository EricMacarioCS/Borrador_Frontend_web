/**
 * Máquina de estados de la compra de boletos.
 * El navegador solo propone (asientos, tipos, promoción, alimentos); el servidor aparta, cotiza y cobra.
 * Lo mínimo para recuperar la compra tras recargar se guarda en sessionStorage, nunca precios ni datos de pago.
 *
 * El estado vive en un almacén propio de cada pantalla de compra: las operaciones asíncronas
 * leen siempre el valor actual y no una copia vieja del render.
 */
import { useEffect, useRef, useState } from 'react'
import { createStore, useStore, type StoreApi } from 'zustand'
import { useServices } from '@/app/services'
import type { CheckoutPort } from '@/domain/ports'
import type { Customer, Hold, Quote, QuoteRequest } from '@/domain/models'
import type { CartLine } from '@/app/stores/cart'
import { ApiError, toApiError } from '@/shared/lib/errors'
import { errorMessage } from '@/shared/lib/messages'
import { newIdempotencyKey } from '@/shared/lib/ids'
import { serverNow } from '@/shared/lib/clock'
import { session } from '@/shared/lib/storage'

export type Step = 'seats' | 'tickets' | 'food' | 'payment'
export const STEPS: { id: Step; label: string }[] = [
  { id: 'seats', label: 'Asientos' },
  { id: 'tickets', label: 'Boletos' },
  { id: 'food', label: 'Alimentos' },
  { id: 'payment', label: 'Pago' }
]

interface Saved {
  holdId: string | null
  step: Step
  types: Record<string, string>
  promotionId: string | null
  items: CartLine[]
  pickup: 'before' | 'during'
  purchaseKey: string | null
}

export interface CheckoutState {
  step: Step
  /** Asientos elegidos en el mapa; se apartan al confirmar. */
  selected: string[]
  hold: Hold | null
  /** Tipo de boleto por asiento. */
  types: Record<string, string>
  promotionId: string | null
  items: CartLine[]
  pickup: 'before' | 'during'
  quote: Quote | null
  quoteError: ApiError | null
  quoting: boolean
  busy: boolean
  error: string | null
  conflicts: string[]
  purchaseKey: string | null
  restored: boolean
}

const savedKey = (screeningId: string) => `cp-checkout-${screeningId}`

/**
 * Olvida la compra en curso de una función. Se llama cuando el pago ya no puede reintentarse
 * (confirmado, cancelado). Tras un rechazo se conserva para recuperar el apartado.
 */
export function forgetCheckout(screeningId: string) {
  session.remove(savedKey(screeningId))
}

const initialState = (): CheckoutState => ({
  step: 'seats',
  selected: [],
  hold: null,
  types: {},
  promotionId: null,
  items: [],
  pickup: 'before',
  quote: null,
  quoteError: null,
  quoting: false,
  busy: false,
  error: null,
  conflicts: [],
  purchaseKey: null,
  restored: false
})

function createCheckout(checkout: CheckoutPort, screeningId: string, getComplexId: () => string | null) {
  const store: StoreApi<CheckoutState> = createStore<CheckoutState>(initialState)
  const get = store.getState
  const set = (patch: Partial<CheckoutState>) => store.setState(patch)
  const storageKey = savedKey(screeningId)

  function persist() {
    const state = get()
    session.set(storageKey, {
      holdId: state.hold?.id ?? null, step: state.step, types: state.types, promotionId: state.promotionId,
      items: state.items, pickup: state.pickup, purchaseKey: state.purchaseKey
    } satisfies Saved)
  }

  function forget() {
    session.remove(storageKey)
  }

  /** Recupera la compra en curso. Devuelve el id de compra si ya se había pagado. */
  async function restore(): Promise<string | null> {
    const saved = session.get<Saved | null>(storageKey, null)
    try {
      if (saved?.purchaseKey) {
        const purchase = await checkout.findPurchaseByKey(saved.purchaseKey)
        if (purchase && purchase.status !== 'payment-failed') {
          forget()
          return purchase.id
        }
      }
      if (saved?.holdId) {
        const hold = await checkout.getHold(saved.holdId)
        set({
          hold, selected: [...hold.seatIds],
          types: Object.fromEntries(hold.seatIds.map(id => [id, saved.types[id] ?? 'tt-general'])),
          promotionId: saved.promotionId,
          items: saved.items, pickup: saved.pickup, step: saved.step, purchaseKey: null
        })
        if (get().step !== 'seats') void requote()
      }
    } catch {
      // El apartado venció o ya no existe: se empieza de nuevo sin mostrar error.
      forget()
    } finally {
      set({ restored: true })
    }
    return null
  }

  function toggleSeat(seatId: string, max: number) {
    const { selected } = get()
    set({ error: null, conflicts: [] })
    if (selected.includes(seatId)) set({ selected: selected.filter(id => id !== seatId) })
    else if (selected.length < max) set({ selected: [...selected, seatId] })
    else set({ error: `Puedes elegir hasta ${max} asientos por compra.` })
  }

  function holdMatches() {
    const { hold, selected } = get()
    return hold !== null && hold.seatIds.length === selected.length && selected.every(id => hold.seatIds.includes(id))
  }

  async function confirmSeats(onConflict: () => Promise<void>) {
    if (!get().selected.length || get().busy) return
    set({ busy: true, error: null })
    try {
      let hold = get().hold
      if (!hold) hold = await checkout.createHold(screeningId, get().selected, newIdempotencyKey())
      else if (!holdMatches()) hold = await checkout.updateHold(hold.id, get().selected)
      // El apartado del servidor manda; los tipos de los asientos que salieron se descartan.
      const types = get().types
      set({
        hold,
        selected: [...hold.seatIds],
        types: Object.fromEntries(hold.seatIds.map(id => [id, types[id] ?? 'tt-general'])),
        step: 'tickets'
      })
      persist()
      void requote()
    } catch (error) {
      const apiError = toApiError(error)
      if (apiError.code === 'SEAT_CONFLICT') {
        const taken = Array.isArray(apiError.extra.conflictingSeatIds) ? apiError.extra.conflictingSeatIds as string[] : []
        set({ conflicts: taken, selected: get().selected.filter(id => !taken.includes(id)) })
        await onConflict()
      } else if (apiError.code === 'HOLD_EXPIRED' || apiError.code === 'NOT_FOUND') {
        set({ hold: null })
      }
      set({ error: errorMessage(apiError) })
    } finally {
      set({ busy: false })
    }
  }

  function request(): QuoteRequest | null {
    const state = get()
    const complexId = getComplexId()
    if (!state.hold || !complexId) return null
    return {
      complexId,
      holdId: state.hold.id,
      ticketCodeGrant: null,
      tickets: state.hold.seatIds.map(seatId => ({ seatId, ticketTypeId: state.types[seatId] ?? 'tt-general' })),
      items: state.items.map(({ productId, quantity, choices }) => ({ productId, quantity, choices })),
      promotionId: state.promotionId,
      pickup: state.items.length ? state.pickup : null
    }
  }

  let quoteRun = 0
  async function requote() {
    const body = request()
    if (!body) return
    const run = ++quoteRun
    set({ quoting: true })
    try {
      const quote = await checkout.createQuote(body)
      if (run === quoteRun) set({ quote, quoteError: null })
    } catch (error) {
      if (run !== quoteRun) return
      const apiError = toApiError(error)
      set({ quoteError: apiError })
      if (apiError.code === 'HOLD_EXPIRED') expire()
    } finally {
      if (run === quoteRun) set({ quoting: false })
    }
  }

  /**
   * Cada cambio en lo que se cotiza se guarda y vuelve a cotizar tras una pausa breve.
   * Devuelve la limpieza; se llama desde un efecto para que sobreviva al doble montaje de StrictMode.
   */
  function watch() {
    let timer = 0
    const unsubscribe = store.subscribe((state, previous) => {
      if (state.types === previous.types && state.promotionId === previous.promotionId &&
        state.items === previous.items && state.pickup === previous.pickup) return
      if (state.step === 'seats' || !state.hold) return
      persist()
      clearTimeout(timer)
      timer = window.setTimeout(() => void requote(), 250)
    })
    return () => {
      clearTimeout(timer)
      unsubscribe()
    }
  }

  function goTo(step: Step) {
    set({ error: null, step })
    persist()
  }

  function expire() {
    set({
      hold: null,
      quote: null,
      step: 'seats',
      error: 'Venció el tiempo para tus asientos. Elige de nuevo; tu selección se conservó si siguen libres.'
    })
    forget()
  }

  /** Paga con una clave de idempotencia por intento. Si se pierde la respuesta, se consulta por esa clave. */
  async function pay(customer: Customer, paymentMethod: string): Promise<string | null> {
    if (get().busy) return null
    set({ busy: true, error: null })
    try {
      const current = get().quote
      if (!current || current.expiresAt.getTime() - serverNow() < 5000) {
        await requote()
        if (!get().quote) throw get().quoteError ?? new ApiError({ status: 0, code: 'QUOTE_EXPIRED' })
      }
      const quote = get().quote!
      const purchaseKey = get().purchaseKey ?? newIdempotencyKey()
      set({ purchaseKey })
      persist()
      try {
        // Lo guardado se conserva: si el pago se rechaza, «Intentar de nuevo» recupera el apartado.
        const purchase = await checkout.createPurchase({ quoteId: quote.id, customer, paymentMethod }, purchaseKey)
        if (purchase.payment.kind === 'redirect') window.location.assign(purchase.payment.url)
        return purchase.id
      } catch (error) {
        const apiError = toApiError(error)
        if (apiError.code === 'NETWORK' || apiError.code === 'TIMEOUT' || apiError.status >= 500) {
          const found = await checkout.findPurchaseByKey(purchaseKey).catch(() => null)
          if (found) return found.id
        }
        throw apiError
      }
    } catch (error) {
      const apiError = toApiError(error)
      if (apiError.code === 'QUOTE_EXPIRED' || apiError.code === 'QUOTE_CHANGED') {
        set({ purchaseKey: null })
        await requote()
      }
      if (apiError.code === 'HOLD_EXPIRED') expire()
      set({ error: errorMessage(apiError) })
      return null
    } finally {
      set({ busy: false })
    }
  }

  async function release() {
    const hold = get().hold
    forget()
    set({ hold: null })
    if (hold) await checkout.releaseHold(hold.id).catch(() => undefined)
  }

  return {
    store, set, restore, toggleSeat, holdMatches, confirmSeats, requote, goTo, expire, pay, release, persist, watch
  }
}

export type Checkout = ReturnType<typeof createCheckout>

export function useCheckout(screeningId: string, complexId: string | null) {
  const { checkout } = useServices()
  const complexRef = useRef(complexId)
  useEffect(() => { complexRef.current = complexId }, [complexId])
  // Una compra por función: la pantalla se vuelve a montar al cambiar de ruta.
  const [api] = useState(() => createCheckout(checkout, screeningId, () => complexRef.current))
  useEffect(() => api.watch(), [api])
  const state = useStore(api.store)
  return { state, ...api }
}
