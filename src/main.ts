import '@fontsource-variable/inter'
import '@fontsource-variable/montserrat'
import './styles/tokens.css'
import './styles/base.css'

import { createApp, h } from 'vue'
import { createPinia } from 'pinia'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import App from './App.vue'
import BootError from './app/BootError.vue'
import { loadConfig } from './app/config'
import { ConfigKey, createServices, ServicesKey } from './app/services'
import { router } from './app/router'
import { useAppStore } from './app/stores/app'
import { ApiError } from './shared/lib/errors'

async function start() {
  const config = await loadConfig()
  const services = await createServices(config)

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: true,
        // Los errores 4xx no se reintentan; los temporales ya los reintenta el cliente HTTP.
        retry: (count, error) => count < 1 && !(error instanceof ApiError && error.status >= 400 && error.status < 500)
      }
    }
  })

  const pinia = createPinia()
  const app = createApp(App)
  app.provide(ServicesKey, services)
  app.provide(ConfigKey, config)
  app.use(pinia)
  app.use(VueQueryPlugin, { queryClient })

  // Datos mínimos para dibujar el sitio: complejos, límites, reloj y sesión.
  const store = useAppStore(pinia)
  const [bootstrap, session] = await Promise.all([services.catalog.bootstrap(), services.account.getSession()])
  store.setComplexes(bootstrap.complexes, bootstrap.limits)
  store.session = session

  app.use(router)
  await router.isReady()
  app.mount('#app')
  sessionStorage.removeItem('cp-reloaded')
}

start().catch((error: unknown) => {
  console.error('No se pudo iniciar la aplicación', error)
  createApp({ render: () => h(BootError, { error }) }).mount('#app')
})
