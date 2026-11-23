/** Búsqueda sin acentos ni mayúsculas. */
export function normalizeText(value: string): string {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()
}

export function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`
}

/** Color estable a partir de un texto, para el arte sin imágenes. */
export function hashHue(value: string): number {
  let hash = 2166136261
  for (const char of value) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619)
  return (hash >>> 0) % 360
}

/** Folio de boletos ya normalizado: CIN-XXXX-XXXX-XXXX en Crockford Base32. */
export const TICKET_CODE_PATTERN = /^CIN-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/
const CODE_BODY = /^([0-9A-HJKMNP-TV-Z]{4})([0-9A-HJKMNP-TV-Z]{4})([0-9A-HJKMNP-TV-Z]{4})$/

/**
 * Normaliza lo que escribe el cliente: acepta espacios, guiones, minúsculas y el prefijo opcional.
 * En los 12 caracteres del código, O se lee como 0 e I/L como 1 (Crockford); el prefijo no se toca.
 */
export function completeTicketCode(value: string): string | null {
  const compact = value.toUpperCase().replace(/[\s-]/g, '').replace(/^CIN/, '')
  const match = CODE_BODY.exec(compact.replace(/O/g, '0').replace(/[IL]/g, '1'))
  return match ? `CIN-${match[1]}-${match[2]}-${match[3]}` : null
}
