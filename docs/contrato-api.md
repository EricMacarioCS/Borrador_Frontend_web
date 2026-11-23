# Contrato del API público (`/api/v1`)

Lo que el frontend espera del backend. La fuente de verdad ejecutable son los esquemas de [`src/adapters/http/schemas.ts`](../src/adapters/http/schemas.ts) y las pruebas de [`src/mocks/contract.test.ts`](../src/mocks/contract.test.ts). Si algo aquí no conviene al backend, se acuerda y se cambia en esos dos lugares.

## Convenciones

| Tema | Regla |
| --- | --- |
| Formato | JSON en camelCase. Listas como `{ "items": [...] }`. |
| Identificadores | Siempre texto, aunque en la BD sean enteros. |
| Dinero | `{ "amount": 8500, "currency": "MXN" }`, con `amount` en **centavos enteros**. |
| Instantes | ISO 8601 **con zona** (`2026-11-24T19:30:00-06:00` o `...Z`). Un instante sin zona se rechaza como respuesta inválida. |
| Fechas de negocio | `AAAA-MM-DD` en la zona del complejo (la función de las 00:30 pertenece al día anterior si así lo decide el negocio). |
| Enumeraciones | Texto. Un valor nuevo no rompe la interfaz: se trata con un valor seguro (por ejemplo, función no vendible). |
| Errores | Problem Details (RFC 9457) con `code` estable; ver la tabla de errores. |
| Correlación | El cliente manda `X-Correlation-Id` en cada petición; el error puede devolver `traceId` para soporte. |
| Sesión | Cookie `HttpOnly; Secure; SameSite=Lax` emitida por el backend. Las escrituras llevan `X-CSRF-Token` con el valor de `GET /session`. |
| Idempotencia | `Idempotency-Key` (UUID) en crear apartado, crear compra y cancelar. Repetir la misma clave devuelve el mismo resultado. |

## Endpoints

| Método y ruta | Uso | Notas |
| --- | --- | --- |
| `GET /bootstrap` | Complejos, límites y `serverNow` | Se llama al arrancar. `serverNow` corrige el reloj del cliente para los contadores. |
| `GET /session` | Sesión actual y token CSRF | Crea la sesión de invitado si no existe. |
| `POST /session/otp` | Pide código al correo | `{ email }` → `{ resendAfterSeconds, devCode }`; `devCode` siempre `null` fuera de pruebas. |
| `POST /session/otp/verify` | Verifica el código | `{ email, code }` → sesión de cliente. Límite de intentos (`OTP_LOCKED`). |
| `DELETE /session` | Cierra sesión | |
| `GET /movies?complexId=&stage=&specialEvents=` | Cartelera | `complexId` se repite por cada complejo. |
| `GET /movies/{slug}` | Detalle de película | También acepta el id. |
| `GET /movies/{id}/screening-dates?complexId=` | Días con funciones a la venta | |
| `GET /screenings?complexId=&date=&movieId=` | Funciones de un día | Incluye ocupación y precio desde. |
| `GET /screenings/{id}` | Una función | Incluye `layout { id, version }`. |
| `GET /seat-layouts/{id}/versions/{version}` | Plano de la sala | Inmutable por versión: el cliente lo guarda en caché. |
| `GET /screenings/{id}/seats` | Foto del estado de asientos | `{ version, seats: { [seatId]: "available" \| "held" \| "sold" \| "blocked" } }` |
| `GET /screenings/{id}/ticket-prices` | Tipos de boleto y precio | Cada tipo dice si está permitido y por qué no (por ejemplo, niños en clasificación C). |
| `POST /screenings/{id}/holds` | Apartar asientos | Atómico. `409 SEAT_CONFLICT` con `conflictingSeatIds`. Libera el apartado anterior de la misma sesión en esa función. |
| `GET /holds/{id}` | Recuperar apartado | Tras recargar la página. |
| `PUT /holds/{id}/seats` | Cambiar asientos | **No** renueva `expiresAt`. |
| `DELETE /holds/{id}` | Liberar | |
| `POST /ticket-code-validations` | Validar folio para dulcería | `{ code, complexId }` → `grant` de corta vida. |
| `POST /quotes` | Cotizar | El servidor calcula todo. Responde líneas, descuento, cargo, total, `expiresAt` y el motivo si la promoción no aplica. |
| `POST /purchases` | Comprar | `{ quoteId, customer, paymentMethod }`. Responde `payment-pending` y, con pasarela, `payment.kind = "redirect"`. |
| `GET /purchases/{id}` | Estado de la compra | El cliente consulta cada 1.5 s mientras esté pendiente. |
| `GET /purchases/by-idempotency-key/{key}` | Recuperar compra si se perdió la respuesta | `404` si no existe. |
| `GET /me/purchases` | Compras de la sesión o del correo verificado | |
| `POST /purchases/{id}/cancellations` | Cancelar con reembolso | Cancela también alimentos ligados al folio. |
| `GET /complexes/{id}/products` | Dulcería del complejo | Productos con reglas de personalización. |
| `GET /promotions` | Promociones vigentes | |
| `GET /content/home`, `/content/pages/{slug}`, `/content/faq` | Contenido | Podría venir de un CMS. |

### Reglas que el backend debe garantizar

1. **Apartado atómico.** Dos clientes no pueden apartar el mismo asiento. En PostgreSQL: restricción única parcial sobre `(funcion_id, asiento)` para apartados vigentes y ventas, o `UPDATE ... WHERE estado = 'disponible'` con verificación de filas afectadas, dentro de una transacción.
2. **Vencimiento absoluto.** Un apartado dura 10 minutos desde su creación; cambiar asientos no lo renueva. Mientras un pago está en proceso se extiende una sola vez.
3. **La cotización es del servidor.** El cliente manda identificadores; el importe cobrado sale de la cotización vigente. Si los precios cambiaron, `409 QUOTE_CHANGED`.
4. **Folio solo con pago confirmado.** `ticketCode` y `admissionToken` son `null` mientras el pago está pendiente o fue rechazado.
5. **Pago rechazado conserva el apartado** para reintentar con otra cotización y otra clave de idempotencia.
6. **Cancelación** hasta 60 minutos antes de la función (`cancellation.until`), con reembolso asíncrono (`refund-pending` → `refunded`).
7. **Privacidad.** Una compra ajena responde `404`, no `403`.

## Estados

- Compra: `payment-pending`, `confirmed`, `payment-failed`, `refund-pending`, `refunded`, `cancelled`.
- Función: `on-sale`, `sold-out`, `closed`, `cancelled`.
- Etapa de película: `coming-soon`, `presale`, `premiere`, `now-showing`.

## Errores (`code`)

| Código | HTTP | Qué hace la interfaz |
| --- | --- | --- |
| `VALIDATION_FAILED`, `MALFORMED_REQUEST` | 400/422 | Muestra `detail` o los errores por campo (`errors`). |
| `SESSION_REQUIRED`, `SESSION_EXPIRED` | 401 | Pide volver a entrar. |
| `CSRF_INVALID` | 403 | Vuelve a pedir la sesión y reintenta una vez. |
| `NOT_FOUND`, `TICKET_CODE_NOT_FOUND` | 404 | Mensaje de no encontrado. |
| `SEAT_CONFLICT` | 409 | Quita los asientos en disputa, refresca el mapa y avisa. |
| `QUOTE_CHANGED`, `VERSION_CONFLICT`, `IDEMPOTENCY_CONFLICT` | 409 | Recotiza o recarga. |
| `CANCELLATION_WINDOW_CLOSED` | 409 | Explica el límite. |
| `HOLD_EXPIRED`, `QUOTE_EXPIRED`, `SCREENING_CLOSED` | 410 | Regresa a elegir asientos o recotiza. |
| `SEAT_LIMIT`, `TICKET_TYPE_NOT_ALLOWED`, `PROMOTION_NOT_APPLICABLE`, `OUT_OF_STOCK` | 422 | Mensaje específico. |
| `TICKET_CODE_EXPIRED`, `TICKET_CODE_CANCELLED`, `TICKET_CODE_WRONG_COMPLEX` | 422 | Mensaje en el campo de folio. |
| `OTP_INVALID`, `OTP_EXPIRED`, `OTP_LOCKED` | 422/429 | Mensaje en el formulario. |
| `PAYMENT_DECLINED` | 402 | Permite reintentar. |
| `RATE_LIMITED` | 429 | Respeta `Retry-After`. |
| `SERVICE_UNAVAILABLE` | 5xx | Reintenta lecturas; nunca una escritura sin clave de idempotencia. |

Kong puede responder HTML o cuerpo vacío en 502/503/504: el cliente lo tolera y lo clasifica por estado HTTP.

## Tiempo real (SignalR, `/hubs/seats`)

- El cliente invoca `SubscribeScreening(screeningId)` y `UnsubscribeScreening(screeningId)`.
- El hub envía `SeatsChanged({ screeningId, version, changes: { [seatId]: estado } })`.
- `version` es un contador **por función** que sube de uno en uno con cada cambio. El cliente aplica el evento si es el siguiente, ignora repetidos y, si detecta un hueco, pide la foto completa (`GET /screenings/{id}/seats`).
- El hub solo avisa; todas las operaciones van por REST. Tras reconectar, el cliente vuelve a suscribirse y pide la foto.
- Con varias instancias del backend se necesita un backplane (Redis) o Azure SignalR.
