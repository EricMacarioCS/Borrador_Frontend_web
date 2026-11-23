/**
 * Máquina de estados de la compra de boletos.
 * El navegador solo propone (asientos, tipos, promoción, alimentos); el servidor aparta, cotiza y cobra.
 * Lo mínimo para recuperar la compra tras recargar se guarda en sessionStorage, nunca precios ni datos de pago.
 */
import { computed, reactive, watch, type Ref } from 'vue'
import { useServices } from '@/app/services'
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

interface CheckoutState {
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

export function useCheckout(screeningId: Ref<string>, complexId: Ref<string | null>) {
  const { checkout } = useServices()
  const storageKey = computed(() => savedKey(screeningId.value))

  const state = reactive<CheckoutState>({
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

  function persist() {
    session.set(storageKey.value, {
      holdId: state.hold?.id ?? null, step: state.step, types: state.types, promotionId: state.promotionId,
      items: state.items, pickup: state.pickup, purchaseKey: state.purchaseKey
    } satisfies Saved)
  }

  function forget() {
    session.remove(storageKey.value)
  }

  /** Recupera la compra en curso. Devuelve el id de compra si ya se había pagado. */
  async function restore(): Promise<string | null> {
    const saved = session.get<Saved | null>(storageKey.value, null)
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
        Object.assign(state, {
          hold, selected: [...hold.seatIds],
          types: Object.fromEntries(hold.seatIds.map(id => [id, saved.types[id] ?? 'tt-general'])),
          promotionId: saved.promotionId,
          items: saved.items, pickup: saved.pickup, step: saved.step, purchaseKey: null
        })
        if (state.step !== 'seats') void requote()
      }
    } catch {
      // El apartado venció o ya no existe: se empieza de nuevo sin mostrar error.
      forget()
    } finally {
      state.restored = true
    }
    return null
  }

  function toggleSeat(seatId: string, max: number) {
    state.error = null
    state.conflicts = []
    if (state.selected.includes(seatId)) state.selected = state.selected.filter(id => id !== seatId)
    else if (state.selected.length < max) state.selected = [...state.selected, seatId]
    else state.error = `Puedes elegir hasta ${max} asientos por compra.`
  }

  const holdMatches = computed(() => state.hold !== null &&
    state.hold.seatIds.length === state.selected.length && state.selected.every(id => state.hold!.seatIds.includes(id)))

  async function confirmSeats(onConflict: () => Promise<void>) {
    if (!state.selected.length || state.busy) return
    state.busy = true
    state.error = null
    try {
      if (!state.hold) state.hold = await checkout.createHold(screeningId.value, state.selected, newIdempotencyKey())
      else if (!holdMatches.value) state.hold = await checkout.updateHold(state.hold.id, state.selected)
      // El apartado del servidor manda; los tipos de los asientos que salieron se descartan.
      state.selected = [...state.hold.seatIds]
      state.types = Object.fromEntries(state.hold.seatIds.map(id => [id, state.types[id] ?? 'tt-general']))
      state.step = 'tickets'
      persist()
      void requote()
    } catch (error) {
      const apiError = toApiError(error)
      if (apiError.code === 'SEAT_CONFLICT') {
        const taken = Array.isArray(apiError.extra.conflictingSeatIds) ? apiError.extra.conflictingSeatIds as string[] : []
        state.conflicts = taken
        state.selected = state.selected.filter(id => !taken.includes(id))
        await onConflict()
      } else if (apiError.code === 'HOLD_EXPIRED' || apiError.code === 'NOT_FOUND') {
        state.hold = null
      }
      state.error = errorMessage(apiError)
    } finally {
      state.busy = false
    }
  }

  function request(): QuoteRequest | null {
    if (!state.hold || !complexId.value) return null
    return {
      complexId: complexId.value,
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
    state.quoting = true
    try {
      const quote = await checkout.createQuote(body)
      if (run === quoteRun) {
        state.quote = quote
        state.quoteError = null
      }
    } catch (error) {
      if (run !== quoteRun) return
      const apiError = toApiError(error)
      state.quoteError = apiError
      if (apiError.code === 'HOLD_EXPIRED') expire()
    } finally {
      if (run === quoteRun) state.quoting = false
    }
  }

  let timer = 0
  watch(() => [state.types, state.promotionId, state.items, state.pickup], () => {
    if (state.step === 'seats' || !state.hold) return
    persist()
    clearTimeout(timer)
    timer = window.setTimeout(() => void requote(), 250)
  }, { deep: true })

  function goTo(step: Step) {
    state.error = null
    state.step = step
    persist()
  }

  function expire() {
    state.hold = null
    state.quote = null
    state.step = 'seats'
    state.error = 'Venció el tiempo para tus asientos. Elige de nuevo; tu selección se conservó si siguen libres.'
    forget()
  }

  /** Paga con una clave de idempotencia por intento. Si se pierde la respuesta, se consulta por esa clave. */
  async function pay(customer: Customer, paymentMethod: string): Promise<string | null> {
    if (state.busy) return null
    state.busy = true
    state.error = null
    try {
      if (!state.quote || state.quote.expiresAt.getTime() - serverNow() < 5000) {
        await requote()
        if (!state.quote) throw state.quoteError ?? new ApiError({ status: 0, code: 'QUOTE_EXPIRED' })
      }
      state.purchaseKey ??= newIdempotencyKey()
      persist()
      try {
        // Lo guardado se conserva: si el pago se rechaza, «Intentar de nuevo» recupera el apartado.
        const purchase = await checkout.createPurchase({ quoteId: state.quote.id, customer, paymentMethod }, state.purchaseKey)
        if (purchase.payment.kind === 'redirect') window.location.assign(purchase.payment.url)
        return purchase.id
      } catch (error) {
        const apiError = toApiError(error)
        if (apiError.code === 'NETWORK' || apiError.code === 'TIMEOUT' || apiError.status >= 500) {
          const found = await checkout.findPurchaseByKey(state.purchaseKey).catch(() => null)
          if (found) return found.id
        }
        throw apiError
      }
    } catch (error) {
      const apiError = toApiError(error)
      if (apiError.code === 'QUOTE_EXPIRED' || apiError.code === 'QUOTE_CHANGED') {
        state.purchaseKey = null
        await requote()
      }
      if (apiError.code === 'HOLD_EXPIRED') expire()
      state.error = errorMessage(apiError)
      return null
    } finally {
      state.busy = false
    }
  }

  async function release() {
    const hold = state.hold
    forget()
    state.hold = null
    if (hold) await checkout.releaseHold(hold.id).catch(() => undefined)
  }

  return { state, holdMatches, restore, toggleSeat, confirmSeats, requote, goTo, expire, pay, release, persist }
}
