import { useEffect, useLayoutEffect, useRef } from 'react'
import { Outlet, ScrollRestoration, useBlocker, useLocation, useMatches } from 'react-router'
import AppHeader from '@/app/layout/AppHeader'
import AppFooter from '@/app/layout/AppFooter'
import FeedbackHost from '@/app/layout/FeedbackHost'
import ComplexPicker from '@/app/layout/ComplexPicker'
import { useConfig } from '@/app/services'
import { appStore } from '@/app/stores/app'
import { blockReason, confirmLeave, type BlockReason } from '@/app/navigation'
import type { RouteHandle } from '@/app/router'
import styles from './App.module.css'

/** Esqueleto: encabezado, contenido, pie y ventanas globales. */
export default function App() {
  const config = useConfig()
  const location = useLocation()
  const matches = useMatches()
  const handle = (matches.at(-1)?.handle ?? {}) as RouteHandle
  const focused = handle.focused === true

  // Efecto de diseño: corre antes que los de las vistas, que pueden poner un título más específico (la película).
  useLayoutEffect(() => {
    document.title = `${handle.title ?? 'Cinépolis'} · Cinépolis`
  }, [handle.title, location.pathname])

  // El único bloqueo de navegación de la aplicación (ver `app/navigation.ts`).
  const reason = useRef<BlockReason>(null)
  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    reason.current = blockReason(currentLocation, nextLocation)
    return reason.current !== null
  })
  useEffect(() => {
    if (blocker.state !== 'blocked') return
    if (reason.current === 'needs-complex') {
      appStore.getState().askForComplexes(blocker.location.pathname + blocker.location.search)
      blocker.reset()
      return
    }
    let active = true
    void confirmLeave().then(ok => {
      if (!active) return
      if (ok) blocker.proceed()
      else blocker.reset()
    })
    return () => { active = false }
  }, [blocker])

  return (
    <>
      <a className="skip-link" href="#contenido">Saltar al contenido</a>
      {config.apiMode === 'mock' && (
        <div className={styles.demoBar} role="note">Ambiente de demostración: datos simulados, sin cobros reales.</div>
      )}
      {!focused && <AppHeader />}
      <main id="contenido" tabIndex={-1} className={styles.main}>
        {/* La clave por ruta vuelve a montar la vista al cambiar de página, con una transición breve. */}
        <div key={location.pathname} className={styles.page}><Outlet /></div>
      </main>
      {!focused && <AppFooter />}
      <ComplexPicker />
      <FeedbackHost />
      <ScrollRestoration />
    </>
  )
}
