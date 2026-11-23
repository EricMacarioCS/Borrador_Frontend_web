import type { ApiError, ErrorCode } from './errors'

/** Mensajes para el cliente. La interfaz decide por código, nunca por el texto del servidor. */
const MESSAGES: Partial<Record<ErrorCode, string>> = {
  NETWORK: 'No hay conexión. Revisa tu red e inténtalo de nuevo.',
  TIMEOUT: 'El servidor tardó demasiado en responder. Inténtalo de nuevo.',
  MALFORMED_RESPONSE: 'Recibimos una respuesta inesperada. Inténtalo más tarde.',
  SERVICE_UNAVAILABLE: 'El servicio no está disponible por el momento.',
  RATE_LIMITED: 'Hiciste demasiados intentos. Espera un momento.',
  VALIDATION_FAILED: 'Revisa los datos marcados.',
  SESSION_REQUIRED: 'Inicia sesión para continuar.',
  SESSION_EXPIRED: 'Tu sesión venció. Vuelve a iniciarla.',
  FORBIDDEN: 'No tienes acceso a esta información.',
  CSRF_INVALID: 'Tu sesión necesita actualizarse. Vuelve a intentarlo.',
  NOT_FOUND: 'No encontramos lo que buscas.',
  TICKET_CODE_NOT_FOUND: 'No encontramos ese folio.',
  TICKET_CODE_EXPIRED: 'La función de ese folio ya terminó.',
  TICKET_CODE_CANCELLED: 'Los boletos de ese folio están cancelados.',
  TICKET_CODE_WRONG_COMPLEX: 'El folio pertenece a otro complejo.',
  SEAT_CONFLICT: 'Alguien más tomó uno de tus asientos. Elige otro.',
  SEAT_LIMIT: 'Superaste el límite de asientos por compra.',
  OUT_OF_STOCK: 'Uno de los productos se agotó. Revisa tu pedido.',
  QUOTE_CHANGED: 'El precio cambió. Revisa el nuevo total.',
  QUOTE_EXPIRED: 'Tu cotización venció. La actualizamos.',
  HOLD_EXPIRED: 'Venció el tiempo para tus asientos. Vuelve a elegirlos.',
  SCREENING_CLOSED: 'Esta función ya no está a la venta.',
  TICKET_TYPE_NOT_ALLOWED: 'Ese tipo de boleto no está disponible para esta función.',
  PROMOTION_NOT_APPLICABLE: 'La promoción no aplica a esta compra.',
  CANCELLATION_WINDOW_CLOSED: 'El plazo para cancelar ya terminó.',
  OTP_INVALID: 'El código no es correcto.',
  OTP_EXPIRED: 'El código venció. Pide uno nuevo.',
  OTP_LOCKED: 'Demasiados intentos. Pide un código nuevo.',
  PAYMENT_DECLINED: 'El pago fue rechazado. No se realizó ningún cargo.',
  IDEMPOTENCY_CONFLICT: 'Esta operación ya se envió con otros datos. Recarga la página.',
  VERSION_CONFLICT: 'La información cambió. Recarga para ver lo más reciente.'
}

export function errorMessage(error: ApiError): string {
  return MESSAGES[error.code] ?? 'Ocurrió un problema. Inténtalo de nuevo.'
}

/** Identificador corto para que soporte encuentre el error en los registros. */
export function supportReference(error: ApiError): string | null {
  return error.traceId ? error.traceId.slice(0, 16) : null
}
