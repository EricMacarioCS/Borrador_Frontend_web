<script setup lang="ts">
import { computed } from 'vue'
import { Plus } from '@lucide/vue'
import type { Product } from '@/domain/models'
import { formatMoney } from '@/shared/lib/money'
import { hashHue } from '@/shared/lib/text'

const props = defineProps<{ products: Product[] }>()
const emit = defineEmits<{ choose: [product: Product] }>()

const sorted = computed(() => [...props.products].sort((a, b) => Number(b.available) - Number(a.available)))
</script>

<template>
  <ul class="grid" role="list">
    <li v-for="product in sorted" :key="product.id" class="product" :class="{ off: !product.available }">
      <div class="art" :style="{ '--hue': hashHue(product.category.code) }" aria-hidden="true">{{ product.name.slice(0, 1) }}</div>
      <div class="copy">
        <h3>{{ product.name }}</h3>
        <p>{{ product.description }}</p>
        <strong>{{ product.rules.length ? 'Desde ' : '' }}{{ formatMoney(product.basePriceCents) }}</strong>
      </div>
      <button type="button" class="btn btn-small" :class="product.available ? 'btn-primary' : 'btn-secondary'" :disabled="!product.available"
        :aria-label="product.available ? `Agregar ${product.name}` : `${product.name} agotado`" @click="emit('choose', product)">
        <template v-if="product.available"><Plus :size="16" /> Agregar</template>
        <template v-else>Agotado</template>
      </button>
    </li>
  </ul>
</template>

<style scoped>
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 16px; }
.product { display: grid; grid-template-rows: auto 1fr auto; gap: 12px; padding: 14px; border: 1px solid var(--line); border-radius: var(--radius-l); background: #fff; box-shadow: var(--shadow-card); transition: transform .3s var(--ease), box-shadow .3s; }
.product:hover:not(.off) { transform: translateY(-4px); box-shadow: 0 16px 34px rgba(11, 21, 48, .14), 0 0 0 1px var(--accent); }
.product.off { opacity: .6; }
.art { height: 120px; display: grid; place-items: center; border-radius: 12px; background: radial-gradient(70% 90% at 30% 20%, hsl(var(--hue) 90% 70% / .7), transparent 60%), linear-gradient(140deg, hsl(var(--hue) 60% 45%), #1b2a6b); color: rgba(255, 255, 255, .85); font: 800 54px var(--font-title); }
.copy { display: grid; gap: 4px; align-content: start; }
.copy h3 { font: 800 17px var(--font-title); }
.copy p { color: var(--muted); font-size: 14px; }
.copy strong { color: var(--blue); font: 800 16px var(--font-title); }
</style>
