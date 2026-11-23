/**
 * Consultas al servidor con caché (TanStack Query). Las vistas usan estos composables
 * y nunca llaman a los puertos directamente para leer datos.
 */
import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { keepPreviousData, useQuery } from '@tanstack/vue-query'
import type { MovieStage } from '@/domain/models'
import { useServices } from './services'

export const keys = {
  movies: (complexIds: string[], stage?: MovieStage, special?: boolean) => ['movies', complexIds, stage ?? 'all', special ?? 'all'] as const,
  popularMovies: (complexIds: string[], limit: number) => ['movies', 'popular', complexIds, limit] as const,
  movie: (slug: string) => ['movie', slug] as const,
  screenings: (complexIds: string[], date: string, movieId?: string) => ['screenings', complexIds, date, movieId ?? 'all'] as const,
  screeningDates: (movieId: string, complexIds: string[]) => ['screening-dates', movieId, complexIds] as const,
  screening: (id: string) => ['screening', id] as const,
  products: (complexId: string) => ['products', complexId] as const,
  purchases: () => ['purchases'] as const,
  purchase: (id: string) => ['purchase', id] as const,
  promotions: () => ['promotions'] as const,
  home: () => ['home'] as const,
  page: (slug: string) => ['page', slug] as const,
  faq: () => ['faq'] as const
}

export function useMovies(complexIds: MaybeRefOrGetter<string[]>, stage?: MaybeRefOrGetter<MovieStage | undefined>) {
  const { catalog } = useServices()
  return useQuery({
    queryKey: computed(() => keys.movies(toValue(complexIds), toValue(stage))),
    queryFn: ({ signal }) => catalog.listMovies({ complexIds: toValue(complexIds), stage: toValue(stage) }, signal),
    placeholderData: keepPreviousData
  })
}

/** Las más vistas en los cines indicados (o en todos si no hay). Se refresca cada 10 minutos. */
export function usePopularMovies(complexIds: MaybeRefOrGetter<string[]>, limit = 5) {
  const { catalog } = useServices()
  return useQuery({
    queryKey: computed(() => keys.popularMovies(toValue(complexIds), limit)),
    queryFn: ({ signal }) => catalog.listMovies({ complexIds: toValue(complexIds), sort: 'popularity', limit }, signal),
    staleTime: 10 * 60_000,
    placeholderData: keepPreviousData
  })
}

export function useMovie(slug: MaybeRefOrGetter<string>) {
  const { catalog } = useServices()
  return useQuery({
    queryKey: computed(() => keys.movie(toValue(slug))),
    queryFn: ({ signal }) => catalog.getMovie(toValue(slug), signal)
  })
}

export function useScreenings(complexIds: MaybeRefOrGetter<string[]>, date: MaybeRefOrGetter<string>, movieId?: MaybeRefOrGetter<string | undefined>) {
  const { catalog } = useServices()
  return useQuery({
    queryKey: computed(() => keys.screenings(toValue(complexIds), toValue(date), toValue(movieId))),
    queryFn: ({ signal }) => catalog.listScreenings({ complexIds: toValue(complexIds), date: toValue(date), movieId: toValue(movieId) }, signal),
    enabled: computed(() => Boolean(toValue(date)) && toValue(complexIds).length > 0),
    placeholderData: keepPreviousData,
    // La ocupación cambia con las ventas: se refresca cada minuto mientras la vista está abierta.
    refetchInterval: 60_000
  })
}

export function useScreeningDates(movieId: MaybeRefOrGetter<string | undefined>, complexIds: MaybeRefOrGetter<string[]>) {
  const { catalog } = useServices()
  return useQuery({
    queryKey: computed(() => keys.screeningDates(toValue(movieId) ?? '', toValue(complexIds))),
    queryFn: ({ signal }) => catalog.listScreeningDates(toValue(movieId)!, toValue(complexIds), signal),
    enabled: computed(() => Boolean(toValue(movieId)) && toValue(complexIds).length > 0)
  })
}

export function useScreening(id: MaybeRefOrGetter<string>) {
  const { catalog } = useServices()
  return useQuery({
    queryKey: computed(() => keys.screening(toValue(id))),
    queryFn: ({ signal }) => catalog.getScreening(toValue(id), signal)
  })
}

export function useProducts(complexId: MaybeRefOrGetter<string | null>) {
  const { food } = useServices()
  return useQuery({
    queryKey: computed(() => keys.products(toValue(complexId) ?? '')),
    queryFn: ({ signal }) => food.listProducts(toValue(complexId)!, signal),
    enabled: computed(() => Boolean(toValue(complexId)))
  })
}

export function useMyPurchases() {
  const { checkout } = useServices()
  return useQuery({ queryKey: keys.purchases(), queryFn: ({ signal }) => checkout.listMyPurchases(signal), staleTime: 0 })
}

export function usePurchase(id: MaybeRefOrGetter<string>) {
  const { checkout } = useServices()
  return useQuery({
    queryKey: computed(() => keys.purchase(toValue(id))),
    queryFn: ({ signal }) => checkout.getPurchase(toValue(id), signal),
    staleTime: 0,
    // Mientras el pago o el reembolso están en proceso se consulta su estado.
    refetchInterval: query => ['payment-pending', 'refund-pending'].includes(query.state.data?.status ?? '') ? 1500 : false
  })
}

export function usePromotions() {
  const { content } = useServices()
  return useQuery({ queryKey: keys.promotions(), queryFn: ({ signal }) => content.listPromotions(signal), staleTime: 5 * 60_000 })
}

export function useHome() {
  const { content } = useServices()
  return useQuery({ queryKey: keys.home(), queryFn: ({ signal }) => content.getHome(signal), staleTime: 5 * 60_000 })
}

export function usePage(slug: MaybeRefOrGetter<string>) {
  const { content } = useServices()
  return useQuery({
    queryKey: computed(() => keys.page(toValue(slug))),
    queryFn: ({ signal }) => content.getPage(toValue(slug), signal),
    staleTime: 10 * 60_000
  })
}

export function useFaq() {
  const { content } = useServices()
  return useQuery({ queryKey: keys.faq(), queryFn: ({ signal }) => content.getFaq(signal), staleTime: 10 * 60_000 })
}
