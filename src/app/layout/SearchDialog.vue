<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Search } from '@lucide/vue'
import BaseDialog from '@/shared/ui/BaseDialog.vue'
import PosterArt from '@/shared/ui/PosterArt.vue'
import { useMovies } from '@/app/queries'
import { useAppStore } from '@/app/stores/app'
import { normalizeText } from '@/shared/lib/text'
import { STAGE_LABELS } from '@/domain/labels'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()
const app = useAppStore()
const router = useRouter()
const term = ref('')
const movies = useMovies(() => app.selectedComplexIds)

const results = computed(() => {
  const query = normalizeText(term.value)
  if (query.length < 2) return []
  return (movies.data.value ?? [])
    .filter(movie => normalizeText(`${movie.title} ${movie.genres.join(' ')} ${movie.cast.map(person => person.name).join(' ')}`).includes(query))
    .slice(0, 8)
})

watch(() => props.open, open => { if (open) term.value = '' })

function go(slug: string) {
  emit('close')
  void router.push(`/peliculas/${slug}`)
}
</script>

<template>
  <BaseDialog :open="open" label="Buscar películas" @close="emit('close')">
    <template #header><h2>Buscar</h2></template>
    <label class="search">
      <Search :size="20" aria-hidden="true" />
      <span class="visually-hidden">Título, género o reparto</span>
      <input v-model="term" type="search" placeholder="Título, género o reparto" autocomplete="off" autofocus />
    </label>
    <p v-if="term.length >= 2" class="visually-hidden" role="status">{{ results.length }} resultados</p>
    <ul v-if="results.length" class="results" role="list">
      <li v-for="movie in results" :key="movie.id">
        <button type="button" @click="go(movie.slug)">
          <PosterArt :title="movie.title" :accent="movie.accent" :src="movie.posterUrl" decorative />
          <span>
            <strong>{{ movie.title }}</strong>
            <small>{{ movie.rating.code }} · {{ movie.genres.join(', ') }} · {{ STAGE_LABELS[movie.stage] }}</small>
          </span>
        </button>
      </li>
    </ul>
    <p v-else-if="term.length >= 2" class="muted empty">No encontramos películas con «{{ term }}».</p>
    <p v-else class="muted empty">Escribe al menos dos letras.</p>
  </BaseDialog>
</template>

<style scoped>
.search { display: flex; align-items: center; gap: 10px; padding: 0 14px; border: 1px solid var(--line-strong); border-radius: var(--radius-m); }
.search:focus-within { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(56, 189, 248, .25); }
.search svg { color: var(--blue); }
.search input { flex: 1; min-height: 52px; border: 0; background: transparent; font-size: 17px; }
.search input:focus { outline: none; }
.results { margin-top: 14px; display: grid; gap: 6px; }
.results button {
  width: 100%;
  padding: 8px;
  display: flex;
  align-items: center;
  gap: 14px;
  border: 0;
  border-radius: 12px;
  background: transparent;
  text-align: left;
}
.results button:hover { background: var(--accent-soft); }
.results :deep(.art) { width: 52px; flex-shrink: 0; }
.results span { display: grid; }
.results small { color: var(--muted); }
.empty { margin-top: 16px; }
</style>
