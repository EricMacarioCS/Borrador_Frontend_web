import { createBrowserRouter, matchRoutes, type RouteObject } from 'react-router'
import App from '@/App'
import RouteError from './RouteError'

/** Datos de cada ruta que lee el esqueleto de la aplicación. */
export interface RouteHandle {
  title?: string
  /** Flujo de compra a pantalla completa, sin encabezado del sitio. */
  focused?: boolean
}

type ViewModule = Promise<{ default: React.ComponentType }>
/** Cada vista se descarga por separado la primera vez que se visita. */
const view = (load: () => ViewModule) => async () => ({ Component: (await load()).default })

const pages: RouteObject[] = [
  { index: true, lazy: view(() => import('@/features/home/HomeView')), handle: { title: 'Cartelera, boletos y dulcería' } },
  { path: 'cartelera', lazy: view(() => import('@/features/billboard/BillboardView')), handle: { title: 'Cartelera' } },
  { path: 'peliculas/:slug', lazy: view(() => import('@/features/billboard/MovieView')), handle: { title: 'Película' } },
  { path: 'compra/:screeningId', lazy: view(() => import('@/features/checkout/CheckoutView')), handle: { title: 'Compra de boletos', focused: true } },
  { path: 'compras/:purchaseId', lazy: view(() => import('@/features/checkout/PurchaseView')), handle: { title: 'Tu compra' } },
  { path: 'dulceria', lazy: view(() => import('@/features/food/FoodView')), handle: { title: 'Dulcería' } },
  { path: 'dulceria/pago', lazy: view(() => import('@/features/food/FoodCheckoutView')), handle: { title: 'Pago de dulcería', focused: true } },
  { path: 'promociones', lazy: view(() => import('@/features/content/PromotionsView')), handle: { title: 'Promociones' } },
  { path: 'club', lazy: view(() => import('@/features/content/ClubView')), handle: { title: 'Club Cinépolis' } },
  { path: 'mi-cuenta', lazy: view(() => import('@/features/account/AccountView')), handle: { title: 'Mi cuenta' } },
  { path: 'ayuda', lazy: view(() => import('@/features/content/HelpView')), handle: { title: 'Ayuda' } },
  { path: 'legal/:slug', lazy: view(() => import('@/features/content/InfoPageView')), handle: { title: 'Información' } },
  { path: '*', lazy: view(() => import('@/features/content/NotFoundView')), handle: { title: 'Página no encontrada' } }
]

export const routes: RouteObject[] = [
  { path: '/', element: <App />, errorElement: <RouteError />, HydrateFallback: () => null, children: pages }
]

/** Datos de la ruta que corresponde a una dirección, sin navegar. */
export function handleFor(pathname: string): RouteHandle {
  const matches = matchRoutes(routes, pathname, import.meta.env.BASE_URL) ?? []
  return (matches.at(-1)?.route.handle as RouteHandle | undefined) ?? {}
}

export function createAppRouter() {
  return createBrowserRouter(routes, { basename: import.meta.env.BASE_URL })
}
