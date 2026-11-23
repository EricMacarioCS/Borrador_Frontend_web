<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { MapPin } from '@lucide/vue'
import ProductGrid from './ProductGrid.vue'
import ProductCustomizer from './ProductCustomizer.vue'
import BaseSelect from '@/shared/ui/BaseSelect.vue'
import StateView from '@/shared/ui/StateView.vue'
import { useProducts } from '@/app/queries'
import { useAppStore } from '@/app/stores/app'
import { useCartStore, type CartLine } from '@/app/stores/cart'
import { confirmAction, toast } from '@/shared/composables/feedback'
import { useQueryParam } from '@/features/billboard/filters'
import { PENDING_TICKET_CODE_KEY } from './selection'
import { session } from '@/shared/lib/storage'
import { completeTicketCode } from '@/shared/lib/text'
import type { Product } from '@/domain/models'

const app = useAppStore()
const cart = useCartStore()
const route = useRoute()
const router = useRouter()

const initialComplex = typeof route.query.complejo === 'string' ? route.query.complejo : cart.complexId ?? app.primaryComplex?.id ?? null
const complexId = ref<string | null>(initialComplex)
const category = useQueryParam('categoria', 'todas')
const products = useProducts(complexId)
const customizing = ref<Product | null>(null)

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

const complexOptions = computed(() => app.complexes.map(complex => ({ value: complex.id, label: complex.name, hint: complex.city })))
const categories = computed(() => {
  const seen = new Map<string, string>()
  for (const product of products.data.value ?? []) seen.set(product.category.code, product.category.name)
  return [{ value: 'todas', label: 'Todo' }, ...[...seen].map(([value, label]) => ({ value, label }))]
})
const shown = computed(() => (products.data.value ?? []).filter(product => category.value === 'todas' || product.category.code === category.value))

watch(complexId, () => { category.value = 'todas' })

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
  customizing.value = null
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

    <div class="tools card">
      <BaseSelect v-model="complexId" label="Complejo" :options="complexOptions">
        <template #icon><MapPin :size="18" /></template>
      </BaseSelect>
      <div class="chip-row" role="group" aria-label="Categoría">
        <button v-for="item in categories" :key="item.value" type="button" class="chip" :aria-pressed="category === item.value" @click="category = item.value">{{ item.label }}</button>
      </div>
    </div>

    <StateView :loading="products.isPending.value" :error="products.error.value" :empty="!shown.length" skeleton="cards"
      empty-title="No hay productos en esta categoría" @retry="products.refetch()">
      <ProductGrid :products="shown" @choose="customizing = $event" />
    </StateView>

    <ProductCustomizer :product="customizing" action-label="Agregar al carrito" @close="customizing = null" @add="add" />
  </div>
</template>

<style scoped>
.tools { margin: 22px 0 26px; padding: 16px; display: grid; grid-template-columns: minmax(220px, 320px) 1fr; align-items: end; gap: 16px; }
@media (max-width: 720px) { .tools { grid-template-columns: minmax(0, 1fr); } }
.pending-code { margin-top: 18px; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 16px; }
</style>
