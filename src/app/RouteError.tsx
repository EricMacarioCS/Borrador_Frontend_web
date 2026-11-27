import { useEffect } from 'react'
import { useLocation, useRouteError } from 'react-router'
import BootError from './BootError'

const CHUNK_ERROR = /dynamically imported module|Importing a module script failed/i

/** Errores al abrir una vista. Tras un despliegue, una pestaña abierta puede pedir un archivo que ya no existe: se recarga una vez. */
export default function RouteError() {
  const error = useRouteError()
  const location = useLocation()
  const stale = CHUNK_ERROR.test(String(error)) && !sessionStorage.getItem('cp-reloaded')

  useEffect(() => {
    if (!stale) {
      console.error('No se pudo mostrar la página', error)
      return
    }
    sessionStorage.setItem('cp-reloaded', '1')
    window.location.assign(location.pathname + location.search)
  }, [stale, error, location])

  return stale ? null : <BootError error={error} />
}
