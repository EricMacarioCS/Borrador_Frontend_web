<script setup lang="ts">
import { computed } from 'vue'
import { ArrowRight, MapPin, Sparkles } from '@lucide/vue'
import HeroCarousel from './HeroCarousel.vue'
import DateStrip from '@/features/billboard/DateStrip.vue'
import { useScheduleDays } from '@/features/billboard/dates'
import { useQueryParam } from '@/features/billboard/filters'
import PosterArt from '@/shared/ui/PosterArt.vue'
import StateView from '@/shared/ui/StateView.vue'
import { useHome, useMovies, useScreenings } from '@/app/queries'
import { useAppStore } from '@/app/stores/app'
import { STAGE_LABELS } from '@/domain/labels'
import { formatDate } from '@/shared/lib/datetime'

const app = useAppStore()
const home = useHome()
const movies = useMovies(() => app.selectedComplexIds)
const { today, days } = useScheduleDays()
const date = useQueryParam('fecha', today.value)
// Sin cines elegidos se muestra lo que hay en todos los complejos.
const screenings = useScreenings(() => app.browseComplexIds, date)

const featured = computed(() => {
  const ids = home.data.value?.featuredMovieIds ?? []
  return ids.map(id => movies.data.value?.find(movie => movie.id === id)).filter(movie => movie !== undefined)
})

/** Funciones del día por película: cuántas hay y en qué formatos especiales. */
const daily = computed(() => {
  const byMovie = new Map<string, { count: number; formats: Set<string> }>()
  for (const screening of screenings.data.value ?? []) {
    if (screening.status === 'closed' || screening.status === 'cancelled') continue
    const entry = byMovie.get(screening.movieId) ?? { count: 0, formats: new Set<string>() }
    entry.count++
    if (screening.room.type.code !== 'traditional') entry.formats.add(screening.room.type.name)
    if (screening.projection.code !== '2d') entry.formats.add(screening.projection.name)
    byMovie.set(screening.movieId, entry)
  }
  return byMovie
})
const showing = computed(() => (movies.data.value ?? [])
  .filter(movie => daily.value.has(movie.id))
  .map(movie => ({ movie, ...daily.value.get(movie.id)! })))
// Preventas y eventos sin funciones ese día siguen visibles aquí.
const upcoming = computed(() => (movies.data.value ?? []).filter(movie =>
  movie.stage === 'coming-soon' || ((movie.isSpecialEvent || movie.stage === 'presale') && !daily.value.has(movie.id))))

const where = computed(() => {
  const names = app.selectedComplexes.map(complex => complex.name)
  if (!names.length) return null
  return names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} y ${names.at(-1)}`
})
const dateQuery = computed(() => date.value === today.value ? '' : `?fecha=${date.value}`)

const EXPERIENCES = [
  { name: 'IMAX', text: 'Pantalla gigante y sonido de alta precisión.' },
  { name: 'Macro XE', text: 'Pantalla de pared a pared con audio envolvente.' },
  { name: '4DX', text: 'Movimiento, viento y efectos sincronizados con la película.' },
  { name: 'VIP', text: 'Butacas reclinables y servicio a tu lugar.' },
  { name: 'Junior', text: 'Salas pensadas para los más pequeños.' }
]
</script>

<template>
  <div>
    <StateView :loading="home.isPending.value || movies.isPending.value" :error="home.error.value ?? movies.error.value" skeleton="block"
      class="hero-state" @retry="() => { home.refetch(); movies.refetch() }">
      <HeroCarousel v-if="featured.length" :movies="featured" />
    </StateView>

    <div class="container">
      <section class="section" aria-labelledby="cartelera">
        <div class="section-head">
          <div class="heading">
            <h2 id="cartelera">En cartelera</h2>
            <p v-if="where" class="where"><MapPin :size="15" aria-hidden="true" /> {{ where }}</p>
            <p v-else class="where">En todos nuestros cines. <button type="button" class="link" @click="app.askForComplexes()">Elige tu cine</button> para ver solo lo que tienes cerca.</p>
          </div>
          <RouterLink :to="`/cartelera${dateQuery}`" class="btn btn-small btn-secondary">Ver todos los horarios <ArrowRight :size="16" /></RouterLink>
        </div>
        <div class="card date-card">
          <DateStrip v-model="date" :days="days" :today="today" />
        </div>
        <StateView :loading="screenings.isPending.value || movies.isPending.value" :error="screenings.error.value" :empty="!showing.length" skeleton="cards"
          :empty-title="`No hay funciones el ${formatDate(date)}`" :empty-text="where ? 'Prueba con otra fecha u otros cines.' : 'Prueba con otra fecha.'"
          @retry="screenings.refetch()">
          <ul class="poster-grid" :class="{ refreshing: screenings.isPlaceholderData.value }" role="list">
            <li v-for="item in showing" :key="item.movie.id">
              <RouterLink :to="`/peliculas/${item.movie.slug}${dateQuery}`" class="poster-card">
                <PosterArt :title="item.movie.title" :accent="item.movie.accent" :rating="item.movie.rating.code" :src="item.movie.posterUrl" decorative />
                <span class="poster-title">{{ item.movie.title }}</span>
                <span class="poster-meta">{{ item.movie.isSpecialEvent ? 'Evento especial' : STAGE_LABELS[item.movie.stage] }} · {{ item.movie.genres[0] }}</span>
                <span class="poster-extra">
                  <span class="count">{{ item.count }} {{ item.count === 1 ? 'función' : 'funciones' }}</span>
                  <span v-for="format in [...item.formats].slice(0, 3)" :key="format" class="format">{{ format }}</span>
                </span>
              </RouterLink>
            </li>
          </ul>
        </StateView>
      </section>

      <section v-if="upcoming.length" class="section" aria-labelledby="proximamente">
        <div class="section-head"><h2 id="proximamente">Próximamente y eventos</h2></div>
        <ul class="posters" role="list">
          <li v-for="movie in upcoming" :key="movie.id">
            <RouterLink :to="`/peliculas/${movie.slug}`" class="poster-card">
              <PosterArt :title="movie.title" :accent="movie.accent" :rating="movie.rating.code" :src="movie.posterUrl" decorative />
              <span class="poster-title">{{ movie.title }}</span>
              <span class="poster-meta">{{ movie.stage === 'presale' ? 'Preventa · ' : '' }}{{ formatDate(movie.releaseDate, 'short') }}</span>
            </RouterLink>
          </li>
        </ul>
      </section>

      <section v-if="home.data.value?.highlights.length" class="section highlights" aria-label="Destacados del sitio">
        <article v-for="item in home.data.value.highlights" :key="item.id" class="highlight" :class="item.tone">
          <h2>{{ item.title }}</h2>
          <p>{{ item.text }}</p>
          <RouterLink :to="item.ctaPath" class="btn btn-small btn-dark">{{ item.ctaLabel }}</RouterLink>
        </article>
      </section>

      <section class="section last" aria-labelledby="experiencias">
        <div class="section-head"><h2 id="experiencias"><Sparkles :size="22" aria-hidden="true" class="inline-icon" /> Experiencias</h2></div>
        <ul class="experiences" role="list">
          <li v-for="item in EXPERIENCES" :key="item.name" class="experience">
            <strong>{{ item.name }}</strong>
            <span>{{ item.text }}</span>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>

<style scoped>
.hero-state :deep(.block-skeleton) { height: clamp(440px, 38vw, 600px); border-radius: 0; }
.heading { display: grid; gap: 4px; }
.where { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; color: var(--muted); font-size: 15px; }
.link { padding: 0; border: 0; background: none; color: var(--blue); font-weight: 700; text-decoration: underline; text-underline-offset: 3px; }
.date-card { margin-bottom: 30px; padding: 6px 12px; }
/* La cuadrícula llena el ancho disponible: más columnas en pantallas grandes. */
.poster-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 178px), 1fr)); gap: 36px 24px; transition: opacity .2s; }
.poster-grid.refreshing { opacity: .6; }
.posters { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(140px, 176px); gap: 20px; overflow-x: auto; padding: 6px 4px 14px; scroll-snap-type: x mandatory; scrollbar-width: thin; }
.posters li { scroll-snap-align: start; }
.poster-card { display: grid; gap: 7px; text-decoration: none; border-radius: var(--radius-m); }
.poster-card :deep(.art) { border-radius: var(--radius-m); box-shadow: var(--shadow-card); transition: transform .35s var(--ease), box-shadow .35s; }
.poster-card:hover :deep(.art) { transform: translateY(-6px); box-shadow: 0 18px 34px rgba(11, 21, 48, .3), 0 0 26px color-mix(in srgb, var(--accent) 40%, transparent); }
.poster-title { margin-top: 4px; font: 700 16px var(--font-title); letter-spacing: -.01em; }
.poster-meta { color: var(--muted); font-size: 13px; }
.poster-extra { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; }
.poster-extra .count { margin-right: 2px; color: var(--blue); font: 700 12px var(--font-title); }
.poster-extra .format { padding: 0 7px; border: 1px solid var(--line-strong); border-radius: var(--radius-pill); background: var(--glass); color: var(--muted); font: 700 10px/17px var(--font-title); }
.highlights { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr)); gap: 22px; }
/* El primer destacado pesa más para romper la cuadrícula de tarjetas iguales. */
@media (min-width: 1100px) { .highlights { grid-template-columns: 1.5fr 1fr 1fr; } }
.highlight { --tint: 56, 189, 248; position: relative; min-height: 220px; padding: 32px; display: grid; align-content: end; gap: 12px; justify-items: start; overflow: hidden; isolation: isolate; border: 1px solid rgba(var(--tint), .28); border-radius: var(--radius-l); background: radial-gradient(75% 110% at 100% 0%, rgba(var(--tint), .34), transparent 65%), linear-gradient(150deg, #142a55 0%, #0b1530 75%); color: #fff; box-shadow: var(--shadow-card); transition: transform .35s var(--ease), box-shadow .35s; }
.highlight::after { content: ''; position: absolute; top: -70px; right: -50px; z-index: -1; width: 220px; height: 220px; border: 1px solid rgba(var(--tint), .35); border-radius: 50%; box-shadow: 0 0 0 28px rgba(var(--tint), .06), 0 0 0 62px rgba(var(--tint), .04); }
.highlight:hover { transform: translateY(-3px); box-shadow: 0 24px 48px -22px rgba(var(--tint), .65); }
.highlight h2 { font: 800 clamp(22px, 2vw, 28px) var(--font-title); letter-spacing: -.02em; }
.highlight p { max-width: 46ch; color: #d9e5f7; }
.highlight.violet { --tint: 138, 108, 255; }
.highlight.cyan { --tint: 34, 211, 238; }
.inline-icon { display: inline; vertical-align: -3px; color: var(--violet); }
.experiences { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 18px; }
.experience { position: relative; overflow: hidden; padding: 24px; display: grid; align-content: start; gap: 8px; border: 1px solid var(--line); border-radius: var(--radius-l); background: var(--glass); box-shadow: var(--shadow-soft); backdrop-filter: blur(14px); transition: box-shadow .3s, border-color .3s, transform .3s var(--ease); }
.experience::before { content: ''; width: 34px; height: 4px; margin-bottom: 6px; border-radius: var(--radius-pill); background: var(--grad-action); box-shadow: 0 0 12px rgba(56, 189, 248, .55); transition: width .35s var(--ease); }
.experience:hover { transform: translateY(-3px); border-color: rgba(56, 189, 248, .55); box-shadow: var(--shadow-hover); }
.experience:hover::before { width: 60px; }
.experience strong { color: var(--ink); font: 800 21px var(--font-title); letter-spacing: -.01em; }
.experience span { color: var(--muted); font-size: 14px; }
.last { margin-bottom: 80px; }
@media (max-width: 520px) {
  .poster-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 22px 14px; }
}
</style>
