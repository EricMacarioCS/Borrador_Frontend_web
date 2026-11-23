<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'
import { ChevronLeft, ChevronRight } from '@lucide/vue'
import { dayParts, formatDate } from '@/shared/lib/datetime'

const props = defineProps<{ days: string[]; today: string; available?: string[] | null }>()
const model = defineModel<string>({ required: true })
const strip = ref<HTMLElement>()

function scroll(direction: number) {
  strip.value?.scrollBy({ left: direction * strip.value.clientWidth * 0.8, behavior: 'smooth' })
}
function center() {
  void nextTick(() => strip.value?.querySelector<HTMLElement>('[aria-pressed="true"]')?.scrollIntoView({ inline: 'center', block: 'nearest' }))
}
onMounted(center)
watch(model, center)

const label = (day: string) => day === props.today ? 'HOY' : dayParts(day).weekday
</script>

<template>
  <div class="dates">
    <button type="button" class="arrow" aria-label="Días anteriores" @click="scroll(-1)"><ChevronLeft :size="20" /></button>
    <div ref="strip" class="strip" role="group" aria-label="Fecha de la función">
      <button v-for="day in days" :key="day" type="button" :aria-pressed="model === day" :title="formatDate(day)"
        :disabled="available ? !available.includes(day) : false" @click="model = day">
        <span>{{ label(day) }}</span>
        <strong>{{ dayParts(day).day }}</strong>
        <small>{{ dayParts(day).month }}</small>
        <span class="visually-hidden">{{ formatDate(day) }}</span>
      </button>
    </div>
    <button type="button" class="arrow" aria-label="Días siguientes" @click="scroll(1)"><ChevronRight :size="20" /></button>
  </div>
</template>

<style scoped>
.dates { display: flex; align-items: stretch; gap: 6px; }
/* `position: relative` contiene los textos ocultos (posición absoluta) dentro del desplazamiento; sin ella amplían la página en celular. */
.strip { position: relative; flex: 1; min-width: 0; display: flex; gap: 8px; overflow-x: auto; scroll-snap-type: x proximity; scrollbar-width: none; padding: 4px; }
.strip::-webkit-scrollbar { display: none; }
.strip button {
  flex: 0 0 74px;
  min-height: 74px;
  padding: 8px 4px;
  display: grid;
  justify-items: center;
  gap: 1px;
  scroll-snap-align: start;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: linear-gradient(180deg, #fff, #edf4ff);
  color: var(--ink);
  transition: border-color .2s, box-shadow .2s, transform .2s;
}
.strip button span, .strip button small { font: 700 11px var(--font-title); color: var(--muted); letter-spacing: .06em; }
.strip button strong { font: 800 22px var(--font-title); }
.strip button:hover:not(:disabled, [aria-pressed='true']) { border-color: var(--accent); box-shadow: 0 0 16px rgba(56, 189, 248, .4); transform: translateY(-2px); }
.strip button[aria-pressed='true'] { background: var(--grad-blue); color: #fff; border-color: transparent; box-shadow: inset 0 3px 0 var(--accent), 0 0 18px rgba(56, 189, 248, .45); }
.strip button[aria-pressed='true'] span, .strip button[aria-pressed='true'] small { color: #cfe5ff; }
.strip button:disabled { opacity: .4; }
.arrow { flex: 0 0 40px; display: grid; place-items: center; border: 1px solid var(--line); border-radius: 12px; background: #fff; color: var(--blue); }
.arrow:hover { background: var(--accent-soft); box-shadow: 0 0 13px rgba(56, 189, 248, .25); }
@media (max-width: 560px) {
  .arrow { display: none; }
  .strip button { flex-basis: 62px; }
}
</style>
