import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
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

export const useCartStore = defineStore('cart', () => {
  const saved = session.get<Saved>(KEY, { complexId: null, lines: [], grant: null })
  const complexId = ref<string | null>(saved.complexId)
  const lines = ref<CartLine[]>(saved.lines)
  const grant = ref<TicketCodeGrant | null>(saved.grant
    ? { ...saved.grant, startsAt: new Date(saved.grant.startsAt), endsAt: new Date(saved.grant.endsAt) }
    : null)

  const count = computed(() => lines.value.reduce((sum, line) => sum + line.quantity, 0))
  const estimateCents = computed(() => lines.value.reduce((sum, line) => sum + line.estimateCents * line.quantity, 0))
  const needsTicketCode = computed(() => lines.value.some(line => line.requiresTicketCode))

  watch([complexId, lines, grant], () => {
    session.set(KEY, {
      complexId: complexId.value,
      lines: lines.value,
      grant: grant.value && { ...grant.value, startsAt: grant.value.startsAt.toISOString(), endsAt: grant.value.endsAt.toISOString() }
    } satisfies Saved)
  }, { deep: true })

  /** Un carrito pertenece a un solo complejo. Devuelve false si hay que confirmar el cambio. */
  function canAdd(targetComplexId: string) {
    return !lines.value.length || complexId.value === targetComplexId
  }

  function add(targetComplexId: string, line: Omit<CartLine, 'key'>) {
    if (complexId.value !== targetComplexId) {
      lines.value = []
      grant.value = null
    }
    complexId.value = targetComplexId
    const key = `${line.productId}|${JSON.stringify(line.choices)}`
    const existing = lines.value.find(item => item.key === key)
    if (existing) existing.quantity = Math.min(10, existing.quantity + line.quantity)
    else lines.value.push({ ...line, key })
  }

  function setQuantity(key: string, quantity: number) {
    if (quantity <= 0) lines.value = lines.value.filter(line => line.key !== key)
    else {
      const line = lines.value.find(item => item.key === key)
      if (line) line.quantity = Math.min(10, quantity)
    }
  }

  function clear() {
    lines.value = []
  }

  function setGrant(value: TicketCodeGrant | null) {
    grant.value = value
  }

  return { complexId, lines, grant, count, estimateCents, needsTicketCode, canAdd, add, setQuantity, clear, setGrant }
})
