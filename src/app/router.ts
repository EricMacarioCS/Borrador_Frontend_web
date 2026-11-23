import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    title?: string
    /** Flujo de compra a pantalla completa, sin encabezado del sitio. */
    focused?: boolean
  }
}

const routes: RouteRecordRaw[] = [
  { path: '/', name: 'home', component: () => import('@/features/home/HomeView.vue'), meta: { title: 'Cartelera, boletos y dulcería' } },
  { path: '/cartelera', name: 'billboard', component: () => import('@/features/billboard/BillboardView.vue'), meta: { title: 'Cartelera' } },
  { path: '/peliculas/:slug', name: 'movie', component: () => import('@/features/billboard/MovieView.vue'), props: true, meta: { title: 'Película' } },
  { path: '/compra/:screeningId', name: 'checkout', component: () => import('@/features/checkout/CheckoutView.vue'), props: true, meta: { title: 'Compra de boletos', focused: true } },
  { path: '/compras/:purchaseId', name: 'purchase', component: () => import('@/features/checkout/PurchaseView.vue'), props: true, meta: { title: 'Tu compra' } },
  { path: '/dulceria', name: 'food', component: () => import('@/features/food/FoodView.vue'), meta: { title: 'Dulcería' } },
  { path: '/dulceria/pago', name: 'food-checkout', component: () => import('@/features/food/FoodCheckoutView.vue'), meta: { title: 'Pago de dulcería', focused: true } },
  { path: '/promociones', name: 'promotions', component: () => import('@/features/content/PromotionsView.vue'), meta: { title: 'Promociones' } },
  { path: '/club', name: 'club', component: () => import('@/features/content/ClubView.vue'), meta: { title: 'Club Cinépolis' } },
  { path: '/mi-cuenta', name: 'account', component: () => import('@/features/account/AccountView.vue'), meta: { title: 'Mi cuenta' } },
  { path: '/ayuda', name: 'help', component: () => import('@/features/content/HelpView.vue'), meta: { title: 'Ayuda' } },
  { path: '/legal/:slug', name: 'page', component: () => import('@/features/content/InfoPageView.vue'), props: true, meta: { title: 'Información' } },
  { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('@/features/content/NotFoundView.vue'), meta: { title: 'Página no encontrada' } }
]

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior(to, from, saved) {
    if (saved) return saved
    if (to.hash) return { el: to.hash }
    if (to.path === from.path) return false
    return { top: 0 }
  }
})

router.afterEach(to => {
  document.title = `${to.meta.title ?? 'Cinépolis'} · Cinépolis`
})

// Tras un despliegue, una pestaña abierta puede pedir un archivo que ya no existe: se recarga una vez.
router.onError((error, to) => {
  if (/dynamically imported module|Importing a module script failed/i.test(String(error)) && !sessionStorage.getItem('cp-reloaded')) {
    sessionStorage.setItem('cp-reloaded', '1')
    window.location.assign(to.fullPath)
  }
})
