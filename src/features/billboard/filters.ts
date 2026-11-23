import { computed, type Ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { Movie, Screening } from '@/domain/models'
import { formatTime } from '@/shared/lib/datetime'

/** Un parámetro de la URL como estado: la vista se puede compartir y "Atrás" funciona. */
export function useQueryParam(name: string, fallback: string): Ref<string> {
  const route = useRoute()
  const router = useRouter()
  return computed({
    get: () => {
      const value = route.query[name]
      return typeof value === 'string' && value ? value : fallback
    },
    set: value => {
      const query = { ...route.query, [name]: value === fallback ? undefined : value }
      void router.replace({ query })
    }
  })
}

/** Varios valores en un parámetro de la URL, separados por comas: `?sala=imax,4dx`. */
export function useQueryList(name: string): Ref<string[]> {
  const route = useRoute()
  const router = useRouter()
  return computed({
    get: () => {
      const value = route.query[name]
      return typeof value === 'string' ? value.split(',').filter(Boolean) : []
    },
    set: values => {
      void router.replace({ query: { ...route.query, [name]: values.length ? [...new Set(values)].join(',') : undefined } })
    }
  })
}

export const CATEGORIES = [
  { value: 'todas', label: 'Todas' },
  { value: 'now-showing', label: 'En cartelera' },
  { value: 'premiere', label: 'Estreno' },
  { value: 'presale', label: 'Preventa' },
  { value: 'coming-soon', label: 'Próximamente' },
  { value: 'events', label: 'Eventos especiales' }
] as const

export function matchesCategory(movie: Movie, category: string) {
  if (category === 'todas') return movie.stage !== 'coming-soon' || movie.isSpecialEvent
  if (category === 'events') return movie.isSpecialEvent
  return movie.stage === category && (category === 'coming-soon' || !movie.isSpecialEvent)
}

/** Franjas de horario. La hora se toma en la zona del complejo. */
export const DAYPARTS = [
  { value: 'manana', label: 'Mañana', hint: 'Antes de las 12:00', from: '00:00', to: '12:00' },
  { value: 'mediodia', label: 'Mediodía', hint: 'De 12:00 a 14:59', from: '12:00', to: '15:00' },
  { value: 'tarde', label: 'Tarde', hint: 'De 15:00 a 17:59', from: '15:00', to: '18:00' },
  { value: 'noche', label: 'Noche', hint: 'Desde las 18:00', from: '18:00', to: '24:00' }
] as const

/** Filtros de la cartelera: dentro de un grupo basta con cumplir una opción; entre grupos se deben cumplir todos. */
export interface ScreeningFilters {
  roomTypes: string[]
  projections: string[]
  languages: string[]
  dayparts: string[]
}
export type FilterGroup = keyof ScreeningFilters

export const FILTER_GROUPS: { key: FilterGroup; title: string; param: string }[] = [
  { key: 'roomTypes', title: 'Tipo de sala', param: 'sala' },
  { key: 'projections', title: 'Proyección', param: 'proyeccion' },
  { key: 'languages', title: 'Idioma', param: 'idioma' },
  { key: 'dayparts', title: 'Horario', param: 'horario' }
]

const LABELED: Record<Exclude<FilterGroup, 'dayparts'>, (screening: Screening) => { code: string; name: string }> = {
  roomTypes: screening => screening.room.type,
  projections: screening => screening.projection,
  languages: screening => screening.language
}

function matchesGroup(screening: Screening, group: FilterGroup, values: string[], timeZone: string) {
  if (!values.length) return true
  if (group === 'dayparts') {
    const time = formatTime(screening.startsAt, timeZone)
    return DAYPARTS.some(part => values.includes(part.value) && time >= part.from && time < part.to)
  }
  return values.includes(LABELED[group](screening).code)
}

/** `except` deja fuera un grupo: sirve para contar cuántas funciones daría cada opción de ese grupo. */
export function matchesFilters(screening: Screening, filters: ScreeningFilters, timeZone: string, except?: FilterGroup) {
  return FILTER_GROUPS.every(({ key }) => key === except || matchesGroup(screening, key, filters[key], timeZone))
}

export interface FilterOption {
  value: string
  label: string
  hint?: string
  /** Funciones que quedarían al marcar esta opción, con los demás filtros aplicados. */
  count: number
}

/**
 * Opciones de un grupo a partir de las funciones del día: un catálogo nuevo del backend aparece solo.
 * Una opción marcada que ya no existe ese día se conserva (con 0) para poder desmarcarla.
 */
export function facetOptions(
  screenings: Screening[], filters: ScreeningFilters, group: FilterGroup, timeZone: string, labelOf: (code: string) => string = code => code
): FilterOption[] {
  const pool = screenings.filter(screening => matchesFilters(screening, filters, timeZone, group))
  if (group === 'dayparts') {
    return DAYPARTS.map(part => ({ value: part.value, label: part.label, hint: part.hint, count: pool.filter(item => matchesGroup(item, group, [part.value], timeZone)).length }))
  }
  const options = new Map<string, FilterOption>()
  for (const screening of screenings) {
    const { code, name } = LABELED[group](screening)
    if (!options.has(code)) options.set(code, { value: code, label: name, count: 0 })
  }
  for (const screening of pool) options.get(LABELED[group](screening).code)!.count++
  for (const value of filters[group]) if (!options.has(value)) options.set(value, { value, label: labelOf(value), count: 0 })
  return [...options.values()]
}
