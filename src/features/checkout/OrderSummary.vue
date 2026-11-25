<script setup lang="ts">
import { computed } from 'vue'
import type { Movie, Quote, Screening, SeatLayout } from '@/domain/models'
import PosterArt from '@/shared/ui/PosterArt.vue'
import { formatDate, formatTime } from '@/shared/lib/datetime'
import { formatMoney } from '@/shared/lib/money'
import { useAppStore } from '@/app/stores/app'

const props = defineProps<{
  movie: Movie | undefined
  screening: Screening
  layout: SeatLayout | undefined
  seatIds: string[]
  quote: Quote | null
  quoting: boolean
}>()
const app = useAppStore()
const complex = computed(() => app.complexById(props.screening.complexId))
const labels = computed(() => {
  const map = new Map(props.layout?.rows.flatMap(row => row.cells.flatMap(cell => cell ? [[cell.id, cell.label] as const] : [])) ?? [])
  return props.seatIds.map(id => map.get(id) ?? id)
})
</script>

<template>
  <aside class="summary" aria-label="Resumen de tu compra">
    <div class="head">
      <PosterArt v-if="movie" class="poster" :title="movie.title" :accent="movie.accent" :src="movie.posterUrl" decorative />
      <div>
        <strong class="title">{{ movie?.title ?? 'Función' }}</strong>
        <span v-if="movie" class="badge badge-rating">{{ movie.rating.code }}</span>
        <p>{{ complex?.name }}</p>
        <p>{{ formatDate(screening.businessDate) }} · {{ formatTime(screening.startsAt, complex?.timeZone) }}</p>
        <p>{{ screening.room.label }} · {{ screening.room.type.name }} · {{ screening.projection.name }} · {{ screening.language.name }}</p>
      </div>
    </div>
    <div class="body">
      <p class="seats"><span>Asientos</span><strong>{{ labels.length ? labels.join(', ') : 'Sin elegir' }}</strong></p>
      <template v-if="quote">
        <ul class="lines" role="list" :aria-busy="quoting">
          <li v-for="(line, index) in quote.lines" :key="index">
            <span>{{ line.quantity }} × {{ line.description }}<small v-if="line.detail">{{ line.detail }}</small></span>
            <span>{{ formatMoney(line.totalCents) }}</span>
          </li>
          <li v-if="quote.discountCents" class="discount"><span>{{ quote.promotion?.title }}</span><span>−{{ formatMoney(quote.discountCents) }}</span></li>
          <li v-if="quote.serviceFeeCents"><span>Cargo por servicio en línea</span><span>{{ formatMoney(quote.serviceFeeCents) }}</span></li>
        </ul>
        <p class="total"><span>Total</span><strong>{{ formatMoney(quote.totalCents) }}</strong></p>
        <p v-if="quote.promotion && !quote.promotion.applied" class="notice notice-warning">{{ quote.promotion.title }}: {{ quote.promotion.reason }}</p>
      </template>
      <p v-else-if="seatIds.length" class="muted">El total se calcula al confirmar tus asientos.</p>
      <p v-if="quoting" class="muted small" role="status">Actualizando total…</p>
    </div>
    <div class="actions"><slot /></div>
  </aside>
</template>

<style scoped>
.summary { position: sticky; top: 16px; display: grid; overflow: hidden; border: 1px solid var(--line); border-radius: var(--radius-l); background: var(--glass-strong); box-shadow: var(--shadow-card); }
.head { padding: 18px; display: flex; gap: 14px; background: var(--grad-dark); color: #fff; }
.poster { width: 72px; flex-shrink: 0; }
.title { display: block; margin-bottom: 4px; font: 800 18px var(--font-title); }
.head .badge-rating { color: #fff; }
.head p { margin-top: 4px; color: #c9d6ea; font-size: 13px; }
.body { padding: 18px; display: grid; gap: 12px; }
.seats { display: flex; justify-content: space-between; gap: 12px; }
.seats span { color: var(--muted); }
.seats strong { text-align: right; }
.lines { display: grid; gap: 8px; padding-top: 12px; border-top: 1px solid var(--line); }
.lines li { display: flex; justify-content: space-between; gap: 12px; font-size: 14px; }
.lines small { display: block; color: var(--muted); font-size: 12px; }
.discount { color: var(--success); font-weight: 700; }
.total { display: flex; justify-content: space-between; padding-top: 12px; border-top: 1px solid var(--line); font: 800 20px var(--font-title); }
.small { font-size: 13px; }
.actions { padding: 0 18px 18px; display: grid; gap: 10px; }
</style>
