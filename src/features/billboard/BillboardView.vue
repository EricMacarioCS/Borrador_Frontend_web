<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { LayoutGrid, List, SlidersHorizontal } from '@lucide/vue'
import DateStrip from './DateStrip.vue'
import ShowtimeGroups from './ShowtimeGroups.vue'
import { CATEGORIES, matchesCategory, matchesFilters, optionsFrom, useQueryParam } from './filters'
import { useScheduleDays } from './dates'
import BaseSelect from '@/shared/ui/BaseSelect.vue'
import PosterArt from '@/shared/ui/PosterArt.vue'
import StateView from '@/shared/ui/StateView.vue'
import { useMovies, useScreenings } from '@/app/queries'
import { useAppStore } from '@/app/stores/app'
import { STAGE_LABELS, durationLabel } from '@/domain/labels'
import { formatDate } from '@/shared/lib/datetime'
import type { Screening } from '@/domain/models'

const app = useAppStore()
const router = useRouter()
const { today, days, timeZone } = useScheduleDays()

const date = useQueryParam('fecha', today.value)
const category = useQueryParam('categoria', 'todas')
const roomType = useQueryParam('sala', 'all')
const projection = useQueryParam('proyeccion', 'all')
const language = useQueryParam('idioma', 'all')
const fromHour = useQueryParam('desde', 'all')
const view = useQueryParam('vista', 'lista')
const showFilters = ref(false)

const movies = useMovies(() => app.selectedComplexIds)
const screenings = useScreenings(() => app.selectedComplexIds, date)

const daily = computed(() => screenings.data.value ?? [])
const filters = computed(() => ({ roomType: roomType.value, projection: projection.value, language: language.value, fromHour: fromHour.value }))
const activeFilters = computed(() => Object.values(filters.value).filter(value => value !== 'all').length)

const rows = computed(() => {
  const list = (movies.data.value ?? []).filter(movie => matchesCategory(movie, category.value))
  if (category.value === 'coming-soon') return list.map(movie => ({ movie, screenings: [] as Screening[] }))
  return list
    .map(movie => ({ movie, screenings: daily.value.filter(item => item.movieId === movie.id && matchesFilters(item, filters.value, timeZone.value)) }))
    .filter(row => row.screenings.length > 0)
})

const roomOptions = computed(() => optionsFrom(daily.value, item => item.room.type))
const projectionOptions = computed(() => optionsFrom(daily.value, item => item.projection))
const languageOptions = computed(() => optionsFrom(daily.value, item => item.language))
const hourOptions = [{ value: 'all', label: 'Cualquier hora' }, ...['12:00', '15:00', '18:00', '20:00'].map(value => ({ value, label: `Desde las ${value}` }))]

function clearFilters() {
  void router.replace({ query: { fecha: date.value === today.value ? undefined : date.value, categoria: category.value === 'todas' ? undefined : category.value } })
}
function pick(screening: Screening) {
  void router.push(`/compra/${screening.id}`)
}
const loading = computed(() => movies.isPending.value || (category.value !== 'coming-soon' && screenings.isPending.value))
const error = computed(() => movies.error.value ?? screenings.error.value)
function retry() {
  void movies.refetch()
  void screenings.refetch()
}
</script>

<template>
  <div class="container page">
    <p class="eyebrow">Cartelera</p>
    <h1 class="page-title">Elige tu función</h1>
    <p class="page-lead">{{ app.selectedComplexes.map(complex => complex.name).join(' · ') }}</p>

    <div class="tools card">
      <DateStrip v-if="category !== 'coming-soon'" v-model="date" :days="days" :today="today" />
      <div class="chip-row categories" role="group" aria-label="Categoría">
        <button v-for="item in CATEGORIES" :key="item.value" type="button" class="chip" :aria-pressed="category === item.value" @click="category = item.value">
          {{ item.label }}
        </button>
      </div>
      <div v-if="category !== 'coming-soon'" class="bottom">
        <button type="button" class="btn btn-small btn-secondary" :aria-expanded="showFilters" aria-controls="filtros" @click="showFilters = !showFilters">
          <SlidersHorizontal :size="16" /> Filtros<span v-if="activeFilters"> ({{ activeFilters }})</span>
        </button>
        <span class="muted">{{ formatDate(date) }} · {{ rows.length }} {{ rows.length === 1 ? 'película' : 'películas' }}</span>
        <div class="view-toggle" role="group" aria-label="Vista">
          <button type="button" :aria-pressed="view === 'lista'" aria-label="Vista de lista" @click="view = 'lista'"><List :size="18" /></button>
          <button type="button" :aria-pressed="view === 'cuadricula'" aria-label="Vista de cuadrícula" @click="view = 'cuadricula'"><LayoutGrid :size="18" /></button>
        </div>
      </div>
      <div v-if="showFilters && category !== 'coming-soon'" id="filtros" class="filters">
        <BaseSelect v-model="roomType" label="Tipo de sala" :options="roomOptions" compact />
        <BaseSelect v-model="projection" label="Proyección" :options="projectionOptions" compact />
        <BaseSelect v-model="language" label="Idioma" :options="languageOptions" compact />
        <BaseSelect v-model="fromHour" label="Horario" :options="hourOptions" compact />
        <button v-if="activeFilters" type="button" class="btn btn-small btn-ghost" @click="clearFilters">Quitar filtros</button>
      </div>
    </div>

    <StateView :loading="loading" :error="error" :empty="!rows.length" skeleton="rows"
      empty-title="No hay funciones con estos criterios" empty-text="Prueba con otra fecha, otra categoría u otros cines." @retry="retry">
      <ul class="movies" :class="view" role="list">
        <li v-for="{ movie, screenings: items } in rows" :key="movie.id" class="movie card">
          <RouterLink :to="`/peliculas/${movie.slug}`" class="poster-link" :aria-label="`Ver ${movie.title}`">
            <PosterArt :title="movie.title" :accent="movie.accent" :rating="movie.rating.code" :src="movie.posterUrl" decorative />
          </RouterLink>
          <div class="info">
            <span class="badge">{{ movie.isSpecialEvent ? 'Evento especial' : STAGE_LABELS[movie.stage] }}</span>
            <h2><RouterLink :to="`/peliculas/${movie.slug}`">{{ movie.title }}</RouterLink></h2>
            <p class="meta">
              <span class="badge badge-rating">{{ movie.rating.code }}</span>
              {{ movie.genres.join(', ') }} · {{ durationLabel(movie.durationMinutes) }}
            </p>
            <p v-if="view === 'lista'" class="synopsis">{{ movie.synopsis }}</p>
            <p v-if="!items.length" class="notice">Estreno el {{ formatDate(movie.releaseDate) }}. La venta aún no inicia.</p>
            <ShowtimeGroups v-else-if="view === 'lista'" :screenings="items" :show-legend="false" @pick="pick" />
            <RouterLink v-else :to="`/peliculas/${movie.slug}?fecha=${date}`" class="btn btn-small btn-secondary">{{ items.length }} horarios</RouterLink>
          </div>
        </li>
      </ul>
    </StateView>
  </div>
</template>

<style scoped>
.tools { margin: 22px 0 26px; padding: 16px; display: grid; gap: 14px; }
.bottom { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
.view-toggle { margin-left: auto; display: flex; gap: 4px; }
.view-toggle button { width: 40px; height: 40px; display: grid; place-items: center; border: 1px solid var(--line); border-radius: 10px; background: #fff; color: var(--blue); }
.view-toggle button[aria-pressed='true'] { background: var(--grad-blue); color: #fff; border-color: transparent; }
.filters { padding: 14px; display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); align-items: end; gap: 12px; border-radius: var(--radius-m); background: var(--surface-soft); }
.movies { display: grid; gap: 18px; }
.movies.cuadricula { grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); }
.movie { padding: 18px; display: grid; grid-template-columns: 150px 1fr; gap: 22px; transition: box-shadow .3s, transform .3s var(--ease); }
.movie:hover { box-shadow: 0 16px 40px rgba(11, 21, 48, .14); }
.cuadricula .movie { grid-template-columns: minmax(0, 1fr); padding: 0; overflow: hidden; }
.cuadricula .movie:hover { transform: translateY(-4px); }
.cuadricula .info { padding: 0 16px 16px; }
.cuadricula :deep(.art) { border-radius: 0; }
.poster-link { display: block; border-radius: 10px; }
.info { min-width: 0; display: grid; align-content: start; gap: 8px; justify-items: start; }
.info h2 { font: 800 22px var(--font-title); }
.info h2 a { text-decoration: none; }
.info h2 a:hover { color: var(--blue); }
.meta { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; color: var(--muted); font-size: 14px; }
.synopsis { color: var(--muted); font-size: 15px; max-width: 75ch; }
.info :deep(.showtimes) { width: 100%; }
@media (max-width: 640px) {
  .movie { grid-template-columns: 96px 1fr; gap: 14px; padding: 14px; }
  .synopsis { display: none; }
  .view-toggle { margin-left: 0; }
}
</style>
