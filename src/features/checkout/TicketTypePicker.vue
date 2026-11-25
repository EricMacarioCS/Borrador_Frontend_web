<script setup lang="ts">
/** Tipo de boleto de un asiento: todas las opciones y sus precios a la vista. */
import { computed, useId } from 'vue'
import { Check } from '@lucide/vue'
import type { TicketPrice } from '@/domain/models'
import { formatMoney } from '@/shared/lib/money'

const props = defineProps<{ seatLabel: string; prices: TicketPrice[] }>()
const model = defineModel<string>({ required: true })
const uid = useId()
const current = computed(() => props.prices.find(price => price.ticketTypeId === model.value))
</script>

<template>
  <fieldset class="seat-ticket">
    <legend class="visually-hidden">Tipo de boleto del asiento {{ seatLabel }}</legend>
    <p class="head" aria-hidden="true">
      <strong>Asiento {{ seatLabel }}</strong>
      <span v-if="current">{{ current.name }} · {{ formatMoney(current.priceCents) }}</span>
    </p>
    <div class="options">
      <label v-for="price in prices" :key="price.ticketTypeId" class="option"
        :class="{ checked: model === price.ticketTypeId, off: !price.allowed }">
        <input v-model="model" class="visually-hidden" type="radio" :name="uid" :value="price.ticketTypeId" :disabled="!price.allowed" />
        <span class="mark" aria-hidden="true"><Check :size="12" :stroke-width="3.5" /></span>
        <span class="name">{{ price.name }}</span>
        <strong>{{ formatMoney(price.priceCents) }}</strong>
        <small>{{ price.allowed ? price.description : price.reason ?? 'No disponible' }}</small>
      </label>
    </div>
  </fieldset>
</template>

<style scoped>
.seat-ticket { min-width: 0; margin: 0; padding: 14px; border: 1px solid var(--line); border-radius: var(--radius-l); background: var(--glass-strong); box-shadow: var(--shadow-soft); }
.head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 6px 12px; margin-bottom: 10px; }
.head strong { font: 800 16px var(--font-title); }
.head span { padding: 4px 12px; border-radius: var(--radius-pill); background: var(--accent-soft); color: var(--blue); font: 700 12px var(--font-title); }
.options { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px; }
.option {
  position: relative;
  min-width: 0;
  padding: 10px 12px;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  column-gap: 8px;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-m);
  background: #fff;
  cursor: pointer;
  transition: border-color .25s, box-shadow .25s, background .25s;
}
.option:hover:not(.off, .checked) { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(56, 189, 248, .16); }
.option:focus-within { outline: 3px solid var(--accent); outline-offset: 2px; }
.option.checked { border-color: transparent; background: var(--grad-blue); color: #fff; box-shadow: 0 0 0 1px rgba(56, 189, 248, .7), 0 10px 24px -10px rgba(56, 189, 248, .75); }
.mark { width: 18px; height: 18px; display: grid; place-items: center; border: 1.5px solid #8aa0c4; border-radius: 50%; color: transparent; }
.checked .mark { border-color: transparent; background: var(--grad-action); color: #06142f; }
.name { font: 700 14px var(--font-title); }
.option strong { font: 800 14px var(--font-title); }
.option small { grid-column: 2 / -1; color: var(--muted); font-size: 12px; line-height: 1.35; }
.checked small { color: #d6ebff; }
.option.off { border-style: dashed; background: #eef1f6; color: #6b7890; cursor: not-allowed; }
.off small { color: #5b6b84; }
@media (max-width: 640px) { .options { grid-template-columns: minmax(0, 1fr); } }
</style>
