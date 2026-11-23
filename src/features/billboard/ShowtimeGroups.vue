<script setup lang="ts">
/** Horarios agrupados por complejo y por tipo de sala, proyección e idioma, con su ocupación. */
import { computed } from 'vue'
import type { Screening } from '@/domain/models'
import { useAppStore } from '@/app/stores/app'
import OccupancyRing from '@/shared/ui/OccupancyRing.vue'
import { formatTime } from '@/shared/lib/datetime'
import { formatMoney } from '@/shared/lib/money'
import { OCCUPANCY_LEGEND } from '@/domain/occupancy'

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
</script>

<template>
  <div class="showtimes">
    <section v-for="group in groups" :key="group.complex?.id" class="complex">
      <h3 v-if="multipleComplexes" class="complex-name">{{ group.complex?.name }}</h3>
      <div v-for="format in group.formats" :key="format.label" class="format">
        <p class="format-label">{{ format.label }}</p>
        <ul class="times" role="list">
          <li v-for="screening in format.items" :key="screening.id">
            <button type="button" class="time" :class="{ active: selectedId === screening.id }" :disabled="screening.status !== 'on-sale'"
              :aria-pressed="selectedId ? selectedId === screening.id : undefined"
              :aria-label="`${formatTime(screening.startsAt, group.complex?.timeZone)}, ${format.label}, ${screening.status === 'sold-out' ? 'agotado' : `${left(screening)} asientos libres`}, desde ${formatMoney(screening.fromPriceCents)}`"
              @click="emit('pick', screening)">
              <OccupancyRing :unavailable="screening.occupancy.unavailable" :capacity="screening.occupancy.capacity" />
              <span>
                <strong>{{ formatTime(screening.startsAt, group.complex?.timeZone) }}</strong>
                <small>{{ screening.status === 'sold-out' ? 'Agotado' : `${left(screening)} libres` }}</small>
              </span>
            </button>
          </li>
        </ul>
      </div>
    </section>
    <div v-if="showLegend" class="legend" aria-label="Ocupación de la sala">
      <span>Asientos ocupados:</span>
      <i v-for="item in OCCUPANCY_LEGEND" :key="item.tone" :class="`tone-${item.tone}`">{{ item.label }}</i>
    </div>
  </div>
</template>

<style scoped>
.complex + .complex { margin-top: 18px; padding-top: 14px; border-top: 1px solid var(--line); }
.complex-name { margin-bottom: 4px; color: var(--blue); font: 700 15px var(--font-title); }
.format { margin-top: 14px; }
.format-label { color: var(--blue); font: 700 13px var(--font-title); }
.times { margin-top: 8px; display: grid; grid-template-columns: repeat(auto-fill, minmax(136px, 1fr)); gap: 10px; }
.time {
  --tone: var(--blue);
  width: 100%;
  min-height: 60px;
  padding: 8px 12px;
  display: flex;
  align-items: center;
  gap: 10px;
  border: 1px solid var(--line-strong);
  border-radius: 13px;
  background: linear-gradient(180deg, #fff, #edf4ff);
  text-align: left;
  transition: border-color .2s, box-shadow .2s, transform .2s;
}
.time strong { display: block; font: 800 16px var(--font-title); }
.time small { display: block; color: var(--muted); font-size: 12px; }
.time:hover:not(:disabled) { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent), 0 0 22px rgba(56, 189, 248, .5); transform: translateY(-2px); }
.time.active { background: var(--grad-blue); border-color: transparent; color: #fff; box-shadow: 0 0 0 2px var(--accent), 0 0 24px var(--glow); }
.time.active small { color: #cfe5ff; }
.time:disabled { opacity: .5; }
.legend { margin-top: 16px; display: flex; flex-wrap: wrap; align-items: center; gap: 6px 14px; color: var(--muted); font-size: 13px; }
.legend i { display: inline-flex; align-items: center; gap: 6px; font-style: normal; }
.legend i::before { content: ''; width: 10px; height: 10px; border-radius: 50%; background: var(--tone); box-shadow: 0 0 8px var(--tone); }
.tone-low { --tone: var(--occ-low); }
.tone-medium { --tone: var(--occ-medium); }
.tone-high { --tone: var(--occ-high); }
.tone-full { --tone: var(--occ-full); }
</style>
