<script setup lang="ts">
/**
 * Mapa de la sala. Se navega con flechas (un solo punto de tabulación) y cada estado
 * se distingue por color, forma y texto, no solo por color.
 */
import { computed, nextTick, onMounted, ref } from 'vue'
import { Accessibility, Minus, Plus } from '@lucide/vue'
import type { SeatCell, SeatLayout, SeatStatus } from '@/domain/models'

const props = defineProps<{
  layout: SeatLayout
  statuses: Record<string, SeatStatus>
  /** Asientos que pertenecen a este cliente: su apartado más la selección local. */
  selected: Set<string>
  limitReached: boolean
}>()
const emit = defineEmits<{ toggle: [seat: SeatCell] }>()

const ZOOMS = [1, 1.25, 1.5]
const zoom = ref(0)
const focusId = ref<string | null>(null)
const grid = ref<HTMLElement>()
const scroller = ref<HTMLElement>()

// Si la sala no cabe completa, se empieza viendo el centro, frente a la pantalla.
onMounted(() => {
  const el = scroller.value
  if (el && el.scrollWidth > el.clientWidth) el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2
})

type State = 'available' | 'selected' | 'taken'
function stateOf(seat: SeatCell): State {
  if (props.selected.has(seat.id)) return 'selected'
  return (props.statuses[seat.id] ?? 'available') === 'available' ? 'available' : 'taken'
}
const disabled = (seat: SeatCell) => stateOf(seat) === 'taken' || (stateOf(seat) === 'available' && props.limitReached)

const firstSeat = computed(() => props.layout.rows.flatMap(row => row.cells).find(cell => cell && stateOf(cell) !== 'taken') ?? null)
const tabTarget = computed(() => focusId.value ?? firstSeat.value?.id ?? null)

function label(seat: SeatCell) {
  const state = stateOf(seat)
  const kind = seat.kind === 'accessible' ? ', lugar para silla de ruedas' : seat.kind === 'companion' ? ', lugar de acompañante' : ''
  return `${seat.label}${kind}, ${state === 'selected' ? 'seleccionado' : state === 'taken' ? 'ocupado' : 'disponible'}`
}

function move(rowIndex: number, cellIndex: number, dRow: number, dCol: number) {
  const rows = props.layout.rows
  let r = rowIndex
  let c = cellIndex
  for (let guard = 0; guard < 400; guard++) {
    r += dRow
    c += dCol
    if (r < 0 || r >= rows.length) return
    const row = rows[r]!
    if (dRow !== 0) c = Math.min(Math.max(c, 0), row.cells.length - 1)
    if (c < 0 || c >= row.cells.length) return
    // Al bajar o subir se busca el asiento más cercano en esa fila.
    let target = row.cells[c]
    if (!target && dRow !== 0) {
      for (let offset = 1; offset < row.cells.length && !target; offset++) target = row.cells[c - offset] ?? row.cells[c + offset]
    }
    if (target) {
      focusId.value = target.id
      void nextTick(() => grid.value?.querySelector<HTMLElement>(`[data-seat="${CSS.escape(target.id)}"]`)?.focus())
      return
    }
  }
}

function onKey(event: KeyboardEvent, rowIndex: number, cellIndex: number) {
  const moves: Record<string, [number, number]> = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] }
  const step = moves[event.key]
  if (step) {
    event.preventDefault()
    move(rowIndex, cellIndex, step[0], step[1])
  }
}
</script>

<template>
  <div class="seat-map">
    <div class="toolbar">
      <ul class="legend" role="list" aria-label="Simbología">
        <li><i class="dot available" /> Disponible</li>
        <li><i class="dot selected" /> Tu selección</li>
        <li><i class="dot taken" /> Ocupado</li>
        <li><Accessibility :size="16" aria-hidden="true" /> Silla de ruedas</li>
      </ul>
      <div class="zoom" role="group" aria-label="Acercamiento">
        <button type="button" :disabled="zoom === 0" aria-label="Alejar" @click="zoom--"><Minus :size="16" /></button>
        <span aria-live="polite">{{ Math.round(ZOOMS[zoom]! * 100) }} %</span>
        <button type="button" :disabled="zoom === ZOOMS.length - 1" aria-label="Acercar" @click="zoom++"><Plus :size="16" /></button>
      </div>
    </div>
    <div ref="scroller" class="scroller">
      <div class="room" :style="{ '--zoom': ZOOMS[zoom] }">
        <div class="screen" aria-hidden="true">PANTALLA</div>
        <div ref="grid" role="grid" aria-label="Asientos de la sala" class="rows">
          <div v-for="(row, rowIndex) in layout.rows" :key="row.label" role="row" class="row">
            <span class="row-label" role="rowheader">{{ row.label }}</span>
            <template v-for="(cell, cellIndex) in row.cells" :key="cell?.id ?? `${row.label}-gap-${cellIndex}`">
              <span v-if="!cell" class="gap" role="presentation" />
              <span v-else role="gridcell">
                <button type="button" class="seat" :class="[stateOf(cell), cell.kind]" :data-seat="cell.id"
                  :tabindex="tabTarget === cell.id ? 0 : -1" :aria-label="label(cell)" :aria-pressed="stateOf(cell) === 'selected'"
                  :aria-disabled="disabled(cell) || undefined"
                  @focus="focusId = cell.id" @keydown="onKey($event, rowIndex, cellIndex)" @click="!disabled(cell) && emit('toggle', cell)">
                  <Accessibility v-if="cell.kind === 'accessible'" :size="13" aria-hidden="true" />
                </button>
              </span>
            </template>
            <span class="row-label" aria-hidden="true">{{ row.label }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.toolbar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
.legend { display: flex; flex-wrap: wrap; gap: 8px 16px; padding: 0; list-style: none; color: var(--muted); font-size: 13px; }
.legend li { display: inline-flex; align-items: center; gap: 6px; }
.dot { width: 16px; height: 14px; border-radius: 4px 4px 3px 3px; display: inline-block; }
.dot.available { background: #fff; border: 1.5px solid #6d86ad; }
.dot.selected { background: var(--grad-action); box-shadow: 0 0 8px var(--glow); }
.dot.taken { background: #c9d3e2; }
.zoom { display: flex; align-items: center; gap: 8px; font: 700 13px var(--font-title); }
.zoom button { width: 34px; height: 34px; display: grid; place-items: center; border: 1px solid var(--line-strong); border-radius: 10px; background: #fff; color: var(--blue); }
.zoom button:disabled { opacity: .4; }
.scroller { overflow: auto; padding: 8px 4px 16px; border-radius: var(--radius-l); background: radial-gradient(70% 50% at 50% 0%, rgba(56, 189, 248, .16), transparent 70%), linear-gradient(180deg, #0b1530, #081129); }
.room { --seat: calc(26px * var(--zoom)); width: max-content; min-width: 100%; padding: 14px 18px; display: grid; justify-items: center; }
.screen {
  width: min(80%, 720px);
  margin-bottom: 26px;
  padding-top: 10px;
  border-top: 4px solid var(--accent);
  border-radius: 50% 50% 0 0 / 22px 22px 0 0;
  box-shadow: 0 -10px 30px rgba(56, 189, 248, .45);
  color: #9fc3f5;
  font: 700 12px var(--font-title);
  letter-spacing: .4em;
  text-align: center;
}
.rows { display: grid; gap: 6px; }
.row { display: flex; align-items: center; justify-content: center; gap: 5px; }
.row-label { width: 22px; color: #8aa3c8; font: 700 12px var(--font-title); text-align: center; }
.gap { width: var(--seat); height: var(--seat); }
.seat {
  width: var(--seat);
  height: var(--seat);
  padding: 0;
  display: grid;
  place-items: center;
  border: 1.5px solid #6d86ad;
  border-radius: 7px 7px 4px 4px;
  background: #fff;
  color: var(--blue);
  transition: transform .15s var(--ease), box-shadow .2s, background .2s;
}
.seat.available:hover:not([aria-disabled]) { transform: translateY(-2px); box-shadow: 0 0 0 2px var(--accent), 0 0 14px var(--glow); }
.seat.selected { border-color: transparent; background: var(--grad-action); color: var(--navy-900); box-shadow: 0 0 12px var(--glow); animation: pick .3s var(--ease); }
.seat.taken { border-color: transparent; background: #3a4a66; cursor: not-allowed; }
.seat.taken::after { content: ''; width: 45%; height: 2px; background: #8698b5; transform: rotate(-45deg); }
.seat.taken svg { display: none; }
.seat.premium { border-radius: 10px 10px 6px 6px; }
.seat[aria-disabled]:not(.taken) { opacity: .55; cursor: not-allowed; }
.seat:focus-visible { outline: 3px solid var(--gold); outline-offset: 2px; }
@keyframes pick { 50% { transform: scale(1.18); } }
</style>
