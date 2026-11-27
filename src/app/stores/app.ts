import { createStore, useStore } from 'zustand'
import type { Complex, ComplexFormat, Limits, Session } from '@/domain/models'
import { local } from '@/shared/lib/storage'

const SELECTED_KEY = 'cp-selected-complexes'

/** Resultado de agregar un cine: si era de otra ciudad, la selección se reemplaza. */
export type ComplexChange = 'added' | 'already' | 'switched-city'

/** Valores derivados de los complejos y la selección. Se recalculan solo cuando cambian, para que las vistas no se redibujen de más. */
interface Derived {
  selectedComplexes: Complex[]
  selectedComplexIds: string[]
  primaryComplex: Complex | null
  selectedCity: string | null
  /** Para explorar la cartelera: los cines elegidos o, si no hay, todos. */
  browseComplexIds: string[]
  /** Formatos de todos los complejos, sin repetir, en el orden en que los envía el servidor. */
  allFormats: ComplexFormat[]
}

export interface AppState extends Derived {
  complexes: Complex[]
  limits: Limits
  session: Session
  selectedIds: string[]
  /** Selector de cines: se abre desde la barra, el buscador o al elegir una película sin cine. */
  pickerOpen: boolean
  /** Ruta a la que se continúa al elegir cines, por ejemplo la película que se quería ver. */
  pendingPath: string | null

  setComplexes: (list: Complex[], limits: Limits) => void
  setSession: (session: Session) => void
  selectComplexes: (ids: string[]) => void
  addComplex: (id: string) => ComplexChange
  removeComplex: (id: string) => void
  complexById: (id: string) => Complex | undefined
  askForComplexes: (then?: string | null) => void
  closePicker: () => void
}

function derive(complexes: Complex[], selectedIds: string[]): Derived {
  const selectedComplexes = complexes.filter(complex => selectedIds.includes(complex.id))
  const selectedComplexIds = selectedComplexes.map(complex => complex.id)
  const primaryComplex = selectedComplexes[0] ?? null
  const seen = new Map<string, ComplexFormat>()
  for (const complex of complexes) for (const format of complex.formats) if (!seen.has(format.code)) seen.set(format.code, format)
  return {
    selectedComplexes,
    selectedComplexIds,
    primaryComplex,
    selectedCity: primaryComplex?.city ?? null,
    browseComplexIds: selectedComplexIds.length ? selectedComplexIds : complexes.map(complex => complex.id),
    allFormats: [...seen.values()].sort((a, b) => Number(a.kind === 'projection') - Number(b.kind === 'projection'))
  }
}

/**
 * Datos de arranque, cines elegidos y sesión. Solo guarda en el navegador la preferencia de cines.
 * Se pueden elegir varios cines, siempre de una misma ciudad, o ninguno.
 */
export function createAppStore() {
  return createStore<AppState>((set, get) => {
    /** Deja solo cines existentes y de una misma ciudad (la del primero). */
    function sanitize(ids: string[]) {
      const known = [...new Set(ids)].map(id => get().complexById(id)).filter(complex => complex !== undefined)
      const city = known[0]?.city
      return known.filter(complex => complex.city === city).map(complex => complex.id)
    }

    function persist(ids: string[]) {
      const selectedIds = sanitize(ids)
      local.set(SELECTED_KEY, selectedIds)
      set({ selectedIds, ...derive(get().complexes, selectedIds) })
    }

    const selectedIds = local.get<string[]>(SELECTED_KEY, [])
    return {
      complexes: [],
      limits: { maxSeatsPerPurchase: 10, scheduleDays: 14, cancelMinutesBefore: 60 },
      session: { kind: 'guest', email: null, displayName: null, csrfToken: null },
      selectedIds,
      pickerOpen: false,
      pendingPath: null,
      ...derive([], selectedIds),

      setComplexes(list, limits) {
        set({ complexes: list, limits })
        const ids = sanitize(get().selectedIds)
        set({ selectedIds: ids, ...derive(list, ids) })
      },
      setSession(session) {
        set({ session })
      },
      selectComplexes(ids) {
        persist(ids)
      },
      addComplex(id) {
        const complex = get().complexById(id)
        const { selectedIds, selectedCity } = get()
        if (!complex || selectedIds.includes(id)) return 'already'
        if (selectedCity && selectedCity !== complex.city) {
          persist([id])
          return 'switched-city'
        }
        persist([...selectedIds, id])
        return 'added'
      },
      removeComplex(id) {
        persist(get().selectedIds.filter(item => item !== id))
      },
      complexById(id) {
        return get().complexes.find(complex => complex.id === id)
      },
      askForComplexes(then = null) {
        set({ pendingPath: then, pickerOpen: true })
      },
      closePicker() {
        set({ pickerOpen: false, pendingPath: null })
      }
    }
  })
}

export const appStore = createAppStore()

/** Lee una parte del estado; la vista se redibuja solo cuando esa parte cambia. */
export function useAppStore<T>(selector: (state: AppState) => T): T {
  return useStore(appStore, selector)
}
