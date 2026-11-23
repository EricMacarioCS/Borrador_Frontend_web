<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { LayoutGrid, List, MapPin, SlidersHorizontal, X } from '@lucide/vue'
import DateStrip from './DateStrip.vue'
import ShowtimeGroups from './ShowtimeGroups.vue'
import { CATEGORIES, DAYPARTS, FILTER_GROUPS, facetOptions, matchesCategory, matchesFilters, useQueryList, useQueryParam, type FilterGroup, type ScreeningFilters } from './filters'
import { useScheduleDays } from './dates'
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
const view = useQueryParam('vista', 'lista')
const lists: Record<FilterGroup, ReturnType<typeof useQueryList>> = {
  roomTypes: useQueryList('sala'),
  projections: useQueryList('proyeccion'),
  languages: useQueryList('idioma'),
  dayparts: useQueryList('horario')
}
const showFilters = ref(false)

const movies = useMovies(() => app.selectedComplexIds)
const screenings = useScreenings(() => app.selectedComplexIds, date)

const comingSoon = computed(() => category.value === 'coming-soon')
const needsComplex = computed(() => !comingSoon.value && !app.selectedComplexIds.length)
const filters = computed<ScreeningFilters>(() => ({
  roomTypes: lists.roomTypes.value, projections: lists.projections.value, languages: lists.languages.value, dayparts: lists.dayparts.value
}))
const activeCount = computed(() => FILTER_GROUPS.reduce((sum, group) => sum + filters.value[group.key].length, 0))

const categoryMovies = computed(() => (movies.data.value ?? []).filter(movie => matchesCategory(movie, category.value)))
/** Funciones del día de las películas de la categoría: sobre ellas se cuentan las opciones de filtro. */
const daily = computed(() => {
  const ids = new Set(categoryMovies.value.map(movie => movie.id))
  return (screenings.data.value ?? []).filter(item => ids.has(item.movieId))
})

const rows = computed(() => {
  if (comingSoon.value) return categoryMovies.value.map(movie => ({ movie, screenings: [] as Screening[] }))
  return categoryMovies.value
    .map(movie => ({ movie, screenings: daily.value.filter(item => item.movieId === movie.id && matchesFilters(item, filters.value, timeZone.value)) }))
    .filter(row => row.screenings.length > 0)
})

const formatName = (code: string) => app.allFormats.find(format => format.code === code)?.name ?? code
const facets = computed(() => Object.fromEntries(FILTER_GROUPS.map(group => [group.key, facetOptions(daily.value, filters.value, group.key, timeZone.value, formatName)])) as Record<FilterGroup, ReturnType<typeof facetOptions>>)

const activeChips = computed(() => FILTER_GROUPS.flatMap(group => filters.value[group.key].map(value => ({
  group: group.key,
  value,
  label: group.key === 'dayparts' ? DAYPARTS.find(part => part.value === value)?.label ?? value : facets.value[group.key].find(option => option.value === value)?.label ?? formatName(value)
}))))

function toggle(group: FilterGroup, value: string, checked: boolean) {
  const current = lists[group].value
  lists[group].value = checked ? [...current, value] : current.filter(item => item !== value)
}
function clearFilters() {
  void router.replace({ query: { fecha: date.value === today.value ? undefined : date.value, categoria: category.value === 'todas' ? undefined : category.value, vista: view.value === 'lista' ? undefined : view.value } })
}
function pick(screening: Screening) {
  void router.push(`/compra/${screening.id}`)
}
const loading = computed(() => movies.isPending.value || (!comingSoon.value && screenings.isPending.value))
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
    <p v-if="app.selectedComplexes.length" class="page-lead where"><MapPin :size="16" aria-hidden="true" /> {{ app.selectedComplexes.map(complex => complex.name).join(' · ') }}</p>

    <div class="layout" :class="{ 'with-filters': !comingSoon && !needsComplex }">
      <aside v-if="!comingSoon && !needsComplex" id="filtros" class="sidebar" :class="{ open: showFilters }" aria-label="Filtros">
        <div class="card filters">
          <div class="filters-head">
            <h2><SlidersHorizontal :size="18" aria-hidden="true" /> Filtros</h2>
            <button v-if="activeCount" type="button" class="btn btn-ghost btn-small" @click="clearFilters">Quitar todos</button>
          </div>
          <p class="filters-help">Marca varias opciones a la vez.</p>
          <fieldset v-for="group in FILTER_GROUPS" :key="group.key" class="group">
            <legend>{{ group.title }}</legend>
            <label v-for="option in facets[group.key]" :key="option.value" class="check"
              :class="{ checked: filters[group.key].includes(option.value), off: !option.count && !filters[group.key].includes(option.value) }">
              <input type="checkbox" :checked="filters[group.key].includes(option.value)" :disabled="!option.count && !filters[group.key].includes(option.value)"
                @change="toggle(group.key, option.value, ($event.target as HTMLInputElement).checked)" />
              <span class="text">{{ option.label }}<small v-if="option.hint">{{ option.hint }}</small></span>
              <span class="count" :aria-label="`${option.count} funciones`">{{ option.count }}</span>
            </label>
            <p v-if="!facets[group.key].length" class="muted none">Sin opciones este día.</p>
          </fieldset>
        </div>
      </aside>

      <div class="main">
        <div class="tools card">
          <DateStrip v-if="!comingSoon && !needsComplex" v-model="date" :days="days" :today="today" />
          <div class="chip-row" role="group" aria-label="Categoría">
            <button v-for="item in CATEGORIES" :key="item.value" type="button" class="chip" :aria-pressed="category === item.value" @click="category = item.value">
              {{ item.label }}
            </button>
          </div>
          <div v-if="!comingSoon && !needsComplex" class="bottom">
            <button type="button" class="btn btn-small btn-secondary filters-toggle" :aria-expanded="showFilters" aria-controls="filtros" @click="showFilters = !showFilters">
              <SlidersHorizontal :size="16" /> Filtros<span v-if="activeCount"> ({{ activeCount }})</span>
            </button>
            <span class="muted">{{ formatDate(date) }} · {{ rows.length }} {{ rows.length === 1 ? 'película' : 'películas' }}</span>
            <div class="view-toggle" role="group" aria-label="Vista">
              <button type="button" :aria-pressed="view === 'lista'" aria-label="Vista de lista" @click="view = 'lista'"><List :size="18" /></button>
              <button type="button" :aria-pressed="view === 'cuadricula'" aria-label="Vista de cuadrícula" @click="view = 'cuadricula'"><LayoutGrid :size="18" /></button>
            </div>
          </div>
          <ul v-if="activeChips.length && !needsComplex" class="active" role="list" aria-label="Filtros aplicados">
            <li v-for="chip in activeChips" :key="`${chip.group}-${chip.value}`">
              <button type="button" class="active-chip" :aria-label="`Quitar filtro ${chip.label}`" @click="toggle(chip.group, chip.value, false)">{{ chip.label }} <X :size="14" /></button>
            </li>
          </ul>
        </div>

        <div v-if="needsComplex" class="card choose">
          <MapPin :size="32" aria-hidden="true" />
          <h2>Elige tus cines para ver los horarios</h2>
          <p class="muted">Puedes elegir uno o varios cines de una misma ciudad.</p>
          <button type="button" class="btn btn-primary" @click="app.askForComplexes()">Elegir cines</button>
        </div>
        <StateView v-else :loading="loading" :error="error" :empty="!rows.length" skeleton="rows"
          :empty-title="activeCount ? 'Ninguna función cumple estos filtros' : 'No hay funciones con estos criterios'"
          :empty-text="activeCount ? 'Desmarca algún filtro o prueba con otra fecha.' : 'Prueba con otra fecha, otra categoría u otros cines.'" @retry="retry">
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
    </div>
  </div>
</template>

<style scoped>
.where { display: flex; align-items: center; gap: 6px; }
.layout { margin-top: 22px; display: grid; grid-template-columns: minmax(0, 1fr); gap: 24px; align-items: start; }
.layout.with-filters { grid-template-columns: 290px minmax(0, 1fr); }
.sidebar { position: sticky; top: calc(var(--header-height) + 16px); max-height: calc(100dvh - var(--header-height) - 32px); overflow-y: auto; border-radius: var(--radius-l); scrollbar-width: thin; }
.filters { padding: 18px; display: grid; gap: 6px; }
.filters-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.filters-head h2 { display: flex; align-items: center; gap: 8px; font: 800 18px var(--font-title); }
.filters-head h2 svg { color: var(--blue); }
.filters-help { color: var(--muted); font-size: 13px; }
.group { margin: 10px 0 0; padding: 12px 0 0; border: 0; border-top: 1px solid var(--line); }
.group legend { padding: 12px 0 6px; color: var(--blue); font: 700 12px var(--font-title); letter-spacing: .1em; text-transform: uppercase; }
.check { min-height: 40px; padding: 6px 8px; display: flex; align-items: center; gap: 10px; border-radius: 10px; cursor: pointer; transition: background .2s; }
.check:hover:not(.off) { background: var(--surface-soft); }
.check.checked { background: var(--accent-soft); }
.check.off { opacity: .45; cursor: not-allowed; }
.check input { flex: none; width: 18px; height: 18px; accent-color: var(--blue); }
.check .text { flex: 1; min-width: 0; display: grid; font-weight: 600; font-size: 14px; }
.check small { color: var(--muted); font-size: 12px; font-weight: 400; }
.count { min-width: 28px; padding: 1px 7px; border-radius: 999px; background: var(--surface-soft); color: var(--muted); font: 700 12px var(--font-title); text-align: center; }
.check.checked .count { background: var(--grad-blue); color: #fff; }
.none { padding: 4px 8px; font-size: 13px; }

.tools { margin-bottom: 22px; padding: 16px; display: grid; grid-template-columns: minmax(0, 1fr); gap: 14px; }
.bottom { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
.filters-toggle { display: none; }
.view-toggle { margin-left: auto; display: flex; gap: 4px; }
.view-toggle button { width: 40px; height: 40px; display: grid; place-items: center; border: 1px solid var(--line); border-radius: 10px; background: #fff; color: var(--blue); }
.view-toggle button[aria-pressed='true'] { background: var(--grad-blue); color: #fff; border-color: transparent; }
.active { display: flex; flex-wrap: wrap; gap: 8px; }
.active-chip { min-height: 32px; padding: 0 10px 0 12px; display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--blue); border-radius: 999px; background: var(--accent-soft); color: var(--blue); font: 700 13px var(--font-title); }
.active-chip:hover { background: var(--grad-blue); color: #fff; box-shadow: 0 0 14px rgba(56, 189, 248, .35); }
.choose { padding: 40px 24px; display: grid; justify-items: center; gap: 10px; text-align: center; }
.choose svg { color: var(--blue); }
.choose h2 { font: 800 22px var(--font-title); }

.movies { display: grid; gap: 18px; }
/* En pantallas anchas las películas van en dos columnas para aprovechar el espacio. */
.movies.lista { grid-template-columns: repeat(auto-fill, minmax(min(100%, 600px), 1fr)); align-items: start; }
.movies.cuadricula { grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); }
.movie { padding: 18px; display: grid; grid-template-columns: 140px minmax(0, 1fr); gap: 20px; transition: box-shadow .3s, transform .3s var(--ease); }
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
.synopsis { color: var(--muted); font-size: 15px; display: -webkit-box; -webkit-line-clamp: 3; line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.info :deep(.showtimes) { width: 100%; }

@media (max-width: 1100px) {
  .layout.with-filters { grid-template-columns: minmax(0, 1fr); gap: 18px; }
  /* Los filtros se despliegan entre las herramientas y los resultados. */
  .main { display: contents; }
  .tools { order: 1; margin-bottom: 0; }
  .sidebar { order: 2; }
  .main > :not(.tools) { order: 3; }
  .sidebar { display: none; position: static; max-height: none; overflow: visible; }
  .sidebar.open { display: block; }
  .filters { grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); column-gap: 20px; }
  .filters-head, .filters-help { grid-column: 1 / -1; }
  .group { margin-top: 0; }
  .filters-toggle { display: inline-flex; }
}
@media (max-width: 640px) {
  .movie { grid-template-columns: 96px minmax(0, 1fr); gap: 14px; padding: 14px; }
  .synopsis { display: none; }
  .view-toggle { margin-left: 0; }
}
</style>
