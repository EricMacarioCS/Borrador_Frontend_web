/**
 * Las fechas de función se muestran siempre en la zona del complejo, no en la del navegador.
 * Un instante viaja como ISO 8601 con zona; una fecha de negocio, como AAAA-MM-DD.
 */
export const DEFAULT_TIME_ZONE = 'America/Mexico_City'

const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** Instante ISO 8601 con zona y fecha válida. */
export function isInstant(value: string): boolean {
  return ISO_INSTANT.test(value) && !Number.isNaN(new Date(value).getTime())
}

export function parseInstant(value: string): Date {
  if (!ISO_INSTANT.test(value)) throw new TypeError(`Instante sin zona horaria: ${value}`)
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) throw new TypeError(`Instante inválido: ${value}`)
  return date
}

export function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false
  const [y, m, d] = value.split('-').map(Number)
  const date = new Date(Date.UTC(y!, m! - 1, d))
  return date.getUTCFullYear() === y && date.getUTCMonth() === m! - 1 && date.getUTCDate() === d
}

const cache = new Map<string, Intl.DateTimeFormat>()
function format(timeZone: string, options: Intl.DateTimeFormatOptions) {
  const key = timeZone + JSON.stringify(options)
  let value = cache.get(key)
  if (!value) {
    value = new Intl.DateTimeFormat('es-MX', { timeZone, ...options })
    cache.set(key, value)
  }
  return value
}

/** Fecha de negocio (AAAA-MM-DD) de un instante en la zona indicada. */
export function dateInZone(instant: Date, timeZone = DEFAULT_TIME_ZONE): string {
  const parts = format(timeZone, { year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(instant)
  const get = (type: string) => parts.find(part => part.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

export function formatTime(instant: Date, timeZone = DEFAULT_TIME_ZONE): string {
  return format(timeZone, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(instant)
}

/** Fecha de negocio legible, sin depender de la zona del navegador. */
export function formatDate(isoDate: string, style: 'long' | 'short' | 'weekday' = 'long'): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const noonUtc = new Date(Date.UTC(y!, m! - 1, d, 12))
  const options: Intl.DateTimeFormatOptions =
    style === 'long' ? { weekday: 'long', day: 'numeric', month: 'long' }
      : style === 'short' ? { day: 'numeric', month: 'short', year: 'numeric' }
        : { weekday: 'short' }
  return format('UTC', options).format(noonUtc).replace('.', '')
}

export function formatDateTime(instant: Date, timeZone = DEFAULT_TIME_ZONE): string {
  return format(timeZone, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .format(instant).replace('.', '')
}

export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const date = new Date(Date.UTC(y!, m! - 1, d! + days))
  return date.toISOString().slice(0, 10)
}

/** Partes de una fecha de negocio para la tira de días. */
export function dayParts(isoDate: string) {
  const [y, m, d] = isoDate.split('-').map(Number)
  const noonUtc = new Date(Date.UTC(y!, m! - 1, d, 12))
  return {
    weekday: format('UTC', { weekday: 'short' }).format(noonUtc).replace('.', '').toUpperCase(),
    day: d!,
    month: format('UTC', { month: 'short' }).format(noonUtc).replace('.', '').toUpperCase()
  }
}

/** Instante de una fecha y hora locales de la zona indicada, considerando sus cambios de horario. */
export function zonedInstant(isoDate: string, time: string, timeZone = DEFAULT_TIME_ZONE): Date {
  const [y, m, d] = isoDate.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  const wallAsUtc = Date.UTC(y!, m! - 1, d, hh, mm)
  let guess = wallAsUtc
  // Dos pasadas bastan para converger incluso cerca de un cambio de horario.
  for (let i = 0; i < 2; i++) {
    const parts = format(timeZone, {
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(new Date(guess))
    const get = (type: string) => Number(parts.find(part => part.type === type)?.value)
    const shown = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'))
    guess += wallAsUtc - shown
  }
  return new Date(guess)
}

export function minutesBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 60000)
}
