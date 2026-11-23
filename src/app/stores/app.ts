import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { Complex, Limits, Session } from '@/domain/models'
import { local } from '@/shared/lib/storage'

const SELECTED_KEY = 'cp-selected-complexes'

/** Datos de arranque, complejos elegidos y sesión. Solo guarda en el navegador la preferencia de complejos. */
export const useAppStore = defineStore('app', () => {
  const complexes = ref<Complex[]>([])
  const limits = ref<Limits>({ maxSeatsPerPurchase: 10, scheduleDays: 14, cancelMinutesBefore: 60 })
  const session = ref<Session>({ kind: 'guest', email: null, displayName: null, csrfToken: null })
  const selectedIds = ref<string[]>(local.get<string[]>(SELECTED_KEY, []))

  const selectedComplexes = computed(() => {
    const chosen = complexes.value.filter(complex => selectedIds.value.includes(complex.id))
    return chosen.length ? chosen : complexes.value.slice(0, 1)
  })
  const selectedComplexIds = computed(() => selectedComplexes.value.map(complex => complex.id))
  const primaryComplex = computed(() => selectedComplexes.value[0] ?? null)

  function setComplexes(list: Complex[], newLimits: Limits) {
    complexes.value = list
    limits.value = newLimits
    selectedIds.value = selectedIds.value.filter(id => list.some(complex => complex.id === id))
  }

  function selectComplexes(ids: string[]) {
    selectedIds.value = ids.length ? ids : selectedComplexIds.value
    local.set(SELECTED_KEY, selectedIds.value)
  }

  const complexById = (id: string) => complexes.value.find(complex => complex.id === id)

  return {
    complexes, limits, session, selectedIds, selectedComplexes, selectedComplexIds, primaryComplex,
    setComplexes, selectComplexes, complexById
  }
})
