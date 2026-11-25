<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { MapPin, ShoppingBag } from '@lucide/vue'
import FoodCatalog from './FoodCatalog.vue'
import OrderLines from './OrderLines.vue'
import BaseSelect from '@/shared/ui/BaseSelect.vue'
import { useAppStore } from '@/app/stores/app'
import { useCartStore, type CartLine } from '@/app/stores/cart'
import { confirmAction, toast } from '@/shared/composables/feedback'
import { useQueryParam } from '@/features/billboard/filters'
import { PENDING_TICKET_CODE_KEY } from './selection'
import { session } from '@/shared/lib/storage'
import { formatMoney } from '@/shared/lib/money'
import { completeTicketCode } from '@/shared/lib/text'

const app = useAppStore()
const cart = useCartStore()
const route = useRoute()
const router = useRouter()

const initialComplex = typeof route.query.complejo === 'string' ? route.query.complejo : cart.complexId ?? app.primaryComplex?.id ?? null
const complexId = ref<string | null>(initialComplex)
const category = useQueryParam('categoria', 'todas')

// Un folio llegado desde la confirmación se recuerda para el pago y se quita de la URL
// para que no quede en el historial ni en enlaces compartidos.
const incoming = typeof route.query.folio === 'string' ? completeTicketCode(route.query.folio) : null
if (incoming) session.set(PENDING_TICKET_CODE_KEY, incoming)
if (route.query.folio !== undefined) void router.replace({ query: { ...route.query, folio: undefined } })
const pendingCode = ref(session.get<string | null>(PENDING_TICKET_CODE_KEY, null))
function forgetPendingCode() {
  session.remove(PENDING_TICKET_CODE_KEY)
  pendingCode.value = null
}

// Los cines de la ciudad elegida van primero.
const complexOptions = computed(() => [...app.complexes]
  .sort((a, b) => Number(b.city === app.selectedCity) - Number(a.city === app.selectedCity))
  .map(complex => ({ value: complex.id, label: complex.name, hint: complex.city })))
const cartComplex = computed(() => cart.complexId ? app.complexById(cart.complexId) ?? null : null)

async function add(line: Omit<CartLine, 'key'>) {
  if (!complexId.value) return
  if (!cart.canAdd(complexId.value)) {
    const ok = await confirmAction({
      title: 'Cambiar de complejo',
      text: 'Tu carrito tiene productos de otro complejo. Si continúas, se vaciará.',
      confirmLabel: 'Vaciar y agregar'
    })
    if (!ok) return
  }
  cart.add(complexId.value, line)
  toast(`${line.name} agregado al carrito.`)
}
</script>

<template>
  <div class="container page">
    <p class="eyebrow">Dulcería</p>
    <h1 class="page-title">Pide antes de llegar</h1>
    <p class="page-lead">Los alimentos se recogen con el folio de tus boletos del mismo complejo. Los artículos promocionales sin alimentos no requieren folio.</p>

    <p v-if="pendingCode" class="notice pending-code">
      <span>Usaremos el folio <strong>{{ pendingCode }}</strong> al pagar.</span>
      <button type="button" class="btn btn-ghost btn-small" @click="forgetPendingCode">Usar otro</button>
    </p>

    <div class="layout">
      <section class="main" aria-label="Productos">
        <div class="card where">
          <BaseSelect v-model="complexId" label="¿En qué complejo recoges?" :options="complexOptions" placeholder="Elige un complejo">
            <template #icon><MapPin :size="18" /></template>
          </BaseSelect>
        </div>
        <FoodCatalog v-if="complexId" v-model:category="category" :complex-id="complexId" @add="add" />
        <div v-else class="card choose">
          <MapPin :size="30" aria-hidden="true" />
          <h2>Elige el complejo donde recogerás tu pedido</h2>
          <p class="muted">Cada complejo tiene su propio menú y existencias.</p>
        </div>
      </section>

      <aside class="order card" aria-labelledby="tu-pedido">
        <h2 id="tu-pedido"><ShoppingBag :size="20" aria-hidden="true" /> Tu pedido</h2>
        <template v-if="cart.lines.length">
          <p class="muted small">Recoges en <strong>{{ cartComplex?.name }}</strong></p>
          <OrderLines :lines="cart.lines" @quantity="cart.setQuantity" />
          <p v-if="cart.needsTicketCode" class="notice">Necesitarás el folio de tus boletos de este complejo.</p>
          <div class="total"><span>Total estimado</span><strong>{{ formatMoney(cart.estimateCents) }}</strong></div>
          <RouterLink to="/dulceria/pago" class="btn btn-primary btn-block">Continuar al pago</RouterLink>
        </template>
        <p v-else class="muted empty">Agrega productos para armar tu pedido.</p>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.pending-code { margin-top: 18px; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 16px; }
.layout { margin-top: 24px; display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 24px; align-items: start; }
.main { min-width: 0; display: grid; gap: 18px; }
.where { width: min(100%, 420px); padding: 14px 16px; }
.choose { padding: 40px 24px; display: grid; justify-items: center; gap: 10px; text-align: center; }
.choose svg { color: var(--blue); }
.choose h2 { font: 800 20px var(--font-title); }
.order { position: sticky; top: calc(var(--header-height) + 16px); padding: 20px; display: grid; gap: 10px; }
.order h2 { display: flex; align-items: center; gap: 8px; font: 800 20px var(--font-title); }
.order h2 svg { color: var(--blue); }
.small { font-size: 14px; }
.empty { padding: 18px 0; }
.total { padding-top: 6px; display: flex; justify-content: space-between; font: 800 18px var(--font-title); }
@media (max-width: 1100px) {
  .layout { grid-template-columns: minmax(0, 1fr); }
  .order { position: static; }
}
</style>
