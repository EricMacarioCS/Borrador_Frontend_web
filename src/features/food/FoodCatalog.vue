<script setup lang="ts">
/**
 * Catálogo de dulcería: categorías, productos y personalización.
 * Es el mismo en la pestaña Dulcería y en el paso de alimentos de la compra de boletos;
 * cada vista decide qué hacer con el producto elegido (carrito o compra en curso).
 */
import { computed, ref, watch } from 'vue'
import { Search, X } from '@lucide/vue'
import ProductGrid from './ProductGrid.vue'
import ProductCustomizer from './ProductCustomizer.vue'
import StateView from '@/shared/ui/StateView.vue'
import { useProducts } from '@/app/queries'
import { normalizeText } from '@/shared/lib/text'
import type { CartLine } from '@/app/stores/cart'
import type { Product } from '@/domain/models'

const props = withDefaults(defineProps<{
  complexId: string | null
  actionLabel: string
  /** Categorías que no aplican en este contexto. */
  excludeCategories?: string[]
}>(), { excludeCategories: () => [] })
const emit = defineEmits<{ add: [line: Omit<CartLine, 'key'>] }>()
const category = defineModel<string>('category', { default: 'todas' })

const products = useProducts(() => props.complexId)
const customizing = ref<Product | null>(null)
const term = ref('')

const available = computed(() => (products.data.value ?? []).filter(product => !props.excludeCategories.includes(product.category.code)))
const categories = computed(() => {
  const seen = new Map<string, { label: string; count: number }>()
  for (const product of available.value) {
    const entry = seen.get(product.category.code) ?? { label: product.category.name, count: 0 }
    entry.count++
    seen.set(product.category.code, entry)
  }
  return [{ value: 'todas', label: 'Todo', count: available.value.length }, ...[...seen].map(([value, { label, count }]) => ({ value, label, count }))]
})
const shown = computed(() => {
  const query = normalizeText(term.value)
  return available.value.filter(product =>
    (category.value === 'todas' || product.category.code === category.value) &&
    (!query || normalizeText(`${product.name} ${product.description}`).includes(query)))
})

watch(() => props.complexId, () => { category.value = 'todas' })

function add(line: Omit<CartLine, 'key'>) {
  emit('add', line)
  customizing.value = null
}
</script>

<template>
  <div class="catalog">
    <div class="bar">
      <div class="chip-row" role="group" aria-label="Categoría">
        <button v-for="item in categories" :key="item.value" type="button" class="chip" :aria-pressed="category === item.value" @click="category = item.value">
          {{ item.label }} <span class="n">{{ item.count }}</span>
        </button>
      </div>
      <label class="search">
        <Search :size="17" aria-hidden="true" />
        <span class="visually-hidden">Buscar en dulcería</span>
        <input v-model="term" type="search" placeholder="Buscar producto" autocomplete="off" />
        <button v-if="term" type="button" class="clear" aria-label="Borrar búsqueda" @click="term = ''"><X :size="14" /></button>
      </label>
    </div>

    <StateView :loading="products.isPending.value" :error="products.error.value" :empty="!shown.length" skeleton="cards"
      :empty-title="term ? `No hay productos con «${term}»` : 'No hay productos en esta categoría'" @retry="products.refetch()">
      <ProductGrid :products="shown" @choose="customizing = $event" />
    </StateView>

    <ProductCustomizer :product="customizing" :action-label="actionLabel" @close="customizing = null" @add="add" />
  </div>
</template>

<style scoped>
.catalog { display: grid; gap: 18px; min-width: 0; }
.bar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; }
.n { margin-left: 4px; opacity: .7; font-size: 12px; }
.search { flex: 0 1 280px; min-width: 200px; display: flex; align-items: center; gap: 8px; padding: 0 10px; border: 1px solid var(--line-strong); border-radius: 999px; background: #fff; }
.search:focus-within { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(56, 189, 248, .25); }
.search svg { flex: none; color: var(--blue); }
.search input { flex: 1; min-width: 0; min-height: 38px; border: 0; background: transparent; font-size: 14px; }
.search input:focus { outline: none; }
.search input::-webkit-search-cancel-button { display: none; }
.clear { flex: none; width: 24px; height: 24px; display: grid; place-items: center; border: 0; border-radius: 50%; background: var(--surface-soft); color: var(--muted); }
@media (max-width: 640px) { .search { flex-basis: 100%; } }
</style>
