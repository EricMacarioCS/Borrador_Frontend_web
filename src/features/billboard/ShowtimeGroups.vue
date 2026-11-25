<script setup lang="ts">
/** Horarios agrupados por complejo y por tipo de sala, proyección e idioma, con su ocupación. */
import { computed } from 'vue'
import type { Screening } from '@/domain/models'
import { useAppStore } from '@/app/stores/app'
import { formatTime } from '@/shared/lib/datetime'
import { formatMoney } from '@/shared/lib/money'
import { OCCUPANCY_LEGEND, availabilityText, freeSeatsText, occupancyPercent, occupancyTone } from '@/domain/occupancy'

const props = withDefaults(defineProps<{ screenings: Screening[]; selectedId?: string | null; showLegend?: boolean }>(), { selectedId: null, showLegend: true })
const emit = defineEmits<{ pick: [screening: Screening] }>()
const app = useAppStore()

const groups = computed(() => {
  const byComplex = new Map<string, Map<string, Screening[]>>()
  for (const screening of props.screenings) {
    const complex = byComplex.get(screening.complexId) ?? new Map<string, Screening[]>()
    const key = `${screening.room.type.name} · ${screening.projection.name} · ${screening.language.name}`
    complex.set(key, [...(complex.get(key) ?? []), screening])
    byComplex.set(screening.complexId, complex)
  }
  return [...byComplex].map(([complexId, formats]) => ({
    complex: app.complexById(complexId),
    formats: [...formats].map(([label, items]) => ({ label, items: items.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime()) }))
  }))
})
const multipleComplexes = computed(() => groups.value.length > 1)
const left = (screening: Screening) => Math.max(0, screening.occupancy.capacity - screening.occupancy.unavailable)
const closed = (screening: Screening) => screening.status === 'closed' || screening.status === 'cancelled'

/** Disponibilidad de una función: texto visible, explicación, color y avance de la barra. */
function availability(screening: Screening) {
  const { unavailable, capacity } = screening.occupancy
  if (screening.status === 'sold-out') return { text: 'Agotado', detail: 'No quedan lugares libres.', tone: 'full', fill: 100 }
  if (closed(screening)) return { text: 'No disponible', detail: 'La venta en línea de esta función está cerrada.', tone: 'closed', fill: 0 }
  const percent = occupancyPercent(unavailable, capacity)
  return {
    text: availabilityText(unavailable, capacity),
    detail: `${freeSeatsText(left(screening))} de ${capacity}. La barra de color muestra qué tan llena está la sala.`,
    tone: occupancyTone(percent),
    fill: percent
  }
}
</script>

<template>
  <div class="showtimes">
    <section v-for="group in groups" :key="group.complex?.id" class="complex">
      <h3 v-if="multipleComplexes" class="complex-name">{{ group.complex?.name }}</h3>
      <div v-for="format in group.formats" :key="format.label" class="format">
        <p class="format-label">{{ format.label }}</p>
        <ul class="times" role="list">
          <li v-for="screening in format.items" :key="screening.id">
            <button type="button" class="time" :class="[`tone-${availability(screening).tone}`, { active: selectedId === screening.id }]"
              :disabled="screening.status !== 'on-sale'" :title="availability(screening).detail"
              :aria-pressed="selectedId ? selectedId === screening.id : undefined"
              :aria-label="`${formatTime(screening.startsAt, group.complex?.timeZone)}, ${format.label}, ${availability(screening).text}. ${availability(screening).detail} Desde ${formatMoney(screening.fromPriceCents)}`"
              @click="emit('pick', screening)">
              <strong>{{ formatTime(screening.startsAt, group.complex?.timeZone) }}</strong>
              <small>{{ availability(screening).text }}</small>
              <span class="meter" aria-hidden="true"><span :style="{ width: `${availability(screening).fill}%` }" /></span>
            </button>
          </li>
        </ul>
      </div>
    </section>
    <div v-if="showLegend" class="legend" role="group" aria-label="Significado de los colores de disponibilidad">
      <span>Disponibilidad:</span>
      <i v-for="item in OCCUPANCY_LEGEND" :key="item.tone" :class="`tone-${item.tone}`">{{ item.label }}</i>
    </div>
  </div>
</template>

<style scoped>
.complex + .complex { margin-top: 22px; padding-top: 18px; border-top: 1px solid var(--line); }
.complex-name { margin-bottom: 4px; color: var(--blue); font: 700 15px var(--font-title); }
.format { margin-top: 18px; }
.format-label { color: var(--blue); font: 700 13px var(--font-title); }
.times { margin-top: 10px; display: grid; grid-template-columns: repeat(auto-fill, minmax(132px, 1fr)); gap: 12px; }
.time {
  width: 100%;
  min-height: 78px;
  padding: 11px 14px 12px;
  display: grid;
  align-content: center;
  gap: 2px;
  border: 1px solid var(--line);
  border-radius: var(--radius-m);
  background: var(--glass-strong);
  box-shadow: var(--shadow-soft);
  text-align: left;
  transition: border-color .25s, box-shadow .25s, transform .25s var(--ease);
}
.time strong { font: 800 18px var(--font-title); letter-spacing: -.01em; }
.time small { color: var(--muted); font-size: 12px; white-space: nowrap; }
.time.tone-high small { color: var(--warning); font-weight: 700; }
.time.tone-full small { color: var(--danger); font-weight: 700; }
.meter { height: 4px; margin-top: 6px; overflow: hidden; border-radius: var(--radius-pill); background: rgba(23, 78, 166, .1); }
.meter span { display: block; min-width: 6px; height: 100%; border-radius: inherit; background: var(--tone); }
.time:hover:not(:disabled) { border-color: rgba(56, 189, 248, .75); box-shadow: 0 0 0 3px rgba(56, 189, 248, .16), 0 12px 26px -12px rgba(56, 189, 248, .7); transform: translateY(-2px); }
.time:focus-visible { border-radius: var(--radius-m); }
.time.active { background: var(--grad-blue); border-color: transparent; color: #fff; box-shadow: 0 0 0 2px var(--accent), 0 0 22px rgba(56, 189, 248, .45); }
.time.active small { color: #d6ebff; }
.time.active .meter { background: rgba(255, 255, 255, .22); }
.time:disabled { opacity: .55; box-shadow: none; }
.time.tone-closed .meter span { min-width: 0; }
/* En celular caben dos horarios por renglón; el texto de disponibilidad puede ocupar dos líneas. */
@media (max-width: 560px) {
  .times { grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 8px; }
  .time { height: 100%; padding: 10px; }
  .time small { white-space: normal; line-height: 1.3; }
}
.legend { margin-top: 16px; display: flex; flex-wrap: wrap; align-items: center; gap: 6px 14px; color: var(--muted); font-size: 13px; }
.legend i { display: inline-flex; align-items: center; gap: 6px; font-style: normal; }
.legend i::before { content: ''; width: 10px; height: 10px; border-radius: 50%; background: var(--tone); box-shadow: 0 0 8px var(--tone); }
.tone-low { --tone: var(--occ-low); }
.tone-medium { --tone: var(--occ-medium); }
.tone-high { --tone: var(--occ-high); }
.tone-full { --tone: var(--occ-full); }
</style>
