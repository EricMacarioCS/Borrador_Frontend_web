<script setup lang="ts">
/** Compra rápida bajo la portada. Solo aparece al pulsar "Comprar boletos". */
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { X } from '@lucide/vue'
import BaseSelect from '@/shared/ui/BaseSelect.vue'
import { useScreeningDates, useScreenings } from '@/app/queries'
import { useAppStore } from '@/app/stores/app'
import { formatDate, formatTime } from '@/shared/lib/datetime'
import type { Movie } from '@/domain/models'

const props = defineProps<{ movie: Movie }>()
const emit = defineEmits<{ close: [] }>()
const app = useAppStore()
const router = useRouter()

const complexId = ref<string | null>(app.primaryComplex?.id ?? null)
const complexIds = computed(() => complexId.value ? [complexId.value] : [])
const dates = useScreeningDates(() => props.movie.id, complexIds)
const date = ref<string | null>(null)
const screenings = useScreenings(complexIds, () => date.value ?? '', () => props.movie.id)
const screeningId = ref<string | null>(null)

watch(() => dates.data.value, list => { date.value = list?.[0] ?? null }, { immediate: true })
watch([complexId, date], () => { screeningId.value = null })

const complexOptions = computed(() => app.complexes.map(complex => ({ value: complex.id, label: complex.name, hint: complex.city })))
const dateOptions = computed(() => (dates.data.value ?? []).map(value => ({ value, label: formatDate(value) })))
const timeOptions = computed(() => (screenings.data.value ?? []).map(item => ({
  value: item.id,
  label: formatTime(item.startsAt),
  hint: `${item.room.type.name} · ${item.projection.name} · ${item.language.name}`,
  disabled: item.status !== 'on-sale'
})))
const notOnSale = computed(() => props.movie.stage === 'coming-soon' || (!dates.isPending.value && !dates.data.value?.length))
</script>

<template>
  <section class="quick" :aria-label="`Compra rápida de ${movie.title}`">
    <div class="container grid">
      <div class="title">
        <span class="eyebrow">Compra rápida</span>
        <strong>{{ movie.title }}</strong>
      </div>
      <template v-if="!notOnSale">
        <BaseSelect v-model="complexId" label="Cine" :options="complexOptions" />
        <BaseSelect v-model="date" label="Fecha" :options="dateOptions" :disabled="!dateOptions.length" />
        <BaseSelect v-model="screeningId" label="Horario" :options="timeOptions" :disabled="!timeOptions.length"
          :placeholder="screenings.isFetching.value ? 'Cargando…' : 'Elige un horario'" />
        <button type="button" class="btn btn-primary" :disabled="!screeningId" @click="router.push(`/compra/${screeningId}`)">Elegir asientos</button>
      </template>
      <p v-else class="notice soon">Estreno el {{ formatDate(movie.releaseDate) }}. La venta aún no inicia en este cine.</p>
      <button type="button" class="close" aria-label="Cerrar compra rápida" @click="emit('close')"><X :size="20" /></button>
    </div>
  </section>
</template>

<style scoped>
.quick { position: relative; padding: 18px 0; background: var(--grad-menu); color: #fff; box-shadow: inset 0 1px 0 rgba(255, 255, 255, .1); animation: drop .35s var(--ease); }
.grid { display: grid; grid-template-columns: minmax(150px, 1fr) repeat(3, minmax(0, 1.3fr)) auto 44px; align-items: end; gap: 14px; }
.title { display: grid; gap: 2px; }
.title .eyebrow { color: var(--accent); }
.title strong { font: 800 18px var(--font-title); }
.quick :deep(.field-label) { color: #b8cdee; }
.soon { grid-column: 2 / 6; background: rgba(255, 255, 255, .1); color: #e6eefb; }
.close { width: 44px; height: 44px; display: grid; place-items: center; border: 1px solid rgba(255, 255, 255, .3); border-radius: 12px; background: transparent; color: #fff; }
.close:hover { background: var(--grad-action); color: #06142f; box-shadow: 0 0 18px var(--glow); }
@keyframes drop { from { opacity: 0; transform: translateY(-10px); } }
@media (max-width: 980px) {
  .grid { grid-template-columns: 1fr 1fr; }
  .title { grid-column: 1 / -1; padding-right: 56px; }
  .close { position: absolute; top: 14px; right: var(--page-gutter); }
  .soon { grid-column: 1 / -1; }
}
@media (max-width: 520px) { .grid { grid-template-columns: minmax(0, 1fr); } }
</style>
