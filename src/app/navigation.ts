/**
 * Guardias de navegación. React Router solo admite un bloqueo a la vez, así que `App` tiene el único
 * `useBlocker` y aquí se registran las reglas: la compra pide confirmación al salir y una película pide cine.
 */
import type { Location } from 'react-router'
import { appStore } from './stores/app'
import { handleFor } from './router'

type LeaveGuard = () => Promise<boolean>
let leaveGuard: LeaveGuard | null = null

/** La vista activa pide confirmar antes de salir (por ejemplo, la compra con asientos apartados). `null` lo quita. */
export function setLeaveGuard(guard: LeaveGuard | null) {
  leaveGuard = guard
}

export type BlockReason = 'leave' | 'needs-complex' | null

/**
 * Por qué se detiene una navegación. La primera carga (un enlace directo) no pasa por aquí: la vista pide el cine.
 * Para ver una película hace falta al menos un cine; sin cine se abre el selector y se continúa al elegir.
 */
export function blockReason(current: Location, next: Location): BlockReason {
  if (current.pathname === next.pathname) return null
  if (leaveGuard) return 'leave'
  const toMovie = /^\/peliculas\/[^/]+\/?$/.test(next.pathname)
  if (toMovie && !handleFor(current.pathname).focused && !appStore.getState().selectedComplexIds.length) return 'needs-complex'
  return null
}

export async function confirmLeave(): Promise<boolean> {
  return leaveGuard ? leaveGuard() : true
}
