/**
 * Consultas al servidor con caché (TanStack Query). Las vistas usan estos hooks
 * y nunca llaman a los puertos directamente para leer datos.
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query'
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

export function useMovies(complexIds: string[], stage?: MovieStage) {
  const { catalog } = useServices()
  return useQuery({
    queryKey: keys.movies(complexIds, stage),
    queryFn: ({ signal }) => catalog.listMovies({ complexIds, stage }, signal),
    placeholderData: keepPreviousData
  })
}

/** Las más vistas en los cines indicados (o en todos si no hay). Se refresca cada 10 minutos. */
export function usePopularMovies(complexIds: string[], limit = 5) {
  const { catalog } = useServices()
  return useQuery({
    queryKey: keys.popularMovies(complexIds, limit),
    queryFn: ({ signal }) => catalog.listMovies({ complexIds, sort: 'popularity', limit }, signal),
    staleTime: 10 * 60_000,
    placeholderData: keepPreviousData
  })
}

export function useMovie(slug: string) {
  const { catalog } = useServices()
  return useQuery({
    queryKey: keys.movie(slug),
    queryFn: ({ signal }) => catalog.getMovie(slug, signal)
  })
}

export function useScreenings(complexIds: string[], date: string, movieId?: string) {
  const { catalog } = useServices()
  return useQuery({
    queryKey: keys.screenings(complexIds, date, movieId),
    queryFn: ({ signal }) => catalog.listScreenings({ complexIds, date, movieId }, signal),
    enabled: Boolean(date) && complexIds.length > 0,
    placeholderData: keepPreviousData,
    // La ocupación cambia con las ventas: se refresca cada minuto mientras la vista está abierta.
    refetchInterval: 60_000
  })
}

export function useScreeningDates(movieId: string | undefined, complexIds: string[]) {
  const { catalog } = useServices()
  return useQuery({
    queryKey: keys.screeningDates(movieId ?? '', complexIds),
    queryFn: ({ signal }) => catalog.listScreeningDates(movieId!, complexIds, signal),
    enabled: Boolean(movieId) && complexIds.length > 0
  })
}

export function useScreening(id: string) {
  const { catalog } = useServices()
  return useQuery({
    queryKey: keys.screening(id),
    queryFn: ({ signal }) => catalog.getScreening(id, signal)
  })
}

export function useProducts(complexId: string | null) {
  const { food } = useServices()
  return useQuery({
    queryKey: keys.products(complexId ?? ''),
    queryFn: ({ signal }) => food.listProducts(complexId!, signal),
    enabled: Boolean(complexId)
  })
}

export function useMyPurchases() {
  const { checkout } = useServices()
  return useQuery({ queryKey: keys.purchases(), queryFn: ({ signal }) => checkout.listMyPurchases(signal), staleTime: 0 })
}

export function usePurchase(id: string) {
  const { checkout } = useServices()
  return useQuery({
    queryKey: keys.purchase(id),
    queryFn: ({ signal }) => checkout.getPurchase(id, signal),
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

export function usePage(slug: string) {
  const { content } = useServices()
  return useQuery({
    queryKey: keys.page(slug),
    queryFn: ({ signal }) => content.getPage(slug, signal),
    staleTime: 10 * 60_000
  })
}

export function useFaq() {
  const { content } = useServices()
  return useQuery({ queryKey: keys.faq(), queryFn: ({ signal }) => content.getFaq(signal), staleTime: 10 * 60_000 })
}
