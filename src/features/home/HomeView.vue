<script setup lang="ts">
import { computed } from 'vue'
import { ArrowRight, Sparkles } from '@lucide/vue'
import HeroCarousel from './HeroCarousel.vue'
import PosterArt from '@/shared/ui/PosterArt.vue'
import StateView from '@/shared/ui/StateView.vue'
import { useHome, useMovies } from '@/app/queries'
import { useAppStore } from '@/app/stores/app'
import { STAGE_LABELS } from '@/domain/labels'
import { formatDate } from '@/shared/lib/datetime'

const app = useAppStore()
const home = useHome()
const movies = useMovies(() => app.selectedComplexIds)

const featured = computed(() => {
  const ids = home.data.value?.featuredMovieIds ?? []
  return ids.map(id => movies.data.value?.find(movie => movie.id === id)).filter(movie => movie !== undefined)
})
const showing = computed(() => (movies.data.value ?? []).filter(movie => !movie.isSpecialEvent && movie.stage !== 'coming-soon'))
const upcoming = computed(() => (movies.data.value ?? []).filter(movie => movie.stage === 'coming-soon' || movie.isSpecialEvent))

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
          <h2 id="cartelera">En cartelera</h2>
          <RouterLink to="/cartelera" class="btn btn-small btn-secondary">Ver horarios <ArrowRight :size="16" /></RouterLink>
        </div>
        <ul class="posters" role="list">
          <li v-for="movie in showing" :key="movie.id">
            <RouterLink :to="`/peliculas/${movie.slug}`" class="poster-card">
              <PosterArt :title="movie.title" :accent="movie.accent" :rating="movie.rating.code" :src="movie.posterUrl" decorative />
              <span class="poster-title">{{ movie.title }}</span>
              <span class="poster-meta">{{ STAGE_LABELS[movie.stage] }} · {{ movie.genres[0] }}</span>
            </RouterLink>
          </li>
        </ul>
      </section>

      <section v-if="upcoming.length" class="section" aria-labelledby="proximamente">
        <div class="section-head"><h2 id="proximamente">Próximamente y eventos</h2></div>
        <ul class="posters small" role="list">
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

      <section class="section" aria-labelledby="experiencias">
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
.posters { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(170px, 210px); gap: 18px; overflow-x: auto; padding: 6px 4px 14px; scroll-snap-type: x mandatory; scrollbar-width: thin; }
.posters.small { grid-auto-columns: minmax(140px, 170px); }
.posters li { scroll-snap-align: start; }
.poster-card { display: grid; gap: 8px; text-decoration: none; border-radius: 12px; }
.poster-card :deep(.art) { transition: transform .3s var(--ease), box-shadow .3s; }
.poster-card:hover :deep(.art) { transform: translateY(-6px); box-shadow: 0 18px 34px rgba(11, 21, 48, .3), 0 0 26px color-mix(in srgb, var(--accent) 40%, transparent); }
.poster-title { font: 700 15px var(--font-title); }
.poster-meta { color: var(--muted); font-size: 13px; }
.highlights { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 18px; }
.highlight { padding: 26px; display: grid; gap: 10px; justify-items: start; border-radius: var(--radius-l); color: #fff; box-shadow: var(--shadow-card); }
.highlight h2 { font: 800 22px var(--font-title); }
.highlight p { color: #e2ebf9; }
.highlight.blue { background: radial-gradient(80% 120% at 100% 0%, rgba(56, 189, 248, .4), transparent 60%), var(--grad-blue); }
.highlight.violet { background: radial-gradient(80% 120% at 100% 0%, rgba(255, 77, 216, .35), transparent 60%), linear-gradient(120deg, #3b1f8f, #7c5cff); }
.highlight.cyan { background: radial-gradient(80% 120% at 0% 100%, rgba(124, 92, 255, .45), transparent 60%), linear-gradient(120deg, #0b6c8f, #0e9fd6); }
.inline-icon { display: inline; vertical-align: -3px; color: var(--violet); }
.experiences { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; }
.experience { padding: 20px; display: grid; gap: 6px; border: 1px solid var(--line); border-radius: var(--radius-l); background: linear-gradient(160deg, #fff, #eef5ff); transition: box-shadow .3s, transform .3s var(--ease); }
.experience:hover { transform: translateY(-3px); box-shadow: 0 0 0 1px var(--accent), 0 12px 30px rgba(56, 189, 248, .25); }
.experience strong { color: var(--blue); font: 800 20px var(--font-title); }
.experience span { color: var(--muted); font-size: 14px; }
</style>
