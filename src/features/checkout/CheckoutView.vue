<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, toRef, watch } from 'vue'
import { onBeforeRouteLeave, useRouter } from 'vue-router'
import { useQuery } from '@tanstack/vue-query'
import { ArrowLeft, Check, Radio, WifiOff } from '@lucide/vue'
import BrandMark from '@/app/layout/BrandMark.vue'
import SeatMap from '@/features/seats/SeatMap.vue'
import { useSeatMap } from '@/features/seats/useSeatMap'
import FoodCatalog from '@/features/food/FoodCatalog.vue'
import OrderLines from '@/features/food/OrderLines.vue'
import OrderSummary from './OrderSummary.vue'
import PaymentForm from './PaymentForm.vue'
import TicketTypePicker from './TicketTypePicker.vue'
import { promotionApplies } from './promotions'
import { STEPS, useCheckout, type Step } from './useCheckout'
import BaseSelect from '@/shared/ui/BaseSelect.vue'
import CountdownTimer from '@/shared/ui/CountdownTimer.vue'
import StateView from '@/shared/ui/StateView.vue'
import { usePromotions, useScreening } from '@/app/queries'
import { useServices } from '@/app/services'
import { useAppStore } from '@/app/stores/app'
import { confirmAction, toast } from '@/shared/composables/feedback'
import { formatMoney } from '@/shared/lib/money'
import { errorMessage } from '@/shared/lib/messages'
import { PICKUP_LABELS } from '@/domain/labels'
import type { SeatCell } from '@/domain/models'
import type { CartLine } from '@/app/stores/cart'

const props = defineProps<{ screeningId: string }>()
const router = useRouter()
const app = useAppStore()
const { catalog, checkout: checkoutPort } = useServices()

const screening = useScreening(() => props.screeningId)
const movie = useQuery({
  queryKey: computed(() => ['movie-by-id', screening.data.value?.movieId]),
  queryFn: ({ signal }) => catalog.getMovie(screening.data.value!.movieId, signal),
  enabled: computed(() => Boolean(screening.data.value))
})
const prices = useQuery({
  queryKey: computed(() => ['ticket-prices', props.screeningId]),
  queryFn: ({ signal }) => checkoutPort.getTicketPrices(props.screeningId, signal)
})
const promotions = usePromotions()
const complexId = computed(() => screening.data.value?.complexId ?? null)
const foodCategory = ref('todas')

const { state, restore, toggleSeat, confirmSeats, goTo, expire, pay, release } = useCheckout(toRef(props, 'screeningId'), complexId)
const layoutRef = computed(() => screening.data.value?.layout ?? null)
const seatMap = useSeatMap(toRef(props, 'screeningId'), layoutRef)

const max = computed(() => app.limits.maxSeatsPerPurchase)
const selectedSet = computed(() => new Set(state.selected))
const stepIndex = computed(() => STEPS.findIndex(step => step.id === state.step))
const paymentForm = ref<InstanceType<typeof PaymentForm>>()
let leaving = false

onMounted(async () => {
  const paidId = await restore()
  if (paidId) void router.replace(`/compras/${paidId}`)
})

/** Solo las promociones que pueden aplicar al día, formato y horario de esta función. */
const eligiblePromotions = computed(() => {
  const current = screening.data.value
  if (!current) return []
  const timeZone = app.complexById(current.complexId)?.timeZone
  return (promotions.data.value ?? []).filter(item => promotionApplies(item, current, timeZone))
})
const promotionOptions = computed(() => [
  { value: '', label: 'Sin promoción' },
  ...eligiblePromotions.value.map(item => ({ value: item.id, label: item.title, hint: item.description }))
])
// Una promoción recuperada de la sesión que ya no se ofrece no debe quedar elegida sin verse.
watch(() => [eligiblePromotions.value, state.restored, state.promotionId], () => {
  if (!screening.data.value || !promotions.data.value || !state.promotionId) return
  if (!eligiblePromotions.value.some(item => item.id === state.promotionId)) state.promotionId = null
})
const promotionModel = computed({
  get: () => state.promotionId ?? '',
  set: value => { state.promotionId = value || null }
})
const pickupOptions = [
  { value: 'before' as const, label: PICKUP_LABELS.before },
  { value: 'during' as const, label: PICKUP_LABELS.during }
]
const seatLabel = (id: string) => seatMap.layout.data.value?.rows.flatMap(row => row.cells).find(cell => cell?.id === id)?.label ?? id

const channelText = computed(() => ({
  connected: 'Disponibilidad en tiempo real',
  connecting: 'Conectando…',
  reconnecting: 'Reconectando. Los asientos se actualizarán al volver la conexión.',
  disconnected: 'Sin tiempo real: la disponibilidad se revisa periódicamente.'
})[seatMap.channel.value])

// Si alguien más aparta un asiento que aquí solo estaba marcado, se quita de la selección y se avisa.
watch(() => seatMap.snapshot.value, snapshot => {
  // Mientras se confirma, el evento puede llegar antes que la respuesta del propio apartado.
  if (!snapshot || state.step !== 'seats' || state.busy) return
  const mine = new Set(state.hold?.seatIds ?? [])
  const lost = state.selected.filter(id => !mine.has(id) && (snapshot.seats[id] ?? 'available') !== 'available')
  if (!lost.length) return
  state.selected = state.selected.filter(id => !lost.includes(id))
  state.error = lost.length === 1
    ? `Otra persona acaba de apartar el asiento ${seatLabel(lost[0]!)}. Elige otro lugar.`
    : `Otra persona acaba de apartar los asientos ${lost.map(seatLabel).join(', ')}. Elige otros lugares.`
})

function onSeat(seat: SeatCell) {
  toggleSeat(seat.id, max.value)
}

function addItem(line: Omit<CartLine, 'key'>) {
  const key = `${line.productId}|${JSON.stringify(line.choices)}`
  const existing = state.items.find(item => item.key === key)
  if (existing) existing.quantity = Math.min(10, existing.quantity + line.quantity)
  else state.items.push({ ...line, key })
  toast(`${line.name} agregado a tu compra.`)
}
function setItemQuantity(key: string, quantity: number) {
  if (quantity <= 0) state.items = state.items.filter(item => item.key !== key)
  else {
    const item = state.items.find(entry => entry.key === key)
    if (item) item.quantity = quantity
  }
}

async function next() {
  if (state.step === 'seats') return confirmSeats(seatMap.refresh)
  if (state.step === 'tickets') return goTo('food')
  if (state.step === 'food') return goTo('payment')
  const data = paymentForm.value?.submit()
  if (!data) return
  const purchaseId = await pay(data.customer, data.method)
  if (purchaseId) {
    leaving = true
    void router.replace(`/compras/${purchaseId}?nueva=1`)
  }
}

const mobileTotal = computed(() => state.step !== 'seats' && state.quote ? formatMoney(state.quote.totalCents) : `${state.selected.length} de ${max.value}`)
const mobileDetail = computed(() => {
  const ids = state.hold && state.step !== 'seats' ? state.hold.seatIds : state.selected
  if (!ids.length) return 'Ningún asiento elegido'
  return state.step === 'seats' ? ids.map(seatLabel).join(', ') : `Total · ${ids.map(seatLabel).join(', ')}`
})

function back(step: Step) {
  if (STEPS.findIndex(item => item.id === step) < stepIndex.value) goTo(step)
}

const nextLabel = computed(() => {
  if (state.step === 'seats') return state.selected.length ? `Confirmar ${state.selected.length} ${state.selected.length === 1 ? 'asiento' : 'asientos'}` : 'Elige tus asientos'
  if (state.step === 'tickets') return 'Continuar a alimentos'
  if (state.step === 'food') return state.items.length ? 'Continuar al pago' : 'Omitir alimentos'
  return state.quote ? `Pagar ${formatMoney(state.quote.totalCents)}` : 'Pagar'
})
const nextDisabled = computed(() => state.busy || (state.step === 'seats' ? !state.selected.length : !state.quote || state.quoting || Boolean(state.quoteError)))

const confirmLeave = () => confirmAction({
  title: 'Salir de la compra',
  text: 'Si sales, perderás los asientos que elegiste y volverán a estar disponibles para otras personas.',
  cancelLabel: 'Seguir comprando',
  confirmLabel: 'Salir',
  danger: true
})

async function leave() {
  if (state.hold) {
    const ok = await confirmLeave()
    if (!ok) return
    await release()
  }
  leaving = true
  void router.push(movie.data.value ? `/peliculas/${movie.data.value.slug}` : '/cartelera')
}

onBeforeRouteLeave(async () => {
  if (leaving || !state.hold) return true
  const ok = await confirmLeave()
  if (ok) await release()
  return ok
})
// Al cerrar la pestaña el apartado vence solo; se avisa por si fue un descuido.
const beforeUnload = (event: BeforeUnloadEvent) => { if (state.hold && !leaving) event.preventDefault() }
window.addEventListener('beforeunload', beforeUnload)
onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload))
</script>

<template>
  <div class="checkout">
    <header class="top">
      <button type="button" class="back" @click="leave"><ArrowLeft :size="20" /> <span>Salir</span></button>
      <RouterLink to="/" class="brand" aria-label="Inicio"><BrandMark /></RouterLink>
      <CountdownTimer v-if="state.hold" :until="state.hold.expiresAt" @expired="expire" />
    </header>

    <StateView :loading="screening.isPending.value || !state.restored" :error="screening.error.value" skeleton="block" class="container page" @retry="screening.refetch()">
      <div v-if="screening.data.value && screening.data.value.status !== 'on-sale' && !state.hold" class="container page">
        <div class="card closed">
          <h1>Esta función no está disponible</h1>
          <p class="muted">{{ screening.data.value.status === 'sold-out' ? 'Se agotaron los boletos.' : 'La venta en línea ya cerró.' }}</p>
          <RouterLink to="/cartelera" class="btn btn-primary">Ver otros horarios</RouterLink>
        </div>
      </div>
      <div v-else-if="screening.data.value" class="container layout">
        <section class="main">
          <ol class="steps" aria-label="Pasos de la compra">
            <li v-for="(step, index) in STEPS" :key="step.id" :class="{ current: step.id === state.step, done: index < stepIndex }">
              <button type="button" :disabled="index >= stepIndex" :aria-current="step.id === state.step ? 'step' : undefined" @click="back(step.id)">
                <i><Check v-if="index < stepIndex" :size="14" /><template v-else>{{ index + 1 }}</template></i>{{ step.label }}
              </button>
            </li>
          </ol>
          <p v-if="state.error" class="notice notice-error" role="alert">{{ state.error }}</p>
          <p v-if="state.quoteError && state.step !== 'seats'" class="notice notice-error" role="alert">{{ errorMessage(state.quoteError) }}</p>

          <div v-if="state.step === 'seats'" class="panel">
            <div class="panel-head">
              <h1>Elige tus asientos</h1>
              <p class="live" :class="seatMap.channel.value"><Radio v-if="seatMap.channel.value === 'connected'" :size="16" /><WifiOff v-else :size="16" /> {{ channelText }}</p>
            </div>
            <p class="muted">Hasta {{ max }} asientos por compra. Al confirmarlos se apartan por un tiempo limitado.</p>
            <StateView :loading="seatMap.layout.isPending.value || !seatMap.snapshot.value" :error="seatMap.layout.error.value" skeleton="block" @retry="seatMap.layout.refetch()">
              <SeatMap v-if="seatMap.layout.data.value && seatMap.snapshot.value" :layout="seatMap.layout.data.value"
                :statuses="seatMap.snapshot.value.seats" :selected="selectedSet" :limit-reached="state.selected.length >= max" @toggle="onSeat" />
            </StateView>
            <p v-if="seatMap.stale.value" class="notice notice-warning" role="status">No pudimos actualizar la disponibilidad. Reintentando…</p>
          </div>

          <div v-else-if="state.step === 'tickets'" class="panel">
            <h1>Tipos de boleto</h1>
            <p class="muted">Todos tus boletos empiezan como <strong>General</strong>. Si alguno es para otra persona, cambia su tipo aquí.</p>
            <StateView :loading="prices.isPending.value" :error="prices.error.value" skeleton="rows" @retry="prices.refetch()">
              <div class="ticket-rows">
                <TicketTypePicker v-for="seatId in state.hold?.seatIds ?? []" :key="seatId" v-model="state.types[seatId]!"
                  :seat-label="seatLabel(seatId)" :prices="prices.data.value ?? []" />
              </div>
            </StateView>
            <div v-if="eligiblePromotions.length" class="promotion">
              <BaseSelect v-model="promotionModel" label="Promoción para esta función" :options="promotionOptions" />
              <p class="muted small">Solo se aplica una promoción por compra.</p>
            </div>
            <p v-else-if="promotions.data.value" class="muted small">No hay promociones para esta función.</p>
            <p v-else-if="promotions.error.value" class="muted small">No pudimos consultar las promociones. Puedes continuar sin ellas.</p>
          </div>

          <div v-else-if="state.step === 'food'" class="panel">
            <h1>¿Quieres algo de la dulcería?</h1>
            <p class="muted">El mismo menú de la dulcería. Se entrega con tus boletos, sin necesidad de folio. Es opcional.</p>
            <div v-if="state.items.length" class="added">
              <h2>Agregado a tu compra</h2>
              <OrderLines :lines="state.items" @quantity="setItemQuantity" />
              <BaseSelect v-model="state.pickup" label="¿Cuándo los recoges?" :options="pickupOptions" />
            </div>
            <FoodCatalog v-model:category="foodCategory" :complex-id="complexId" :exclude-categories="['promocionales']" @add="addItem" />
          </div>

          <div v-else class="panel">
            <h1>Revisa y paga</h1>
            <PaymentForm ref="paymentForm" :initial-email="app.session.email" />
          </div>
        </section>

        <OrderSummary :movie="movie.data.value" :screening="screening.data.value" :layout="seatMap.layout.data.value"
          :seat-ids="state.hold && state.step !== 'seats' ? state.hold.seatIds : state.selected" :quote="state.step === 'seats' ? null : state.quote" :quoting="state.quoting">
          <button type="button" class="btn btn-primary btn-block wide-only" :disabled="nextDisabled" @click="next">
            {{ state.busy ? 'Procesando…' : nextLabel }}
          </button>
          <button v-if="stepIndex > 0" type="button" class="btn btn-ghost btn-block" @click="goTo(STEPS[stepIndex - 1]!.id)">Atrás</button>
        </OrderSummary>

        <!-- En pantallas angostas el resumen queda abajo: la acción principal siempre está a la mano. -->
        <div class="mobile-bar">
          <p>
            <strong>{{ mobileTotal }}</strong>
            <small>{{ mobileDetail }}</small>
          </p>
          <button type="button" class="btn btn-primary" :disabled="nextDisabled" @click="next">
            {{ state.busy ? 'Procesando…' : nextLabel }}
          </button>
        </div>
      </div>
    </StateView>

  </div>
</template>

<style scoped>
.checkout { min-height: 100dvh; }
.top { position: sticky; top: 0; z-index: 40; height: 68px; padding: 0 var(--page-gutter); display: flex; align-items: center; gap: 16px; background: var(--grad-dark); color: #fff; }
.back { display: inline-flex; align-items: center; gap: 6px; border: 0; background: none; color: #cfe3ff; font: 700 15px var(--font-title); }
.back:hover { color: var(--accent); }
.brand { margin-inline: auto; text-decoration: none; }
.layout { padding-block: 24px 64px; display: grid; grid-template-columns: minmax(0, 1fr) clamp(340px, 24vw, 420px); gap: 28px; align-items: start; }
.steps { margin: 0 0 16px; padding: 0; display: flex; gap: 6px; list-style: none; }
.steps li { flex: 1; }
.steps button { width: 100%; padding: 10px; display: flex; align-items: center; justify-content: center; gap: 8px; border: 0; border-bottom: 3px solid var(--line); background: transparent; color: var(--muted); font: 700 14px var(--font-title); }
.steps button:disabled { cursor: default; }
.steps i { width: 24px; height: 24px; display: grid; place-items: center; border-radius: 50%; background: var(--line); color: var(--ink); font: 700 12px var(--font-title); font-style: normal; }
.steps .current button { border-color: var(--blue); color: var(--blue); }
.steps .current i { background: var(--grad-blue); color: #fff; box-shadow: 0 0 12px rgba(56, 189, 248, .5); }
.steps .done button { color: var(--success); border-color: var(--success); }
.steps .done i { background: var(--success); color: #fff; }
.notice { margin-bottom: 14px; }
.panel { display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; padding: 24px; border: 1px solid var(--line); border-radius: var(--radius-l); background: var(--glass); box-shadow: var(--shadow-card); backdrop-filter: blur(14px); }
.panel h1 { font: 800 26px var(--font-title); letter-spacing: -.02em; }
.panel-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; }
.live { display: inline-flex; align-items: center; gap: 6px; color: var(--muted); font-size: 13px; }
.live.connected { color: var(--success); }
.live.reconnecting, .live.disconnected { color: var(--warning); }
.ticket-rows { display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px; }
.promotion { display: grid; gap: 6px; }
.small { font-size: 13px; }
.added { padding: 14px 16px; display: grid; gap: 6px; border-radius: var(--radius-m); background: var(--accent-soft); }
.added h2 { font: 800 16px var(--font-title); }
.added :deep(.lines li) { grid-template-columns: minmax(0, 1fr) auto; align-items: center; border-color: var(--line-strong); }
.added :deep(.controls) { gap: 8px; }
.closed { max-width: 520px; margin: 40px auto; padding: 32px; display: grid; gap: 12px; justify-items: center; text-align: center; }
.closed h1 { font: 800 24px var(--font-title); }
.mobile-bar { display: none; }
@media (max-width: 960px) {
  .layout { grid-template-columns: minmax(0, 1fr); padding-bottom: 120px; }
  .wide-only { display: none; }
  .mobile-bar {
    position: fixed; inset: auto 0 0; z-index: 45;
    padding: 12px var(--page-gutter) calc(12px + env(safe-area-inset-bottom));
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
    border-top: 1px solid var(--line); background: rgba(255, 255, 255, .96); box-shadow: 0 -8px 24px rgba(8, 17, 41, .12);
  }
  .mobile-bar p { min-width: 0; display: grid; }
  .mobile-bar strong { font: 800 18px var(--font-title); }
  .mobile-bar small { overflow: hidden; color: var(--muted); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
  .mobile-bar .btn { flex: none; }
  .back span { display: none; }
}
@media (max-width: 560px) {
  .steps button { flex-direction: column; gap: 4px; font-size: 12px; }
  .panel { padding: 16px 14px; }
}
</style>
