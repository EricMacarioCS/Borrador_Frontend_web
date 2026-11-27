/**
 * Reloj sincronizado con el servidor. Los vencimientos se calculan con `serverNow`
 * para no depender de la hora del dispositivo.
 */
let offsetMs = 0

export function syncClock(serverNowIso: string, requestStartedAt = Date.now()) {
  const server = Date.parse(serverNowIso)
  if (Number.isNaN(server)) return
  // Se toma la mitad del viaje como estimación de la latencia.
  const midpoint = requestStartedAt + (Date.now() - requestStartedAt) / 2
  offsetMs = server - midpoint
}

export function serverNow(): number {
  return Date.now() + offsetMs
}

