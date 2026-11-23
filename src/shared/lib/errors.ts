/**
 * Error único para toda la aplicación. El backend responde Problem Details (RFC 9457) con `code`;
 * el simulador lanza este mismo error, así la interfaz no distingue entre ambos.
 */
export const ERROR_CODES = [
  'NETWORK', 'TIMEOUT', 'MALFORMED_RESPONSE', 'UNKNOWN',
  'MALFORMED_REQUEST', 'VALIDATION_FAILED',
  'SESSION_REQUIRED', 'SESSION_EXPIRED', 'FORBIDDEN', 'CSRF_INVALID',
  'NOT_FOUND', 'TICKET_CODE_NOT_FOUND',
  'SEAT_CONFLICT', 'OUT_OF_STOCK', 'VERSION_CONFLICT', 'QUOTE_CHANGED', 'IDEMPOTENCY_CONFLICT', 'RESOURCE_IN_USE',
  'HOLD_EXPIRED', 'QUOTE_EXPIRED', 'SCREENING_CLOSED',
  'SEAT_LIMIT', 'TICKET_TYPE_NOT_ALLOWED', 'PROMOTION_NOT_APPLICABLE',
  'TICKET_CODE_EXPIRED', 'TICKET_CODE_CANCELLED', 'TICKET_CODE_WRONG_COMPLEX',
  'CANCELLATION_WINDOW_CLOSED', 'OTP_INVALID', 'OTP_EXPIRED', 'OTP_LOCKED', 'PAYMENT_DECLINED',
  'RATE_LIMITED', 'SERVICE_UNAVAILABLE'
] as const

export type KnownErrorCode = typeof ERROR_CODES[number]
/** Un código nuevo del backend no rompe la interfaz: se trata como desconocido. */
export type ErrorCode = KnownErrorCode | (string & {})

export interface ApiErrorInit {
  status: number
  code: ErrorCode
  detail?: string
  fields?: Record<string, string[]>
  traceId?: string
  retryAfterSeconds?: number
  extra?: Record<string, unknown>
}

export class ApiError extends Error {
  readonly status: number
  readonly code: ErrorCode
  readonly detail: string | undefined
  readonly fields: Record<string, string[]>
  readonly traceId: string | undefined
  readonly retryAfterSeconds: number | undefined
  readonly extra: Record<string, unknown>

  constructor(init: ApiErrorInit) {
    super(init.detail ?? init.code)
    this.name = 'ApiError'
    this.status = init.status
    this.code = init.code
    this.detail = init.detail
    this.fields = init.fields ?? {}
    this.traceId = init.traceId
    this.retryAfterSeconds = init.retryAfterSeconds
    this.extra = init.extra ?? {}
  }

  /** Errores que vale la pena reintentar en una lectura. */
  get transient(): boolean {
    return this.code === 'NETWORK' || this.code === 'TIMEOUT' || this.status === 429 || this.status >= 500
  }
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error
  if (error instanceof DOMException && error.name === 'TimeoutError') return new ApiError({ status: 0, code: 'TIMEOUT' })
  if (error instanceof TypeError) return new ApiError({ status: 0, code: 'NETWORK', detail: error.message })
  return new ApiError({ status: 0, code: 'UNKNOWN', detail: error instanceof Error ? error.message : String(error) })
}

export const isAbort = (error: unknown) => error instanceof DOMException && error.name === 'AbortError'
