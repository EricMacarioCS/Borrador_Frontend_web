<script setup lang="ts">
/**
 * Portada con cartel pequeño y fondo animado del color de la película.
 * Sin imágenes ni video: cuando existan, el fondo usará `backdropUrl` y el tráiler un video propio.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ChevronLeft, ChevronRight, Pause, Play, Ticket } from '@lucide/vue'
import PosterArt from '@/shared/ui/PosterArt.vue'
import QuickBuy from './QuickBuy.vue'
import { STAGE_LABELS, durationLabel } from '@/domain/labels'
import type { Movie } from '@/domain/models'

const props = defineProps<{ movies: Movie[] }>()
const index = ref(0)
const buying = ref(false)
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const paused = ref(reducedMotion)
let timer = 0

const movie = computed(() => props.movies[index.value] ?? props.movies[0])

function go(step: number) {
  index.value = (index.value + step + props.movies.length) % props.movies.length
}
function restart() {
  clearInterval(timer)
  if (!paused.value && !buying.value && props.movies.length > 1) timer = window.setInterval(() => go(1), 8000)
}
watch([paused, buying], restart)
watch(index, () => { buying.value = false })
onMounted(restart)
onBeforeUnmount(() => clearInterval(timer))
</script>

<template>
  <section v-if="movie" class="hero" :style="{ '--hero-accent': movie.accent }" aria-roledescription="carrusel" aria-label="Destacados">
    <div class="backdrop" aria-hidden="true">
      <span class="orb a" /><span class="orb b" /><span class="orb c" />
    </div>
    <div class="shade" aria-hidden="true" />
    <div :key="movie.id" class="content container" aria-roledescription="diapositiva" :aria-label="`${index + 1} de ${movies.length}`">
      <PosterArt class="poster" :title="movie.title" :accent="movie.accent" :rating="movie.rating.code" :src="movie.posterUrl" decorative />
      <div class="copy">
        <p class="kicker"><b>{{ movie.isSpecialEvent ? 'Evento especial' : STAGE_LABELS[movie.stage] }}</b></p>
        <h1>{{ movie.title }}</h1>
        <p class="meta">
          <span class="tag">{{ movie.rating.code }}</span>
          {{ movie.genres.join(', ') }} · {{ durationLabel(movie.durationMinutes) }}
        </p>
        <p class="synopsis">{{ movie.synopsis }}</p>
        <div class="actions">
          <button type="button" class="buy" :aria-expanded="buying" @click="buying = !buying"><Ticket :size="18" /> Comprar boletos</button>
          <RouterLink :to="`/peliculas/${movie.slug}`" class="btn btn-dark">Ver detalles</RouterLink>
        </div>
      </div>
    </div>
    <template v-if="movies.length > 1">
      <button type="button" class="arrow previous" aria-label="Destacado anterior" @click="go(-1)"><ChevronLeft :size="34" /></button>
      <button type="button" class="arrow next" aria-label="Destacado siguiente" @click="go(1)"><ChevronRight :size="34" /></button>
      <div class="dots" role="group" aria-label="Elegir destacado">
        <button v-for="(item, i) in movies" :key="item.id" type="button" :aria-pressed="i === index" :aria-label="item.title" @click="index = i" />
      </div>
      <button type="button" class="pause" :aria-label="paused ? 'Reanudar carrusel' : 'Pausar carrusel'" @click="paused = !paused">
        <Play v-if="paused" :size="16" /><Pause v-else :size="16" />
      </button>
    </template>
  </section>
  <QuickBuy v-if="buying && movie" :key="movie.id" :movie="movie" @close="buying = false" />
</template>

<style scoped>
.hero { position: relative; height: clamp(440px, 38vw, 600px); overflow: hidden; isolation: isolate; background: #03060f; color: #fff; }
.backdrop { position: absolute; inset: 0; z-index: -2; background: radial-gradient(80% 90% at 70% 40%, color-mix(in srgb, var(--hero-accent) 30%, transparent), transparent 70%), #060b1a; transition: background .8s; }
.orb { position: absolute; border-radius: 50%; filter: blur(60px); opacity: .55; animation: drift 18s ease-in-out infinite alternate; }
.orb.a { width: 46vw; height: 46vw; top: -12vw; right: -4vw; background: var(--hero-accent); }
.orb.b { width: 30vw; height: 30vw; bottom: -14vw; right: 26vw; background: #3b2cff; animation-duration: 22s; }
.orb.c { width: 22vw; height: 22vw; top: 18%; right: 40%; background: color-mix(in srgb, var(--hero-accent) 60%, #ff4dd8); animation-duration: 26s; opacity: .35; }
@keyframes drift { to { transform: translate(-6vw, 4vw) scale(1.15); } }
.shade { position: absolute; inset: 0; z-index: -1; background: linear-gradient(90deg, rgba(2, 5, 14, .92) 0%, rgba(2, 5, 14, .55) 40%, rgba(2, 5, 14, .1) 70%, rgba(2, 5, 14, .5) 100%), linear-gradient(0deg, rgba(2, 5, 14, .85) 0%, transparent 34%); }
.content { position: absolute; inset: 0; display: flex; align-items: center; gap: 34px; padding-block: 40px 60px; }
.poster { width: clamp(140px, 13vw, 220px); flex-shrink: 0; box-shadow: 0 22px 50px rgba(0, 0, 0, .6), 0 0 34px color-mix(in srgb, var(--hero-accent) 40%, transparent); animation: enter-poster .7s var(--ease) backwards; }
.copy { max-width: 640px; animation: enter-copy .7s .12s var(--ease) backwards; }
.kicker { font: 600 14px var(--font-title); letter-spacing: .08em; text-transform: uppercase; }
.kicker b { color: var(--gold); text-shadow: 0 0 12px rgba(255, 201, 60, .8); }
h1 { margin: 14px 0 10px; color: var(--hero-accent); font: 800 clamp(30px, 4vw, 56px)/1.04 var(--font-title); text-transform: uppercase; text-shadow: 0 0 28px color-mix(in srgb, var(--hero-accent) 45%, transparent); }
.meta { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; color: #d7e2f2; font-size: 14px; }
.tag { padding: 2px 7px; border: 1px solid currentColor; border-radius: 5px; font-weight: 700; }
.synopsis { margin-top: 12px; color: #e3ebf8; display: -webkit-box; -webkit-line-clamp: 3; line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.actions { margin-top: 24px; display: flex; flex-wrap: wrap; gap: 14px; }
.buy {
  position: relative;
  overflow: hidden;
  min-height: 52px;
  padding: 0 28px;
  display: inline-flex;
  align-items: center;
  gap: 9px;
  border: 0;
  border-radius: var(--radius-m);
  background: linear-gradient(180deg, rgba(255, 255, 255, .34), transparent 50%), linear-gradient(120deg, var(--hero-accent), color-mix(in srgb, var(--hero-accent) 60%, #3b2cff));
  color: #070d1c;
  font: 800 15px var(--font-title);
  transition: filter .3s, box-shadow .3s, scale .15s;
}
.buy:hover { filter: brightness(1.12); box-shadow: 0 0 0 3px color-mix(in srgb, var(--hero-accent) 35%, transparent), 0 0 32px var(--hero-accent); }
.buy:active { scale: .96; }
.arrow { position: absolute; top: 50%; width: 52px; height: 64px; margin-top: -32px; display: grid; place-items: center; border: 0; background: transparent; color: #fff; }
.arrow:hover { color: var(--hero-accent); filter: drop-shadow(0 0 9px var(--hero-accent)); }
.previous { left: 4px; }
.next { right: 4px; }
.dots { position: absolute; bottom: 18px; left: 50%; display: flex; gap: 6px; transform: translateX(-50%); }
.dots button { width: 28px; height: 28px; padding: 8px; border: 0; background: transparent; }
.dots button::before { content: ''; display: block; width: 12px; height: 12px; border: 1.5px solid #fff; border-radius: 50%; }
.dots button[aria-pressed='true']::before { background: #fff; box-shadow: 0 0 12px rgba(255, 255, 255, .9); }
.pause { position: absolute; right: 18px; bottom: 14px; width: 36px; height: 36px; display: grid; place-items: center; border: 1px solid rgba(255, 255, 255, .4); border-radius: 50%; background: rgba(0, 0, 0, .3); color: #fff; }
.pause:hover { border-color: var(--accent); box-shadow: 0 0 16px var(--glow); }
@keyframes enter-poster { from { opacity: 0; transform: translateY(20px) scale(.96); } }
@keyframes enter-copy { from { opacity: 0; transform: translateX(-18px); } }
@media (max-width: 720px) {
  .hero { height: auto; min-height: 520px; }
  .content { position: relative; flex-direction: column; align-items: flex-start; gap: 18px; padding-top: 28px; }
  .poster { width: 120px; }
  .arrow { display: none; }
}
</style>
