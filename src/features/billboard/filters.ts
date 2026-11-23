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

export interface ScreeningFilters {
  roomType: string
  projection: string
  language: string
  fromHour: string
}

export function matchesFilters(screening: Screening, filters: ScreeningFilters, timeZone: string) {
  return (filters.roomType === 'all' || screening.room.type.code === filters.roomType) &&
    (filters.projection === 'all' || screening.projection.code === filters.projection) &&
    (filters.language === 'all' || screening.language.code === filters.language) &&
    (filters.fromHour === 'all' || formatTime(screening.startsAt, timeZone) >= filters.fromHour)
}

/** Opciones de filtro a partir de lo que existe ese día: un catálogo nuevo del backend aparece solo. */
export function optionsFrom(screenings: Screening[], pick: (screening: Screening) => { code: string; name: string }) {
  const seen = new Map<string, string>()
  for (const screening of screenings) {
    const { code, name } = pick(screening)
    seen.set(code, name)
  }
  return [{ value: 'all', label: 'Todos' }, ...[...seen].map(([value, label]) => ({ value, label }))]
}
