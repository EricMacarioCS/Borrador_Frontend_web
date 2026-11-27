import '@fontsource-variable/inter'
import '@fontsource-variable/montserrat'
import './styles/tokens.css'
import './styles/base.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import BootError from './app/BootError'
import { loadConfig } from './app/config'
import { ConfigContext, createServices, ServicesContext } from './app/services'
import { createAppRouter } from './app/router'
import { appStore } from './app/stores/app'
import { ApiError } from './shared/lib/errors'

const root = createRoot(document.getElementById('app')!)

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

  // Datos mínimos para dibujar el sitio: complejos, límites, reloj y sesión.
  const [bootstrap, session] = await Promise.all([services.catalog.bootstrap(), services.account.getSession()])
  appStore.getState().setComplexes(bootstrap.complexes, bootstrap.limits)
  appStore.getState().setSession(session)

  // Se espera a que la primera vista se descargue para no mostrar la página vacía.
  const router = createAppRouter()
  if (!router.state.initialized) {
    await new Promise<void>(resolve => {
      const stop = router.subscribe(state => {
        if (state.initialized) { stop(); resolve() }
      })
    })
  }

  root.render(
    <StrictMode>
      <ConfigContext value={config}>
        <ServicesContext value={services}>
          <QueryClientProvider client={queryClient}>
            <RouterProvider router={router} />
          </QueryClientProvider>
        </ServicesContext>
      </ConfigContext>
    </StrictMode>
  )
  sessionStorage.removeItem('cp-reloaded')
}

start().catch((error: unknown) => {
  console.error('No se pudo iniciar la aplicación', error)
  root.render(<BootError error={error} />)
})
