<script setup lang="ts">
/** Productos elegidos con su cantidad. Lo usan el carrito, la pestaña Dulcería y la compra de boletos. */
import { Trash2 } from '@lucide/vue'
import QuantityStepper from '@/shared/ui/QuantityStepper.vue'
import { formatMoney } from '@/shared/lib/money'
import type { CartLine } from '@/app/stores/cart'

defineProps<{ lines: CartLine[] }>()
const emit = defineEmits<{ quantity: [key: string, quantity: number] }>()
</script>

<template>
  <ul class="lines" role="list">
    <li v-for="line in lines" :key="line.key">
      <div class="info">
        <strong>{{ line.name }}</strong>
        <small v-if="line.detail">{{ line.detail }}</small>
        <span>{{ formatMoney(line.estimateCents * line.quantity) }}</span>
      </div>
      <div class="controls">
        <QuantityStepper :model-value="line.quantity" :label="line.name" :min="1" :max="10" @update:model-value="emit('quantity', line.key, $event)" />
        <button type="button" class="remove" :aria-label="`Quitar ${line.name}`" @click="emit('quantity', line.key, 0)"><Trash2 :size="18" /></button>
      </div>
    </li>
  </ul>
</template>

<style scoped>
.lines { display: grid; }
.lines li { padding: 12px 0; display: grid; gap: 8px; border-bottom: 1px solid var(--line); }
.lines li:last-child { border-bottom: 0; }
.info { display: grid; gap: 2px; }
.info strong { font: 700 15px var(--font-title); }
.info small { color: var(--muted); }
.info span { font-weight: 700; }
.controls { display: flex; align-items: center; justify-content: space-between; }
.remove { width: 38px; height: 38px; display: grid; place-items: center; border: 0; border-radius: 10px; background: transparent; color: var(--danger); }
.remove:hover { background: var(--danger-soft); }
</style>
