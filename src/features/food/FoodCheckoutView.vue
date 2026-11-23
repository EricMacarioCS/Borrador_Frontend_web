<script setup lang="ts">
/** Pago de dulcería sin boletos nuevos: folio (si aplica), momento de recolección, cotización y pago. */
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeft } from '@lucide/vue'
import BrandMark from '@/app/layout/BrandMark.vue'
import TicketCodeInput from './TicketCodeInput.vue'
import PaymentForm from '@/features/checkout/PaymentForm.vue'
import BaseSelect from '@/shared/ui/BaseSelect.vue'
import { useServices } from '@/app/services'
import { useCartStore } from '@/app/stores/cart'
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

const { checkout } = useServices()
const cart = useCartStore()
const app = useAppStore()
const router = useRouter()

const pickup = ref<'before' | 'during'>('before')
const quote = ref<Quote | null>(null)
const quoteError = ref<ApiError | null>(null)
const busy = ref(false)
const error = ref('')
const form = ref<InstanceType<typeof PaymentForm>>()
const pendingCode = session.get<string | null>(PENDING_TICKET_CODE_KEY, null)
let purchaseKey: string | null = null

const complex = computed(() => cart.complexId ? app.complexById(cart.complexId) : undefined)
const ready = computed(() => cart.lines.length > 0 && (!cart.needsTicketCode || cart.grant !== null))
const pickupOptions = computed(() => {
  const started = cart.grant ? cart.grant.startsAt.getTime() <= serverNow() : false
  return (['before', 'during'] as const).filter(value => !(started && value === 'before')).map(value => ({ value, label: PICKUP_LABELS[value] }))
})

let run = 0
async function requote() {
  if (!ready.value || !cart.complexId) { quote.value = null; return }
  const current = ++run
  try {
    const result = await checkout.createQuote({
      complexId: cart.complexId, holdId: null, ticketCodeGrant: cart.grant?.grant ?? null, tickets: [],
      items: cart.lines.map(({ productId, quantity, choices }) => ({ productId, quantity, choices })),
      promotionId: null, pickup: pickup.value
    })
    if (current === run) { quote.value = result; quoteError.value = null; purchaseKey = null }
  } catch (failure) {
    if (current === run) { quote.value = null; quoteError.value = toApiError(failure) }
  }
}

watch(pickupOptions, options => { if (!options.some(option => option.value === pickup.value)) pickup.value = options[0]!.value }, { immediate: true })
watch(() => [cart.lines, cart.grant, pickup.value], () => void requote(), { deep: true, immediate: true })

async function pay() {
  const data = form.value?.submit()
  if (!data || !quote.value || busy.value) return
  busy.value = true
  error.value = ''
  try {
    if (quote.value.expiresAt.getTime() - serverNow() < 5000) await requote()
    if (!quote.value) return
    purchaseKey ??= newIdempotencyKey()
    const purchase = await checkout.createPurchase({ quoteId: quote.value.id, customer: data.customer, paymentMethod: data.method }, purchaseKey)
      .catch(async failure => {
        const apiError = toApiError(failure)
        const found = apiError.status === 0 || apiError.status >= 500 ? await checkout.findPurchaseByKey(purchaseKey!).catch(() => null) : null
        if (found) return found
        throw apiError
      })
    cart.clear()
    session.remove(PENDING_TICKET_CODE_KEY)
    if (purchase.payment.kind === 'redirect') window.location.assign(purchase.payment.url)
    else void router.replace(`/compras/${purchase.id}?nueva=1`)
  } catch (failure) {
    const apiError = toApiError(failure)
    error.value = errorMessage(apiError)
    if (apiError.code === 'QUOTE_EXPIRED' || apiError.code === 'OUT_OF_STOCK') await requote()
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="food-checkout">
    <header class="top">
      <RouterLink to="/dulceria" class="back"><ArrowLeft :size="20" /> Seguir comprando</RouterLink>
      <RouterLink to="/" class="brand" aria-label="Inicio"><BrandMark /></RouterLink>
    </header>
    <div class="container layout">
      <section class="main">
        <h1>Pago de dulcería</h1>
        <div v-if="!cart.lines.length" class="card empty">
          <p>Tu carrito está vacío.</p>
          <RouterLink to="/dulceria" class="btn btn-primary">Ver dulcería</RouterLink>
        </div>
        <template v-else>
          <div class="panel">
            <p>Recoges en <strong>{{ complex?.name }}</strong></p>
            <TicketCodeInput v-if="cart.needsTicketCode && cart.complexId" :complex-id="cart.complexId" :initial="pendingCode" :grant="cart.grant" @validated="cart.setGrant" />
            <p v-else class="notice">Tu pedido no requiere folio. Lo recoges con el nombre y correo de la compra.</p>
            <BaseSelect v-model="pickup" label="¿Cuándo lo recoges?" :options="pickupOptions" />
          </div>
          <PaymentForm ref="form" :initial-email="app.session.email" />
          <p v-if="error" class="notice notice-error" role="alert">{{ error }}</p>
        </template>
      </section>
      <aside v-if="cart.lines.length" class="summary card" aria-label="Resumen del pedido">
        <h2>Tu pedido</h2>
        <ul class="lines" role="list">
          <li v-for="line in (quote?.lines ?? [])" :key="line.description + line.detail">
            <span>{{ line.quantity }} × {{ line.description }}<small v-if="line.detail">{{ line.detail }}</small></span>
            <span>{{ formatMoney(line.totalCents) }}</span>
          </li>
        </ul>
        <p v-if="!quote && !quoteError" class="muted">{{ cart.needsTicketCode && !cart.grant ? 'Valida tu folio para ver el total.' : 'Calculando total…' }}</p>
        <p v-if="quoteError" class="notice notice-error" role="alert">{{ errorMessage(quoteError) }}</p>
        <p v-if="quote" class="total"><span>Total</span><strong>{{ formatMoney(quote.totalCents) }}</strong></p>
        <button type="button" class="btn btn-primary btn-block" :disabled="!quote || busy" @click="pay">
          {{ busy ? 'Procesando…' : quote ? `Pagar ${formatMoney(quote.totalCents)}` : 'Pagar' }}
        </button>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.top { height: 68px; padding: 0 var(--page-gutter); display: flex; align-items: center; background: var(--grad-dark); color: #fff; }
.back { display: inline-flex; align-items: center; gap: 6px; color: #cfe3ff; font: 700 15px var(--font-title); text-decoration: none; }
.back:hover { color: var(--accent); }
.brand { margin-inline: auto; padding-right: 140px; text-decoration: none; }
.layout { padding-block: 24px 64px; display: grid; grid-template-columns: minmax(0, 1fr) 360px; gap: 24px; align-items: start; }
.main { display: grid; gap: 18px; }
.main h1 { font: 800 28px var(--font-title); }
.panel { padding: 18px; display: grid; gap: 14px; border: 1px solid var(--line); border-radius: var(--radius-l); background: #fff; }
.empty { padding: 32px; display: grid; justify-items: center; gap: 12px; }
.summary { position: sticky; top: 16px; padding: 18px; display: grid; gap: 12px; }
.summary h2 { font: 800 18px var(--font-title); }
.lines { display: grid; gap: 8px; }
.lines li { display: flex; justify-content: space-between; gap: 12px; font-size: 14px; }
.lines small { display: block; color: var(--muted); font-size: 12px; }
.total { display: flex; justify-content: space-between; padding-top: 12px; border-top: 1px solid var(--line); font: 800 20px var(--font-title); }
@media (max-width: 960px) {
  .layout { grid-template-columns: minmax(0, 1fr); }
  .brand { display: none; }
}
</style>
