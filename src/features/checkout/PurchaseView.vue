<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQueryClient } from '@tanstack/vue-query'
import { CircleAlert, CircleCheck, LoaderCircle, Popcorn } from '@lucide/vue'
import TicketCard from './TicketCard.vue'
import { forgetCheckout } from './useCheckout'
import StateView from '@/shared/ui/StateView.vue'
import { keys, usePurchase } from '@/app/queries'
import { useServices } from '@/app/services'
import { confirmAction, toast } from '@/shared/composables/feedback'
import { PURCHASE_STATUS_LABELS } from '@/domain/labels'
import { formatDateTime } from '@/shared/lib/datetime'
import { formatMoney } from '@/shared/lib/money'
import { newIdempotencyKey } from '@/shared/lib/ids'
import { errorMessage } from '@/shared/lib/messages'
import { toApiError } from '@/shared/lib/errors'

const props = defineProps<{ purchaseId: string }>()
const route = useRoute()
const router = useRouter()
const { checkout } = useServices()
const queryClient = useQueryClient()
const purchase = usePurchase(() => props.purchaseId)
const isNew = computed(() => route.query.nueva === '1')
const cancelling = ref(false)
let cancelKey: string | null = null

// Con el pago resuelto ya no hay nada que reintentar en esa función.
watch(() => purchase.data.value, current => {
  if (current?.screening && current.status !== 'payment-pending' && current.status !== 'payment-failed') forgetCheckout(current.screening.id)
}, { immediate: true })

async function cancel() {
  const current = purchase.data.value
  if (!current) return
  const ok = await confirmAction({
    title: 'Cancelar compra',
    text: `Se reembolsarán ${formatMoney(current.totals.totalCents)} al método de pago original${current.ticketCode ? '. También se cancelan los pedidos de alimentos vinculados que no se hayan preparado' : ''}.`,
    confirmLabel: 'Cancelar compra',
    cancelLabel: 'Conservar',
    danger: true
  })
  if (!ok) return
  cancelling.value = true
  cancelKey ??= newIdempotencyKey()
  try {
    const updated = await checkout.cancelPurchase(current.id, cancelKey)
    queryClient.setQueryData(keys.purchase(current.id), updated)
    void queryClient.invalidateQueries({ queryKey: keys.purchases() })
    toast('Cancelación registrada. El reembolso está en proceso.')
  } catch (error) {
    toast(errorMessage(toApiError(error)), 'error')
  } finally {
    cancelling.value = false
  }
}
</script>

<template>
  <div class="container page narrow">
    <StateView :loading="purchase.isPending.value" :error="purchase.error.value" skeleton="block" @retry="purchase.refetch()">
      <template v-if="purchase.data.value">
        <div class="status" :class="purchase.data.value.status" role="status">
          <LoaderCircle v-if="purchase.data.value.status === 'payment-pending'" :size="30" class="spin" aria-hidden="true" />
          <CircleCheck v-else-if="purchase.data.value.status === 'confirmed'" :size="30" aria-hidden="true" />
          <CircleAlert v-else :size="30" aria-hidden="true" />
          <div>
            <h1 v-if="purchase.data.value.status === 'payment-pending'">Estamos confirmando tu pago</h1>
            <h1 v-else-if="purchase.data.value.status === 'confirmed'">{{ isNew ? '¡Compra confirmada!' : 'Compra confirmada' }}</h1>
            <h1 v-else-if="purchase.data.value.status === 'payment-failed'">El pago no se completó</h1>
            <h1 v-else>{{ PURCHASE_STATUS_LABELS[purchase.data.value.status] }}</h1>
            <p v-if="purchase.data.value.status === 'payment-pending'">No cierres esta página. Tarda unos segundos.</p>
            <p v-else-if="purchase.data.value.status === 'payment-failed'">No se realizó ningún cargo. Tus asientos siguen apartados mientras dure el tiempo.</p>
            <p v-else-if="purchase.data.value.refund.status !== 'none'">Reembolso: {{ formatMoney(purchase.data.value.refund.amountCents) }} · {{ purchase.data.value.refund.status === 'completed' ? 'completado' : 'en proceso' }}</p>
            <p v-else class="muted">Compra del {{ formatDateTime(purchase.data.value.createdAt) }}</p>
          </div>
        </div>

        <button v-if="purchase.data.value.status === 'payment-failed' && purchase.data.value.screening" type="button" class="btn btn-primary"
          @click="router.push(`/compra/${purchase.data.value.screening.id}`)">Intentar de nuevo</button>

        <TicketCard v-if="purchase.data.value.status !== 'payment-failed'" :purchase="purchase.data.value" />

        <div class="actions">
          <RouterLink v-if="purchase.data.value.ticketCode && purchase.data.value.status === 'confirmed'" :to="{ path: '/dulceria', query: { folio: purchase.data.value.ticketCode, complejo: purchase.data.value.complex.id } }" class="btn btn-secondary">
            <Popcorn :size="18" /> Pedir alimentos con este folio
          </RouterLink>
          <RouterLink to="/mi-cuenta" class="btn btn-ghost">Ver mis compras</RouterLink>
          <button v-if="purchase.data.value.cancellation.allowed" type="button" class="btn btn-ghost danger" :disabled="cancelling" @click="cancel">
            {{ cancelling ? 'Cancelando…' : 'Cancelar compra' }}
          </button>
        </div>
        <p v-if="purchase.data.value.status === 'confirmed' && purchase.data.value.cancellation.until" class="muted small">
          {{ purchase.data.value.cancellation.allowed ? `Puedes cancelar hasta el ${formatDateTime(purchase.data.value.cancellation.until)}.` : purchase.data.value.cancellation.reason }}
        </p>
      </template>
    </StateView>
  </div>
</template>

<style scoped>
.narrow { max-width: 860px; display: grid; gap: 20px; }
.status { padding: 22px; display: flex; gap: 16px; align-items: flex-start; border-radius: var(--radius-l); background: var(--accent-soft); color: #204a89; }
.status h1 { font: 800 clamp(22px, 3vw, 30px) var(--font-title); }
.status.confirmed { background: var(--success-soft); color: var(--success); }
.status.payment-failed, .status.refund-pending, .status.refunded, .status.cancelled { background: var(--warning-soft); color: var(--warning); }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.actions { display: flex; flex-wrap: wrap; gap: 10px; }
.danger { color: var(--danger); }
.small { font-size: 13px; }
</style>
