<script setup lang="ts">
/**
 * Selector de cines. Se pueden elegir varios complejos de una misma ciudad, o ninguno.
 * Al marcar un cine de otra ciudad, la selección cambia a esa ciudad.
 * Está en `App.vue` para abrirse desde cualquier vista (barra, buscador o al elegir una película).
 */
import { computed, nextTick, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Check, MapPin, Search, X } from '@lucide/vue'
import BaseDialog from '@/shared/ui/BaseDialog.vue'
import { useAppStore } from '@/app/stores/app'
import { normalizeText } from '@/shared/lib/text'
import type { Complex } from '@/domain/models'

const app = useAppStore()
const router = useRouter()
const draft = ref<string[]>([])
const term = ref('')
const switchedTo = ref<string | null>(null)
const searchInput = ref<HTMLInputElement>()
/** Ciudad que va primero en la lista. Se fija al abrir para que la lista no se mueva mientras se elige. */
const firstCity = ref<string | null>(null)

const draftCity = computed(() => app.complexById(draft.value[0] ?? '')?.city ?? null)

/** Ciudades con sus cines que coinciden con la búsqueda (por nombre del cine o de la ciudad). La ciudad ya elegida va primero. */
const cities = computed(() => {
  const query = normalizeText(term.value)
  const groups = new Map<string, Complex[]>()
  for (const complex of app.complexes) {
    if (query && !normalizeText(`${complex.name} ${complex.city}`).includes(query)) continue
    groups.set(complex.city, [...(groups.get(complex.city) ?? []), complex])
  }
  return [...groups].sort(([a], [b]) => Number(b === firstCity.value) - Number(a === firstCity.value))
})

watch(() => app.pickerOpen, open => {
  if (!open) return
  draft.value = [...app.selectedComplexIds]
  firstCity.value = app.selectedCity
  term.value = ''
  switchedTo.value = null
  void nextTick(() => searchInput.value?.focus())
})

function toggle(complex: Complex, checked: boolean) {
  if (!checked) {
    draft.value = draft.value.filter(id => id !== complex.id)
    return
  }
  if (draftCity.value && draftCity.value !== complex.city) {
    draft.value = [complex.id]
    switchedTo.value = complex.city
    return
  }
  draft.value = [...draft.value, complex.id]
}

function selectCity(list: Complex[]) {
  if (draftCity.value !== list[0]?.city) switchedTo.value = draftCity.value ? list[0]?.city ?? null : null
  draft.value = list.map(complex => complex.id)
}

const continuing = computed(() => Boolean(app.pendingPath))
const applyLabel = computed(() => {
  if (!draft.value.length) return continuing.value ? 'Elige al menos un cine' : 'Ver todos los cines'
  return continuing.value ? 'Ver horarios' : 'Aplicar'
})

function apply() {
  if (continuing.value && !draft.value.length) return
  const then = app.pendingPath
  app.selectComplexes(draft.value)
  app.closePicker()
  if (then && draft.value.length) void router.push(then)
}
</script>

<template>
  <BaseDialog :open="app.pickerOpen" label="Elige tus cines" @close="app.closePicker()">
    <template #header><h2>Elige tus cines</h2></template>

    <div class="search-area">
      <label class="search">
        <Search :size="19" aria-hidden="true" />
        <span class="visually-hidden">Buscar por cine o ciudad</span>
        <input ref="searchInput" v-model="term" type="search" placeholder="Busca por cine o ciudad" autocomplete="off" />
        <button v-if="term" type="button" class="clear" aria-label="Borrar búsqueda" @click="term = ''; searchInput?.focus()"><X :size="16" /></button>
      </label>
      <p v-if="continuing" class="notice">Elige dónde quieres verla para mostrarte los horarios.</p>
      <p v-else class="help">Puedes elegir varios cines de una misma ciudad para comparar horarios.</p>
      <p v-if="switchedTo" class="notice notice-warning" role="status">Cambiamos a {{ switchedTo }}: solo puedes elegir cines de una ciudad a la vez.</p>
    </div>

    <p v-if="!cities.length" class="muted empty">No encontramos cines ni ciudades con «{{ term }}».</p>
    <fieldset v-for="[city, list] in cities" :key="city" class="city" :class="{ current: city === draftCity }">
      <legend>
        <MapPin :size="15" aria-hidden="true" /> {{ city }}
        <button v-if="list.length > 1" type="button" class="all" @click="selectCity(list)">Elegir todos</button>
      </legend>
      <label v-for="complex in list" :key="complex.id" class="option" :class="{ checked: draft.includes(complex.id) }">
        <input type="checkbox" :checked="draft.includes(complex.id)" @change="toggle(complex, ($event.target as HTMLInputElement).checked)" />
        <span class="copy">
          <strong>{{ complex.name }}</strong>
          <span v-if="complex.formats.length" class="formats">
            <span v-for="format in complex.formats" :key="format.code" class="format">{{ format.name }}</span>
          </span>
        </span>
        <small v-if="draftCity && city !== draftCity" class="switch">Cambiar a esta ciudad</small>
      </label>
    </fieldset>

    <template #footer>
      <div class="footer">
        <p class="status">
          <template v-if="draft.length"><Check :size="16" aria-hidden="true" /> {{ draft.length }} {{ draft.length === 1 ? 'cine' : 'cines' }} en {{ draftCity }}</template>
          <template v-else>Sin cines elegidos</template>
        </p>
        <button v-if="draft.length" type="button" class="btn btn-ghost btn-small" @click="draft = []; switchedTo = null">Quitar todos</button>
        <button type="button" class="btn btn-primary" :disabled="continuing && !draft.length" @click="apply">{{ applyLabel }}</button>
      </div>
    </template>
  </BaseDialog>
</template>

<style scoped>
.search-area { position: sticky; top: -20px; z-index: 1; margin: -20px -20px 16px; padding: 16px 20px 12px; display: grid; gap: 10px; background: var(--surface); border-bottom: 1px solid var(--line); }
.search { display: flex; align-items: center; gap: 10px; padding: 0 12px; border: 1px solid var(--line-strong); border-radius: var(--radius-m); background: linear-gradient(180deg, #fff, #f5f9ff); }
.search:focus-within { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(56, 189, 248, .25); }
.search svg { color: var(--blue); flex: none; }
.search input { flex: 1; min-width: 0; min-height: 48px; border: 0; background: transparent; font-size: 16px; }
.search input:focus { outline: none; }
.search input::-webkit-search-cancel-button { display: none; }
.clear { width: 30px; height: 30px; display: grid; place-items: center; border: 0; border-radius: 8px; background: var(--surface-soft); color: var(--muted); }
.help { color: var(--muted); font-size: 14px; }
.empty { padding: 12px 0; }
.city { margin: 0 0 16px; padding: 0; border: 0; }
.city legend { width: 100%; margin-bottom: 6px; display: flex; align-items: center; gap: 6px; color: var(--blue); font: 700 13px var(--font-title); text-transform: uppercase; letter-spacing: .08em; }
.all { margin-left: auto; padding: 4px 8px; border: 0; border-radius: 8px; background: transparent; color: var(--blue); font: 700 12px var(--font-title); letter-spacing: 0; text-transform: none; }
.all:hover { background: var(--accent-soft); }
.option { display: flex; align-items: center; gap: 12px; padding: 10px; border-radius: 12px; cursor: pointer; transition: background .2s; }
.option + .option { margin-top: 2px; }
.option:hover { background: var(--surface-soft); }
.option.checked { background: var(--accent-soft); }
.option input { flex: none; width: 18px; height: 18px; accent-color: var(--blue); }
.copy { flex: 1; min-width: 0; display: grid; gap: 4px; }
.formats { display: flex; flex-wrap: wrap; gap: 4px; }
.format { padding: 1px 6px; border: 1px solid var(--line-strong); border-radius: 5px; color: var(--muted); font: 700 10px var(--font-title); letter-spacing: .03em; }
.switch { flex: none; color: var(--muted); font-size: 12px; }
.footer { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
.status { margin-right: auto; display: inline-flex; align-items: center; gap: 6px; color: var(--muted); font-size: 14px; }
@media (max-width: 520px) {
  .switch { display: none; }
  .footer .btn-primary { flex: 1 0 100%; }
}
</style>
