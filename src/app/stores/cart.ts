import { createStore, useStore } from 'zustand'
import type { ItemSelection, TicketCodeGrant } from '@/domain/models'
import type { Cents } from '@/shared/lib/money'
import { session } from '@/shared/lib/storage'

/**
 * Carrito de dulcería. Guarda identificadores y una estimación para mostrar;
 * el importe que se cobra siempre sale de la cotización del servidor.
 */
export interface CartLine extends ItemSelection {
  key: string
  name: string
  detail: string
  estimateCents: Cents
  requiresTicketCode: boolean
}

interface Saved { complexId: string | null; lines: CartLine[]; grant: (Omit<TicketCodeGrant, 'startsAt' | 'endsAt'> & { startsAt: string; endsAt: string }) | null }
const KEY = 'cp-cart'

interface CartData {
  complexId: string | null
  lines: CartLine[]
  grant: TicketCodeGrant | null
}

export interface CartState extends CartData {
  count: number
  estimateCents: Cents
  needsTicketCode: boolean
  /** Un carrito pertenece a un solo complejo. Devuelve false si hay que confirmar el cambio. */
  canAdd: (targetComplexId: string) => boolean
  add: (targetComplexId: string, line: Omit<CartLine, 'key'>) => void
  setQuantity: (key: string, quantity: number) => void
  clear: () => void
  setGrant: (value: TicketCodeGrant | null) => void
}

const totals = (lines: CartLine[]) => ({
  count: lines.reduce((sum, line) => sum + line.quantity, 0),
  estimateCents: lines.reduce((sum, line) => sum + line.estimateCents * line.quantity, 0),
  needsTicketCode: lines.some(line => line.requiresTicketCode)
})

export function createCartStore() {
  const saved = session.get<Saved>(KEY, { complexId: null, lines: [], grant: null })
  const store = createStore<CartState>((set, get) => {
    /** Cambia los datos, recalcula los totales y guarda en la sesión del navegador. */
    function update(patch: Partial<CartData>) {
      const next = { complexId: get().complexId, lines: get().lines, grant: get().grant, ...patch }
      set({ ...patch, ...totals(next.lines) })
      session.set(KEY, {
        complexId: next.complexId,
        lines: next.lines,
        grant: next.grant && { ...next.grant, startsAt: next.grant.startsAt.toISOString(), endsAt: next.grant.endsAt.toISOString() }
      } satisfies Saved)
    }

    return {
      complexId: saved.complexId,
      lines: saved.lines,
      grant: saved.grant ? { ...saved.grant, startsAt: new Date(saved.grant.startsAt), endsAt: new Date(saved.grant.endsAt) } : null,
      ...totals(saved.lines),

      canAdd(targetComplexId) {
        const { lines, complexId } = get()
        return !lines.length || complexId === targetComplexId
      },
      add(targetComplexId, line) {
        const sameComplex = get().complexId === targetComplexId
        const lines = sameComplex ? get().lines : []
        const key = `${line.productId}|${JSON.stringify(line.choices)}`
        const existing = lines.find(item => item.key === key)
        update({
          complexId: targetComplexId,
          grant: sameComplex ? get().grant : null,
          lines: existing
            ? lines.map(item => item.key === key ? { ...item, quantity: Math.min(10, item.quantity + line.quantity) } : item)
            : [...lines, { ...line, key }]
        })
      },
      setQuantity(key, quantity) {
        const lines = get().lines
        update({
          lines: quantity <= 0
            ? lines.filter(line => line.key !== key)
            : lines.map(line => line.key === key ? { ...line, quantity: Math.min(10, quantity) } : line)
        })
      },
      clear() {
        update({ lines: [] })
      },
      setGrant(value) {
        update({ grant: value })
      }
    }
  })
  return store
}

export const cartStore = createCartStore()

export function useCartStore<T>(selector: (state: CartState) => T): T {
  return useStore(cartStore, selector)
}
