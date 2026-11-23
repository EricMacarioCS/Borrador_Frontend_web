<script setup lang="ts">
/**
 * Buscador de películas, cines y formatos (combobox WAI-ARIA con lista de sugerencias).
 * Sin texto muestra las 5 películas más populares y los formatos de todos los complejos.
 * `popover`: campo del encabezado con lista flotante. `panel`: dentro de una ventana, lista siempre visible.
 */
import { computed, ref, useId, watch } from 'vue'
import { useRouter } from 'vue-router'
import { MapPin, Search, X } from '@lucide/vue'
import PosterArt from '@/shared/ui/PosterArt.vue'
import { useMovies, usePopularMovies } from '@/app/queries'
import { useAppStore } from '@/app/stores/app'
import { toast } from '@/shared/composables/feedback'
import { normalizeText } from '@/shared/lib/text'
import { STAGE_LABELS } from '@/domain/labels'
import type { Complex, ComplexFormat, Movie } from '@/domain/models'

const props = withDefaults(defineProps<{ mode?: 'popover' | 'panel' }>(), { mode: 'popover' })
const emit = defineEmits<{ done: [] }>()

const app = useAppStore()
const router = useRouter()
const listId = useId()
const term = ref('')
const open = ref(props.mode === 'panel')
const active = ref(-1)
const root = ref<HTMLElement>()
const input = ref<HTMLInputElement>()

const movies = useMovies(() => app.selectedComplexIds)
const popular = usePopularMovies(() => app.selectedComplexIds, 5)

type Option =
  | { kind: 'movie'; key: string; movie: Movie; rank: number | null }
  | { kind: 'complex'; key: string; complex: Complex }
  | { kind: 'format'; key: string; format: ComplexFormat }
interface Group { key: string; title: string; options: Option[] }

const query = computed(() => normalizeText(term.value))
const searching = computed(() => query.value.length >= 2)

const groups = computed<Group[]>(() => {
  const movieOption = (movie: Movie, rank: number | null): Option => ({ kind: 'movie', key: `m-${movie.id}`, movie, rank })
  const formatOption = (format: ComplexFormat): Option => ({ kind: 'format', key: `f-${format.code}`, format })
  if (!searching.value) {
    return [
      { key: 'popular', title: 'Las más populares', options: (popular.data.value ?? []).slice(0, 5).map((movie, i) => movieOption(movie, i + 1)) },
      { key: 'formats', title: 'Formatos en nuestros cines', options: app.allFormats.map(formatOption) }
    ].filter(group => group.options.length)
  }
  const q = query.value
  const foundMovies = (movies.data.value ?? [])
    .filter(movie => normalizeText(`${movie.title} ${movie.genres.join(' ')} ${movie.cast.map(person => person.name).join(' ')}`).includes(q))
    .slice(0, 6)
  const foundComplexes = app.complexes.filter(complex => normalizeText(`${complex.name} ${complex.city}`).includes(q)).slice(0, 6)
  const foundFormats = app.allFormats.filter(format => normalizeText(format.name).includes(q))
  return [
    { key: 'movies', title: 'Películas', options: foundMovies.map(movie => movieOption(movie, null)) },
    { key: 'complexes', title: 'Cines', options: foundComplexes.map((complex): Option => ({ kind: 'complex', key: `c-${complex.id}`, complex })) },
    { key: 'formats', title: 'Formatos', options: foundFormats.map(formatOption) }
  ].filter(group => group.options.length)
})

const flat = computed(() => groups.value.flatMap(group => group.options))
const indexOf = (option: Option) => flat.value.indexOf(option)
const optionId = (option: Option) => `${listId}-${option.key}`
const activeId = computed(() => flat.value[active.value] ? optionId(flat.value[active.value]!) : undefined)
const showPanel = computed(() => open.value && (flat.value.length > 0 || searching.value))
const status = computed(() => searching.value ? `${flat.value.length} sugerencias` : '')

watch(term, () => { active.value = -1 })

function close() {
  if (props.mode === 'popover') open.value = false
  active.value = -1
}

function finish() {
  term.value = ''
  close()
  if (props.mode === 'popover') input.value?.blur()
  emit('done')
}

function run(option: Option) {
  if (option.kind === 'movie') {
    void router.push(`/peliculas/${option.movie.slug}`)
  } else if (option.kind === 'complex') {
    const change = app.addComplex(option.complex.id)
    if (change === 'switched-city') toast(`Cambiamos tus cines a ${option.complex.name}, en ${option.complex.city}.`)
    else if (change === 'added') toast(`Agregamos ${option.complex.name} a tus cines.`)
    void router.push('/cartelera')
  } else {
    const param = option.format.kind === 'projection' ? 'proyeccion' : 'sala'
    void router.push({ path: '/cartelera', query: { [param]: option.format.code } })
  }
  finish()
}

function onKey(event: KeyboardEvent) {
  const count = flat.value.length
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    open.value = true
    if (!count) return
    const step = event.key === 'ArrowDown' ? 1 : -1
    active.value = active.value < 0 ? (step > 0 ? 0 : count - 1) : (active.value + step + count) % count
  } else if (event.key === 'Enter') {
    const option = flat.value[active.value] ?? (searching.value ? flat.value[0] : undefined)
    if (option) {
      event.preventDefault()
      run(option)
    }
  } else if (event.key === 'Escape') {
    if (term.value) {
      event.preventDefault()
      event.stopPropagation()
      term.value = ''
    } else if (props.mode === 'popover' && open.value) {
      event.preventDefault()
      close()
    }
  }
}

function onFocusOut(event: FocusEvent) {
  if (props.mode === 'popover' && !root.value?.contains(event.relatedTarget as Node | null)) close()
}

function clear() {
  term.value = ''
  input.value?.focus()
}

const complexFormats = (complex: Complex) => complex.formats.map(format => format.name).join(' · ')
</script>

<template>
  <div ref="root" class="search-box" :class="`mode-${mode}`" @focusout="onFocusOut">
    <label class="field">
      <Search :size="19" aria-hidden="true" />
      <span class="visually-hidden">Buscar películas, cines o formatos</span>
      <input ref="input" v-model="term" type="search" role="combobox" placeholder="Busca películas o cines" autocomplete="off" spellcheck="false"
        aria-autocomplete="list" :aria-expanded="showPanel" :aria-controls="listId" :aria-activedescendant="activeId" :autofocus="mode === 'panel'"
        @focus="open = true" @click="open = true" @input="open = true" @keydown="onKey" />
      <button v-if="term" type="button" class="clear" aria-label="Borrar búsqueda" @click="clear"><X :size="16" /></button>
    </label>

    <div v-show="showPanel" class="suggestions">
      <p class="visually-hidden" role="status">{{ status }}</p>
      <ul :id="listId" role="listbox" aria-label="Sugerencias" class="groups">
        <li v-for="group in groups" :key="group.key" role="group" :aria-labelledby="`${listId}-${group.key}`" class="group" :class="group.key">
          <span :id="`${listId}-${group.key}`" role="presentation" class="group-title">{{ group.title }}</span>
          <ul role="presentation" class="options">
            <li v-for="option in group.options" :id="optionId(option)" :key="option.key" role="option" class="option" :class="[option.kind, { active: indexOf(option) === active }]"
              :aria-selected="indexOf(option) === active" @mousedown.prevent @mousemove="active = indexOf(option)" @click="run(option)">
              <template v-if="option.kind === 'movie'">
                <span v-if="option.rank" class="rank" aria-hidden="true">{{ option.rank }}</span>
                <PosterArt :title="option.movie.title" :accent="option.movie.accent" :src="option.movie.posterUrl" decorative />
                <span class="text">
                  <strong>{{ option.movie.title }}</strong>
                  <small>{{ option.movie.rating.code }} · {{ option.movie.genres.join(', ') }} · {{ option.movie.isSpecialEvent ? 'Evento especial' : STAGE_LABELS[option.movie.stage] }}</small>
                </span>
              </template>
              <template v-else-if="option.kind === 'complex'">
                <span class="pin" aria-hidden="true"><MapPin :size="18" /></span>
                <span class="text">
                  <small class="city">{{ option.complex.city }}</small>
                  <strong>{{ option.complex.name }}<span v-if="app.selectedComplexIds.includes(option.complex.id)" class="badge">Elegido</span></strong>
                  <span v-if="option.complex.formats.length" class="complex-formats">
                    <span v-for="format in option.complex.formats" :key="format.code">{{ format.name }}</span>
                  </span>
                  <span class="visually-hidden">Formatos: {{ complexFormats(option.complex) }}</span>
                </span>
              </template>
              <template v-else>{{ option.format.name }}</template>
            </li>
          </ul>
        </li>
      </ul>
      <p v-if="searching && !flat.length" class="empty">No encontramos películas, cines ni formatos con «{{ term }}».</p>
    </div>
  </div>
</template>

<style scoped>
.search-box { position: relative; min-width: 0; }
.field { display: flex; align-items: center; gap: 10px; padding: 0 12px; border: 1px solid var(--line-strong); border-radius: var(--radius-m); background: #fff; }
.field:focus-within { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(56, 189, 248, .25); }
.field svg { flex: none; color: var(--blue); }
.field input { flex: 1; min-width: 0; min-height: 50px; border: 0; background: transparent; font-size: 16px; }
.field input:focus { outline: none; }
.field input::-webkit-search-cancel-button { display: none; }
.clear { flex: none; width: 28px; height: 28px; display: grid; place-items: center; border: 0; border-radius: 8px; background: var(--surface-soft); color: var(--muted); }

/* En el encabezado oscuro. */
.mode-popover .field { border-color: rgba(255, 255, 255, .28); background: rgba(255, 255, 255, .1); color: #fff; box-shadow: inset 0 1px 0 rgba(255, 255, 255, .12); }
.mode-popover .field svg { color: #cfe3ff; }
.mode-popover .field input { min-height: 42px; font-size: 15px; }
.mode-popover .field input::placeholder { color: #b8cdee; }
.mode-popover .field:focus-within { border-color: var(--accent); background: rgba(255, 255, 255, .16); box-shadow: 0 0 0 3px rgba(56, 189, 248, .3), 0 0 22px rgba(56, 189, 248, .35); }
.mode-popover .clear { background: rgba(255, 255, 255, .16); color: #fff; }
.mode-popover .suggestions {
  position: absolute;
  top: calc(100% + 10px);
  left: 0;
  right: 0;
  z-index: 60;
  min-width: 380px;
  max-height: min(70dvh, 620px);
  overflow-y: auto;
  padding: 10px;
  border: 1px solid var(--line);
  border-radius: var(--radius-l);
  background: var(--surface);
  color: var(--ink);
  box-shadow: var(--shadow-float);
  animation: panel-in .2s var(--ease);
}
.mode-panel .suggestions { margin-top: 14px; }

.groups { padding: 0; list-style: none; display: grid; gap: 10px; }
.group-title { display: block; padding: 6px 8px; color: var(--blue); font: 700 11px var(--font-title); letter-spacing: .12em; text-transform: uppercase; }
.options { padding: 0; list-style: none; display: grid; gap: 2px; }
.option { padding: 8px; display: flex; align-items: center; gap: 12px; border-radius: 12px; cursor: pointer; }
.option.active { background: var(--accent-soft); box-shadow: inset 0 0 0 1px rgba(56, 189, 248, .5); }
.option :deep(.art) { width: 40px; flex: none; }
.rank { width: 22px; flex: none; color: var(--blue); font: 800 22px var(--font-title); text-align: center; }
.text { min-width: 0; display: grid; gap: 1px; }
.text strong { display: flex; align-items: center; gap: 8px; font: 700 15px var(--font-title); }
.text small { overflow: hidden; color: var(--muted); font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
.text .city { color: var(--blue); font: 700 11px var(--font-title); letter-spacing: .06em; text-transform: uppercase; }
.pin { width: 40px; height: 40px; flex: none; display: grid; place-items: center; border-radius: 10px; background: var(--grad-blue); color: #fff; }
.complex-formats { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 3px; }
.complex-formats span { padding: 1px 6px; border: 1px solid var(--line-strong); border-radius: 5px; color: var(--muted); font: 700 10px var(--font-title); }
.group.formats .options { display: flex; flex-wrap: wrap; gap: 8px; padding: 2px 8px 6px; }
.option.format { padding: 7px 14px; border: 1px solid var(--line); border-radius: 999px; font: 700 13px var(--font-title); color: #3e5170; }
.option.format.active { border-color: var(--accent); color: var(--blue); }
.empty { padding: 14px 8px; color: var(--muted); }
@keyframes panel-in { from { opacity: 0; transform: translateY(-6px); } }
</style>
