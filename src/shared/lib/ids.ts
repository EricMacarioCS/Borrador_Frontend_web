/** Clave de idempotencia: una por intención del usuario, reutilizada al reintentar. */
export function newIdempotencyKey(): string {
  return crypto.randomUUID()
}

/** Identificador de correlación para rastrear una petición en Kong y en el backend. */
export function newCorrelationId(): string {
  return crypto.randomUUID().replaceAll('-', '')
}
