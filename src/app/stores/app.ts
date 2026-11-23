import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { Complex, ComplexFormat, Limits, Session } from '@/domain/models'
import { local } from '@/shared/lib/storage'

const SELECTED_KEY = 'cp-selected-complexes'

/** Resultado de agregar un cine: si era de otra ciudad, la selección se reemplaza. */
export type ComplexChange = 'added' | 'already' | 'switched-city'

/**
 * Datos de arranque, cines elegidos y sesión. Solo guarda en el navegador la preferencia de cines.
 * Se pueden elegir varios cines, siempre de una misma ciudad, o ninguno.
 */
export const useAppStore = defineStore('app', () => {
  const complexes = ref<Complex[]>([])
  const limits = ref<Limits>({ maxSeatsPerPurchase: 10, scheduleDays: 14, cancelMinutesBefore: 60 })
  const session = ref<Session>({ kind: 'guest', email: null, displayName: null, csrfToken: null })
  const selectedIds = ref<string[]>(local.get<string[]>(SELECTED_KEY, []))

  /** Selector de cines: se abre desde la barra, el buscador o al elegir una película sin cine. */
  const pickerOpen = ref(false)
  /** Ruta a la que se continúa al elegir cines, por ejemplo la película que se quería ver. */
  const pendingPath = ref<string | null>(null)

  const selectedComplexes = computed(() => complexes.value.filter(complex => selectedIds.value.includes(complex.id)))
  const selectedComplexIds = computed(() => selectedComplexes.value.map(complex => complex.id))
  const primaryComplex = computed(() => selectedComplexes.value[0] ?? null)
  const selectedCity = computed(() => primaryComplex.value?.city ?? null)
  /** Para explorar la cartelera: los cines elegidos o, si no hay, todos. */
  const browseComplexIds = computed(() => selectedComplexIds.value.length ? selectedComplexIds.value : complexes.value.map(complex => complex.id))

  /** Formatos de todos los complejos, sin repetir, en el orden en que los envía el servidor. */
  const allFormats = computed(() => {
    const seen = new Map<string, ComplexFormat>()
    for (const complex of complexes.value) for (const format of complex.formats) if (!seen.has(format.code)) seen.set(format.code, format)
    return [...seen.values()].sort((a, b) => Number(a.kind === 'projection') - Number(b.kind === 'projection'))
  })

  const complexById = (id: string) => complexes.value.find(complex => complex.id === id)

  /** Deja solo cines existentes y de una misma ciudad (la del primero). */
  function sanitize(ids: string[]) {
    const known = [...new Set(ids)].map(complexById).filter(complex => complex !== undefined)
    const city = known[0]?.city
    return known.filter(complex => complex.city === city).map(complex => complex.id)
  }

  function persist(ids: string[]) {
    selectedIds.value = sanitize(ids)
    local.set(SELECTED_KEY, selectedIds.value)
  }

  function setComplexes(list: Complex[], newLimits: Limits) {
    complexes.value = list
    limits.value = newLimits
    selectedIds.value = sanitize(selectedIds.value)
  }

  function selectComplexes(ids: string[]) {
    persist(ids)
  }

  function addComplex(id: string): ComplexChange {
    const complex = complexById(id)
    if (!complex) return 'already'
    if (selectedIds.value.includes(id)) return 'already'
    if (selectedCity.value && selectedCity.value !== complex.city) {
      persist([id])
      return 'switched-city'
    }
    persist([...selectedIds.value, id])
    return 'added'
  }

  function removeComplex(id: string) {
    persist(selectedIds.value.filter(item => item !== id))
  }

  function askForComplexes(then: string | null = null) {
    pendingPath.value = then
    pickerOpen.value = true
  }

  function closePicker() {
    pickerOpen.value = false
    pendingPath.value = null
  }

  return {
    complexes, limits, session, selectedIds, selectedComplexes, selectedComplexIds, primaryComplex, selectedCity, browseComplexIds,
    allFormats, pickerOpen, pendingPath,
    setComplexes, selectComplexes, addComplex, removeComplex, complexById, askForComplexes, closePicker
  }
})
