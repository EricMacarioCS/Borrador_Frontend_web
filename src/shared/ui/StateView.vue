<script setup lang="ts">
/** Estados de una consulta: cargando, error recuperable o vacío. */
import { computed } from 'vue'
import { CircleAlert, RefreshCw, SearchX } from '@lucide/vue'
import { toApiError } from '@/shared/lib/errors'
import { errorMessage, supportReference } from '@/shared/lib/messages'

const props = defineProps<{
  loading?: boolean
  error?: unknown
  empty?: boolean
  emptyTitle?: string
  emptyText?: string
  skeleton?: 'cards' | 'rows' | 'block'
}>()
const emit = defineEmits<{ retry: [] }>()

const apiError = computed(() => props.error ? toApiError(props.error) : null)
</script>

<template>
  <div class="state-view">
  <div v-if="loading" class="state" aria-busy="true">
    <span class="visually-hidden" role="status">Cargando…</span>
    <div v-if="skeleton === 'cards'" class="skeleton-grid">
      <div v-for="n in 8" :key="n" class="skeleton card-skeleton" />
    </div>
    <div v-else-if="skeleton === 'rows'" class="skeleton-rows">
      <div v-for="n in 5" :key="n" class="skeleton row-skeleton" />
    </div>
    <div v-else class="skeleton block-skeleton" />
  </div>
  <div v-else-if="apiError" class="state message" role="alert">
    <CircleAlert :size="34" aria-hidden="true" />
    <h2>No pudimos cargar esta información</h2>
    <p>{{ errorMessage(apiError) }}</p>
    <small v-if="supportReference(apiError)">Referencia: {{ supportReference(apiError) }}</small>
    <button type="button" class="btn btn-secondary" @click="emit('retry')"><RefreshCw :size="16" /> Reintentar</button>
  </div>
  <div v-else-if="empty" class="state message">
    <SearchX :size="34" aria-hidden="true" />
    <h2>{{ emptyTitle ?? 'Sin resultados' }}</h2>
    <p v-if="emptyText">{{ emptyText }}</p>
    <slot name="empty-actions" />
  </div>
  <slot v-else />
  </div>
</template>

<style scoped>
.message {
  padding: 48px 20px;
  display: grid;
  justify-items: center;
  gap: 10px;
  text-align: center;
  border: 1px dashed var(--line-strong);
  border-radius: var(--radius-l);
  background: rgba(255, 255, 255, .7);
}
.message svg { color: var(--blue); }
.message h2 { font: 800 20px var(--font-title); }
.message p { color: var(--muted); max-width: 52ch; }
.message small { color: var(--muted); }
.skeleton-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 18px; }
.card-skeleton { aspect-ratio: 2 / 3.4; }
.skeleton-rows { display: grid; gap: 12px; }
.row-skeleton { height: 96px; }
.block-skeleton { height: 320px; }
</style>
