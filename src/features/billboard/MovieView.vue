<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeft, Clock, Film, MapPin } from '@lucide/vue'
import DateStrip from './DateStrip.vue'
import ShowtimeGroups from './ShowtimeGroups.vue'
import { useQueryParam } from './filters'
import { useScheduleDays } from './dates'
import PosterArt from '@/shared/ui/PosterArt.vue'
import StateView from '@/shared/ui/StateView.vue'
import { useMovie, useScreeningDates, useScreenings } from '@/app/queries'
import { useAppStore } from '@/app/stores/app'
import { STAGE_LABELS, durationLabel } from '@/domain/labels'
import { formatDate } from '@/shared/lib/datetime'
import type { Screening } from '@/domain/models'

const props = defineProps<{ slug: string }>()
const app = useAppStore()
const router = useRouter()
const { today, days } = useScheduleDays()
const movie = useMovie(() => props.slug)
const movieId = computed(() => movie.data.value?.id)
const dates = useScreeningDates(movieId, () => app.selectedComplexIds)
const date = useQueryParam('fecha', today.value)
const screenings = useScreenings(() => app.selectedComplexIds, date, movieId)

// Si el día elegido no tiene funciones, se salta al primero disponible.
watch(() => dates.data.value, available => {
  if (available?.length && !available.includes(date.value)) date.value = available[0]!
}, { immediate: true })

watch(() => movie.data.value?.title, title => { if (title) document.title = `${title} · Cinépolis` })

const directors = computed(() => movie.data.value?.cast.filter(person => person.role === 'director').map(person => person.name) ?? [])
const actors = computed(() => movie.data.value?.cast.filter(person => person.role !== 'director').map(person => person.name) ?? [])
const pick = (screening: Screening) => router.push(`/compra/${screening.id}`)
const hasComplexes = computed(() => app.selectedComplexIds.length > 0)

// Al entrar por un enlace directo sin cine elegido, se pide el cine para mostrar horarios.
onMounted(() => { if (!hasComplexes.value) app.askForComplexes() })
</script>

<template>
  <div class="movie-page">
    <div v-if="!movie.data.value" class="container page">
      <StateView :loading="movie.isPending.value" :error="movie.error.value" skeleton="block" @retry="movie.refetch()" />
    </div>
    <template v-else>
      <section class="hero" :style="{ '--accent-movie': movie.data.value.accent }">
        <div class="container hero-inner">
          <button type="button" class="back" @click="router.back()"><ArrowLeft :size="18" /> Volver</button>
          <div class="hero-grid">
            <PosterArt :title="movie.data.value.title" :accent="movie.data.value.accent" :rating="movie.data.value.rating.code" :src="movie.data.value.posterUrl" />
            <div class="copy">
              <span class="badge">{{ movie.data.value.isSpecialEvent ? 'Evento especial' : STAGE_LABELS[movie.data.value.stage] }}</span>
              <h1>{{ movie.data.value.title }}</h1>
              <p class="meta">
                <span class="badge badge-rating">{{ movie.data.value.rating.code }}</span>
                <span>{{ movie.data.value.genres.join(', ') }}</span>
                <span><Clock :size="15" aria-hidden="true" /> {{ durationLabel(movie.data.value.durationMinutes) }}</span>
                <span>Estreno: {{ formatDate(movie.data.value.releaseDate, 'short') }}</span>
              </p>
              <p class="synopsis">{{ movie.data.value.synopsis }}</p>
              <p v-if="!movie.data.value.trailerUrl" class="trailer-note"><Film :size="16" aria-hidden="true" /> Tráiler disponible próximamente.</p>
              <a href="#horarios" class="btn btn-primary">Ver horarios</a>
            </div>
            <dl class="facts">
              <div><dt>Clasificación</dt><dd>{{ movie.data.value.rating.code }} · {{ movie.data.value.rating.description }}</dd></div>
              <div><dt>Duración</dt><dd>{{ durationLabel(movie.data.value.durationMinutes) }}</dd></div>
              <div><dt>Estreno</dt><dd>{{ formatDate(movie.data.value.releaseDate) }}</dd></div>
              <div><dt>Género</dt><dd>{{ movie.data.value.genres.join(', ') }}</dd></div>
              <div v-if="directors.length"><dt>Dirección</dt><dd>{{ directors.join(', ') }}</dd></div>
              <div v-if="actors.length"><dt>Reparto</dt><dd>{{ actors.join(', ') }}</dd></div>
            </dl>
          </div>
        </div>
      </section>

      <section class="container schedule" aria-labelledby="horarios">
        <div class="schedule-head">
          <h2 id="horarios">Horarios</h2>
          <p v-if="hasComplexes" class="where"><MapPin :size="15" aria-hidden="true" /> {{ app.selectedComplexes.map(complex => complex.name).join(' · ') }}
            <button type="button" class="link" @click="app.askForComplexes()">Cambiar</button>
          </p>
        </div>
        <div v-if="!hasComplexes" class="card choose">
          <MapPin :size="30" aria-hidden="true" />
          <h3>Elige un cine para ver los horarios</h3>
          <p class="muted">Puedes elegir varios cines de una misma ciudad para comparar.</p>
          <button type="button" class="btn btn-primary" @click="app.askForComplexes()">Elegir cines</button>
        </div>
        <StateView v-else :loading="dates.isPending.value" :error="dates.error.value" :empty="!dates.data.value?.length" skeleton="rows"
          :empty-title="movie.data.value.stage === 'coming-soon' ? 'Aún no hay venta de boletos' : 'Sin funciones en tus cines'"
          :empty-text="movie.data.value.stage === 'coming-soon' ? `Estreno el ${formatDate(movie.data.value.releaseDate)}.` : 'Elige otros cines en la barra superior o con el botón Cambiar.'"
          @retry="dates.refetch()">
          <div class="card schedule-card">
            <DateStrip v-model="date" :days="days" :today="today" :available="dates.data.value ?? []" />
            <StateView :loading="screenings.isPending.value" :error="screenings.error.value" :empty="!screenings.data.value?.length" skeleton="rows"
              empty-title="No quedan funciones este día" @retry="screenings.refetch()">
              <ShowtimeGroups :screenings="screenings.data.value ?? []" @pick="pick" />
            </StateView>
          </div>
        </StateView>
      </section>
    </template>
  </div>
</template>

<style scoped>
.hero {
  padding: 24px 0 48px;
  background:
    radial-gradient(70% 120% at 15% 0%, color-mix(in srgb, var(--accent-movie) 35%, transparent), transparent 60%),
    var(--grad-dark);
  color: #fff;
}
.back { margin-bottom: 18px; display: inline-flex; align-items: center; gap: 6px; border: 0; background: none; color: #cfe3ff; font: 700 14px var(--font-title); }
.back:hover { color: var(--accent); }
.hero-grid { display: grid; grid-template-columns: minmax(180px, 280px) minmax(0, 1fr) minmax(260px, 360px); gap: 40px; align-items: start; }
.hero-grid :deep(.art) { box-shadow: 0 22px 50px rgba(0, 0, 0, .55), 0 0 34px color-mix(in srgb, var(--accent-movie) 40%, transparent); }
.copy { display: grid; gap: 12px; justify-items: start; }
h1 { color: var(--accent-movie); font: 800 clamp(30px, 4.4vw, 54px)/1.05 var(--font-title); text-transform: uppercase; text-shadow: 0 0 28px color-mix(in srgb, var(--accent-movie) 45%, transparent); }
.meta { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; color: #d7e2f2; font-size: 14px; }
.meta span { display: inline-flex; align-items: center; gap: 4px; }
.meta .badge-rating { color: #fff; }
.synopsis { max-width: 68ch; color: #e6eefb; font-size: 17px; }
.rating-note, .trailer-note { display: flex; align-items: center; gap: 6px; color: #a9bbd6; font-size: 14px; }
.facts { margin: 0; padding: 20px; display: grid; gap: 14px; border: 1px solid rgba(255, 255, 255, .16); border-radius: var(--radius-l); background: linear-gradient(160deg, rgba(255, 255, 255, .12), rgba(255, 255, 255, .03)); box-shadow: inset 0 1px 0 rgba(255, 255, 255, .14); }
.facts div { display: grid; gap: 2px; }
.facts dt { color: var(--accent); font: 700 11px var(--font-title); letter-spacing: .1em; text-transform: uppercase; }
.facts dd { margin: 0; color: #e6eefb; font-size: 15px; }
.schedule { margin-top: 40px; padding-bottom: 80px; }
.schedule-head { margin-bottom: 14px; display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 8px 16px; }
.schedule h2 { font: 800 28px var(--font-title); letter-spacing: -.02em; }
.where { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; color: var(--muted); }
.link { padding: 0; border: 0; background: none; color: var(--blue); font-weight: 700; text-decoration: underline; text-underline-offset: 3px; }
.choose { padding: 36px 24px; display: grid; justify-items: center; gap: 10px; text-align: center; }
.choose svg { color: var(--blue); }
.choose h3 { font: 800 20px var(--font-title); }
.schedule-card { padding: 20px; display: grid; grid-template-columns: minmax(0, 1fr); gap: 14px; }
@media (max-width: 1180px) {
  .hero-grid { grid-template-columns: minmax(160px, 240px) minmax(0, 1fr); }
  .facts { grid-column: 1 / -1; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); }
}
@media (max-width: 680px) {
  .hero-grid { grid-template-columns: 120px 1fr; gap: 18px; }
  .synopsis { font-size: 15px; }
}
@media (max-width: 460px) {
  .hero-grid { grid-template-columns: minmax(0, 1fr); }
  .hero-grid :deep(.art) { width: 150px; }
}
</style>
