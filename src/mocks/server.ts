/**
 * Servidor simulado. Aplica las reglas que debe garantizar el backend real: apartados atómicos,
 * vencimiento absoluto, precios calculados en el servidor, idempotencia, folio y cancelaciones.
 * Responde el mismo JSON del contrato (`src/adapters/http/schemas.ts`).
 */
import type {
  HoldJson, MoneyJson, MovieJson, ProductJson, PurchaseJson, QuoteJson, QuoteRequestJson, ScreeningJson, SeatEventJson,
  SeatLayoutJson, TicketPriceJson, PurchaseRequestJson
} from '@/adapters/http/schemas'
import { dateInZone, formatTime } from '@/shared/lib/datetime'
import {
  CATEGORIES, COMPLEXES, FAQ, HIGHLIGHTS, HOLD_MINUTES, LANGUAGES, LIMITS, MOVIES, PAGES, PRODUCTS, PROJECTIONS, PROMOTIONS,
  POPULARITY, QUOTE_MINUTES, ROOM_TYPES, SERVICE_FEE_CENTS, TICKET_TYPES, TIME_ZONE, childAllowed, findComplex, formatsOf, layoutFor, movieDates,
  optionId, productId, seatIdsOf, stageOf, ticketPriceCents, today, type ComplexFixture, type MovieFixture, type ProductFixture
} from './fixtures'
import { findScreening, hash, presoldSeats, scheduleDays, screeningsFor, type ScreeningFixture } from './schedule'
import { load, publish, save, type MockState, type PurchaseRecord } from './store'

export class MockProblem extends Error {
  constructor(readonly status: number, readonly code: string, readonly detail?: string, readonly extra: Record<string, unknown> = {}) {
    super(code)
  }
}

export interface MockRequest {
  method: string
  path: string
  query: URLSearchParams
  body: unknown
  sid: string
  csrf: string | null
  idempotencyKey: string | null
}
export interface MockResponse { status: number; body?: unknown }

const money = (amount: number): MoneyJson => ({ amount, currency: 'MXN' })
const fail = (status: number, code: string, detail?: string, extra?: Record<string, unknown>): never => {
  throw new MockProblem(status, code, detail, extra)
}

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
function randomCode(length: number) {
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return [...bytes].map(byte => CROCKFORD[byte % 32]).join('')
}

/* Estado de asientos */

function seatState(state: MockState, screening: ScreeningFixture, now: number) {
  const seats: Record<string, 'available' | 'held' | 'sold' | 'blocked'> = {}
  const presold = presoldSeats(screening)
  for (const id of seatIdsOf(layoutFor(screening.room))) seats[id] = presold.has(id) ? 'sold' : 'available'
  for (const hold of Object.values(state.holds)) {
    if (hold.screeningId === screening.id && hold.expiresAt > now) hold.seatIds.forEach(id => { seats[id] = 'held' })
  }
  for (const purchase of Object.values(state.purchases)) {
    if (purchase.screeningId === screening.id && purchase.json.status === 'confirmed') purchase.seatIds.forEach(id => { seats[id] = 'sold' })
  }
  return seats
}

function occupancy(state: MockState, screening: ScreeningFixture, now: number) {
  const seats = Object.values(seatState(state, screening, now))
  return { unavailable: seats.filter(status => status !== 'available').length, capacity: seats.length }
}

/**
 * Vence apartados, confirma pagos y completa reembolsos según la hora. Devuelve los cambios de asientos.
 * En el backend real lo haría un proceso programado; aquí se ejecuta en cada petición y periódicamente.
 */
export function sweep(state: MockState, now: number): SeatEventJson[] {
  const changes: { screeningId: string; changes: SeatEventJson['changes'] }[] = []
  for (const purchase of Object.values(state.purchases)) {
    if (purchase.json.status === 'payment-pending' && purchase.confirmAt <= now) {
      const hold = Object.values(state.holds).find(item => item.id === purchase.holdId)
      if (purchase.declined) {
        purchase.json.status = 'payment-failed'
        releaseStock(state, purchase)
      } else {
        purchase.json.status = 'confirmed'
        if (hold) delete state.holds[hold.id]
        if (purchase.screeningId) changes.push({ screeningId: purchase.screeningId, changes: Object.fromEntries(purchase.seatIds.map(id => [id, 'sold'])) })
      }
    }
    if (purchase.json.status === 'refund-pending' && purchase.refundAt !== null && purchase.refundAt <= now) {
      purchase.json.status = 'refunded'
      purchase.json.refund = { status: 'completed', amount: purchase.json.totals.total }
    }
  }
  for (const hold of Object.values(state.holds)) {
    const pending = Object.values(state.purchases).some(purchase => purchase.holdId === hold.id && purchase.json.status === 'payment-pending')
    if (hold.expiresAt <= now && !pending) {
      delete state.holds[hold.id]
      changes.push({ screeningId: hold.screeningId, changes: Object.fromEntries(hold.seatIds.map(id => [id, 'available'])) })
    }
  }
  return publish(state, changes)
}

function releaseStock(state: MockState, purchase: PurchaseRecord) {
  for (const use of purchase.stock) state.stockUsed[use.key] = Math.max(0, (state.stockUsed[use.key] ?? 0) - use.quantity)
}

/* Conversión de datos por defecto al contrato */

function movieJson(fixture: MovieFixture): MovieJson {
  const { releaseOffset: _r, presaleOffset: _p, lastDayOffset: _l, ...rest } = fixture
  return { ...rest, releaseDate: movieDates(fixture).release, stage: stageOf(fixture) }
}

function screeningStatus(state: MockState, screening: ScreeningFixture, now: number): ScreeningJson['status'] {
  if (screening.startsAt.getTime() <= now) return 'closed'
  const { unavailable, capacity } = occupancy(state, screening, now)
  return unavailable >= capacity ? 'sold-out' : 'on-sale'
}

function screeningJson(state: MockState, screening: ScreeningFixture, now: number): ScreeningJson {
  const { complex, room, movie } = screening
  const prices = TICKET_TYPES
    .filter(type => type.id !== 'tt-child' || childAllowed(movie.rating.code))
    .map(type => ticketPriceCents(complex, room, screening.projection, type.id))
  const layout = layoutFor(room)
  return {
    id: screening.id, movieId: movie.id, complexId: complex.id,
    startsAt: screening.startsAt.toISOString(), endsAt: screening.endsAt.toISOString(), businessDate: screening.date,
    room: { id: room.id, label: `Sala ${room.number}`, type: { code: room.type, name: ROOM_TYPES[room.type].name } },
    projection: { code: screening.projection, name: PROJECTIONS[screening.projection].name },
    language: { code: screening.language, name: LANGUAGES[screening.language] },
    status: screeningStatus(state, screening, now),
    occupancy: occupancy(state, screening, now),
    fromPrice: money(Math.min(...prices)),
    layout: { id: layout.id, version: layout.version }
  }
}

function productJson(state: MockState, complex: ComplexFixture, fixture: ProductFixture): ProductJson {
  const id = productId(complex.id, fixture.n)
  const stockLeft = fixture.stock === undefined ? Infinity : fixture.stock - (state.stockUsed[id] ?? 0)
  // Algunos dulces no se surten en todos los complejos, para mostrar productos no disponibles.
  const unstocked = fixture.category === 'dulces' && hash(`${complex.id}|${fixture.n}`) % 4 === 0
  return {
    id, name: fixture.name, description: fixture.description,
    category: { code: fixture.category, name: CATEGORIES[fixture.category] },
    structure: fixture.structure, basePrice: money(fixture.baseCents),
    available: stockLeft > 0 && !unstocked, requiresTicketCode: fixture.requiresTicketCode,
    rules: fixture.rules.map(rule => ({
      id: `${id}-${rule.key}`, title: rule.title, kind: rule.kind, min: rule.min, max: rule.max, allowSplit: rule.allowSplit ?? false,
      options: rule.options.map(([name, extra, isDefault], index) => ({
        id: optionId(id, rule.key, index), name, extraPrice: money(extra), isDefault: isDefault ?? false, available: true
      }))
    }))
  }
}

function findProduct(complexId: string, id: string) {
  const complex = findComplex(complexId)
  const fixture = PRODUCTS.find(item => productId(complexId, item.n) === id)
  return complex && fixture ? { complex, fixture } : null
}

function cancellation(state: MockState, record: PurchaseRecord, now: number): PurchaseJson['cancellation'] {
  const json = record.json
  if (json.status !== 'confirmed') return { allowed: false, until: null, reason: 'Solo se cancelan compras confirmadas.' }
  const startsAt = json.screening
    ? Date.parse(json.screening.startsAt)
    : Object.values(state.purchases).find(item => item.json.ticketCode && item.json.ticketCode === json.linkedTicketCode)?.json.screening?.startsAt
  const start = typeof startsAt === 'string' ? Date.parse(startsAt) : startsAt
  if (!start) return { allowed: true, until: null, reason: null }
  const until = json.screening ? start - LIMITS.cancelMinutesBefore * 60000 : start
  return now < until
    ? { allowed: true, until: new Date(until).toISOString(), reason: null }
    : { allowed: false, until: new Date(until).toISOString(), reason: json.screening ? `Solo hasta ${LIMITS.cancelMinutesBefore} minutos antes de la función.` : 'El pedido ya se está preparando.' }
}

function purchaseView(state: MockState, record: PurchaseRecord, now: number): PurchaseJson {
  // El folio y el código de acceso solo se entregan con el pago confirmado (después se conservan como referencia).
  const issued = record.json.status !== 'payment-pending' && record.json.status !== 'payment-failed'
  return {
    ...record.json,
    ticketCode: issued ? record.json.ticketCode : null,
    admissionToken: issued ? record.json.admissionToken : null,
    cancellation: cancellation(state, record, now)
  }
}

function ownPurchase(state: MockState, request: MockRequest, id: string): PurchaseRecord {
  const record = state.purchases[id]
  const email = state.sessions[request.sid]?.email
  // Sin acceso se responde 404 para no revelar que existe.
  if (!record || (record.sid !== request.sid && (!email || record.email !== email))) return fail(404, 'NOT_FOUND')
  return record
}

/* Reglas de cotización */

function weekday(date: string) {
  return new Date(`${date}T12:00:00Z`).getUTCDay()
}

function promotionCheck(id: string | null, screening: ScreeningFixture | null) {
  if (!id) return null
  const promotion = PROMOTIONS.find(item => item.id === id)
  if (!promotion) return fail(422, 'PROMOTION_NOT_APPLICABLE', 'La promoción no existe.')
  const reject = (reason: string) => ({ promotion, applied: false, reason })
  if (!promotion.appliesOnline || promotion.rule.kind === 'none') return reject('Esta promoción no se aplica en compras en línea.')
  if (!screening) return reject('Aplica solo a boletos.')
  const { rule } = promotion
  if (rule.weekdays && !rule.weekdays.includes(weekday(screening.date))) return reject('No aplica el día de esta función.')
  if (rule.roomTypes && !rule.roomTypes.includes(screening.room.type)) return reject(`Solo en salas ${rule.roomTypes.map(type => ROOM_TYPES[type].name).join(', ')}.`)
  if (rule.projections && !rule.projections.includes(screening.projection)) return reject(`Solo en ${rule.projections.map(item => PROJECTIONS[item].name).join(', ')}.`)
  if (promotion.id === 'promo-matine' && formatTime(screening.startsAt, TIME_ZONE) >= '15:00') return reject('Solo funciones antes de las 15:00.')
  return { promotion, applied: true, reason: null }
}

function validateChoices(fixture: ProductFixture, product: ProductJson, choices: QuoteRequestJson['items'][number]['choices']) {
  const picked = new Map(choices.map(choice => [choice.ruleId, choice.optionIds]))
  if ([...picked.keys()].some(ruleId => !product.rules.some(rule => rule.id === ruleId))) return fail(422, 'VALIDATION_FAILED', 'Regla desconocida.')
  return product.rules.map((rule, index) => {
    const ids = picked.get(rule.id) ?? []
    if (new Set(ids).size !== ids.length || ids.length < rule.min || ids.length > rule.max) {
      return fail(422, 'VALIDATION_FAILED', `Revisa la opción «${rule.title}».`)
    }
    const options = ids.map(optionIdValue => rule.options.find(option => option.id === optionIdValue && option.available) ?? fail(422, 'VALIDATION_FAILED', 'Opción no disponible.'))
    return { rule, options, split: fixture.rules[index]?.allowSplit === true && options.length > 1 }
  })
}

export function createQuote(state: MockState, request: MockRequest, now: number): QuoteJson {
  const body = request.body as QuoteRequestJson
  const complex = findComplex(body.complexId) ?? fail(422, 'VALIDATION_FAILED', 'Complejo desconocido.')
  let screening: ScreeningFixture | null = null
  let holdExpires = Infinity
  let linkedTicketCode: string | null = null
  const lines: QuoteJson['lines'] = []
  const ticketPrices: number[] = []

  if (body.tickets.length) {
    const hold = (body.holdId && state.holds[body.holdId]) || fail(404, 'NOT_FOUND', 'Apartado inexistente.')
    if (hold.sid !== request.sid) fail(404, 'NOT_FOUND')
    if (hold.expiresAt <= now) fail(410, 'HOLD_EXPIRED')
    const seatIds = body.tickets.map(ticket => ticket.seatId)
    if (seatIds.length !== hold.seatIds.length || seatIds.some(id => !hold.seatIds.includes(id))) fail(422, 'VALIDATION_FAILED', 'Los asientos no coinciden con el apartado.')
    screening = findScreening(hold.screeningId) ?? fail(410, 'SCREENING_CLOSED')
    if (screening.complex.id !== complex.id) fail(422, 'VALIDATION_FAILED', 'El complejo no coincide.')
    if (screening.startsAt.getTime() <= now) fail(410, 'SCREENING_CLOSED')
    holdExpires = hold.expiresAt
    const labels = new Map(layoutFor(screening.room).rows.flatMap(row => row.cells.flatMap(cell => cell ? [[cell.id, cell.label] as const] : [])))
    for (const type of TICKET_TYPES) {
      const seats = body.tickets.filter(ticket => ticket.ticketTypeId === type.id)
      if (!seats.length) continue
      if (type.id === 'tt-child' && !childAllowed(screening.movie.rating.code)) fail(422, 'TICKET_TYPE_NOT_ALLOWED')
      const unit = ticketPriceCents(complex, screening.room, screening.projection, type.id)
      seats.forEach(() => ticketPrices.push(unit))
      lines.push({
        kind: 'ticket', description: `Boleto ${type.name}`, detail: seats.map(seat => labels.get(seat.seatId)).join(', '),
        quantity: seats.length, unitPrice: money(unit), total: money(unit * seats.length)
      })
    }
    if (body.tickets.some(ticket => !TICKET_TYPES.some(type => type.id === ticket.ticketTypeId))) fail(422, 'TICKET_TYPE_NOT_ALLOWED')
  }

  const stock: { key: string; quantity: number }[] = []
  let needsTicketCode = false
  for (const item of body.items) {
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 10) fail(422, 'VALIDATION_FAILED', 'Cantidad inválida.')
    const found = findProduct(complex.id, item.productId) ?? fail(422, 'VALIDATION_FAILED', 'Producto de otro complejo.')
    const product = productJson(state, complex, found.fixture)
    if (!product.available) fail(409, 'OUT_OF_STOCK', product.name, { productId: product.id })
    if (found.fixture.stock !== undefined && (state.stockUsed[product.id] ?? 0) + item.quantity > found.fixture.stock) {
      fail(409, 'OUT_OF_STOCK', product.name, { productId: product.id })
    }
    needsTicketCode ||= product.requiresTicketCode
    const chosen = validateChoices(found.fixture, product, item.choices)
    const extras = chosen.reduce((sum, choice) => sum + (choice.split ? 0 : choice.options.reduce((total, option) => total + option.extraPrice.amount, 0)), 0)
    const unit = found.fixture.baseCents + extras
    const detail = chosen.filter(choice => choice.options.length).map(choice => choice.split
      ? `${choice.options.map(option => option.name).join(' y ')} (mitad y mitad)`
      : choice.options.map(option => option.name).join(', ')).join(' · ')
    lines.push({ kind: 'product', description: product.name, detail, quantity: item.quantity, unitPrice: money(unit), total: money(unit * item.quantity) })
    stock.push({ key: product.id, quantity: item.quantity })
  }

  if (body.items.length && !body.tickets.length) {
    if (needsTicketCode) {
      const grant = (body.ticketCodeGrant && state.grants[body.ticketCodeGrant]) || fail(422, 'VALIDATION_FAILED', 'Valida el folio de tus boletos.')
      if (grant.sid !== request.sid) fail(422, 'VALIDATION_FAILED', 'Valida el folio de tus boletos.')
      if (grant.expiresAt <= now) fail(422, 'TICKET_CODE_EXPIRED')
      if (grant.complexId !== complex.id) fail(422, 'TICKET_CODE_WRONG_COMPLEX')
      linkedTicketCode = grant.ticketCode
      const ticket = Object.values(state.purchases).find(item => item.json.ticketCode === grant.ticketCode)
      screening = ticket?.screeningId ? findScreening(ticket.screeningId) ?? null : null
    }
  }
  if (body.items.length) {
    if (!body.pickup) fail(422, 'VALIDATION_FAILED', 'Elige cuándo recoger tu pedido.')
    if (body.pickup === 'before' && screening && screening.startsAt.getTime() <= now) fail(422, 'VALIDATION_FAILED', 'La función ya comenzó: recoge durante la función.')
  }
  if (!lines.length) fail(422, 'VALIDATION_FAILED', 'La compra está vacía.')

  const check = promotionCheck(body.promotionId, body.tickets.length ? screening : null)
  let discount = 0
  if (check?.applied) {
    const rule = check.promotion.rule
    if (rule.kind === '2x1') discount = [...ticketPrices].sort((a, b) => b - a).reduce((sum, price, i) => sum + (i % 2 ? price : 0), 0)
    if (rule.kind === 'percent') discount = Math.round(ticketPrices.reduce((a, b) => a + b, 0) * (rule.percent ?? 0) / 100)
    if (discount === 0) Object.assign(check, { applied: false, reason: 'Se necesitan al menos dos boletos.' })
  }
  const subtotal = lines.reduce((sum, line) => sum + line.total.amount, 0)
  const fee = body.tickets.length * SERVICE_FEE_CENTS
  const json: QuoteJson = {
    id: `q-${crypto.randomUUID()}`,
    lines,
    subtotal: money(subtotal), discount: money(discount), serviceFee: money(fee), total: money(subtotal - discount + fee),
    promotion: check ? { id: check.promotion.id, title: check.promotion.title, applied: check.applied, reason: check.reason } : null,
    expiresAt: new Date(Math.min(holdExpires, now + QUOTE_MINUTES * 60000)).toISOString()
  }
  state.quotes[json.id] = {
    id: json.id, sid: request.sid, expiresAt: Date.parse(json.expiresAt), request: body, json,
    screeningId: body.tickets.length ? screening?.id ?? null : null, linkedTicketCode, stock
  }
  return json
}

function createPurchase(state: MockState, request: MockRequest, now: number): PurchaseJson {
  const body = request.body as PurchaseRequestJson
  const key = request.idempotencyKey ?? fail(400, 'MALFORMED_REQUEST', 'Falta Idempotency-Key.')
  const fingerprint = JSON.stringify([body.quoteId, body.customer, body.paymentMethod])
  const previous = state.idempotency[key]
  if (previous) {
    if (previous.sid !== request.sid || previous.fingerprint !== fingerprint) fail(409, 'IDEMPOTENCY_CONFLICT')
    return purchaseView(state, state.purchases[previous.resultId]!, now)
  }

  const fields: Record<string, string[]> = {}
  if ((body.customer.firstName ?? '').trim().length < 2) fields.firstName = ['Escribe tu nombre.']
  if ((body.customer.lastName ?? '').trim().length < 2) fields.lastName = ['Escribe tu apellido.']
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((body.customer.email ?? '').trim())) fields.email = ['Escribe un correo válido.']
  if (Object.keys(fields).length) fail(422, 'VALIDATION_FAILED', undefined, { errors: fields })

  const quote = state.quotes[body.quoteId] ?? fail(404, 'NOT_FOUND', 'Cotización inexistente.')
  if (quote.sid !== request.sid) fail(404, 'NOT_FOUND')
  if (quote.expiresAt <= now) fail(410, 'QUOTE_EXPIRED')
  const hold = quote.request.holdId ? state.holds[quote.request.holdId] : null
  if (quote.request.tickets.length && (!hold || hold.expiresAt <= now)) fail(410, 'HOLD_EXPIRED')
  for (const use of quote.stock) {
    const fixture = PRODUCTS.find(item => productId(quote.request.complexId, item.n) === use.key)
    if (fixture?.stock !== undefined && (state.stockUsed[use.key] ?? 0) + use.quantity > fixture.stock) fail(409, 'OUT_OF_STOCK')
  }

  const screening = quote.screeningId ? findScreening(quote.screeningId) ?? null : null
  const complex = findComplex(quote.request.complexId)!
  const labels = screening
    ? new Map(layoutFor(screening.room).rows.flatMap(row => row.cells.flatMap(cell => cell ? [[cell.id, cell.label] as const] : [])))
    : new Map<string, string>()
  const types = new Map<string, string>(TICKET_TYPES.map(type => [type.id, type.name]))
  const hasTickets = quote.request.tickets.length > 0
  const json: PurchaseJson = {
    id: `pu-${crypto.randomUUID()}`, status: 'payment-pending', createdAt: new Date(now).toISOString(),
    complex: { id: complex.id, name: complex.name },
    ticketCode: hasTickets ? `CIN-${randomCode(4)}-${randomCode(4)}-${randomCode(4)}` : null,
    admissionToken: hasTickets ? randomCode(26) : null,
    screening: screening && {
      id: screening.id, movieTitle: screening.movie.title, rating: screening.movie.rating.code, startsAt: screening.startsAt.toISOString(),
      room: `Sala ${screening.room.number}`, roomType: ROOM_TYPES[screening.room.type].name,
      projection: PROJECTIONS[screening.projection].name, language: LANGUAGES[screening.language]
    },
    tickets: quote.request.tickets.map(ticket => ({
      seatLabel: labels.get(ticket.seatId) ?? ticket.seatId,
      ticketType: types.get(ticket.ticketTypeId) ?? '',
      price: money(screening ? ticketPriceCents(complex, screening.room, screening.projection, ticket.ticketTypeId) : 0)
    })),
    items: quote.json.lines.filter(line => line.kind === 'product').map(line => ({ name: line.description, detail: line.detail, quantity: line.quantity, total: line.total })),
    pickup: quote.request.items.length ? quote.request.pickup : null,
    linkedTicketCode: quote.linkedTicketCode,
    totals: { subtotal: quote.json.subtotal, discount: quote.json.discount, serviceFee: quote.json.serviceFee, total: quote.json.total },
    promotionTitle: quote.json.promotion?.applied ? quote.json.promotion.title : null,
    cancellation: { allowed: false, until: null, reason: null },
    refund: { status: 'none', amount: money(0) },
    payment: { kind: 'none' }
  }
  const record: PurchaseRecord = {
    sid: request.sid, holdId: hold?.id ?? null, email: body.customer.email.trim().toLowerCase(), screeningId: quote.screeningId,
    seatIds: quote.request.tickets.map(ticket => ticket.seatId),
    confirmAt: now + 1200 + Math.floor(Math.random() * 800), refundAt: null, stock: quote.stock,
    declined: body.paymentMethod === 'simulated-decline', json
  }
  if (hold) {
    // El apartado se extiende una sola vez mientras se procesa el pago.
    hold.expiresAt = Math.max(hold.expiresAt, now + 5 * 60000)
  }
  for (const use of quote.stock) state.stockUsed[use.key] = (state.stockUsed[use.key] ?? 0) + use.quantity
  state.purchases[json.id] = record
  state.idempotency[key] = { sid: request.sid, scope: 'purchase', fingerprint, resultId: json.id }
  return purchaseView(state, record, now)
}

function cancelPurchase(state: MockState, request: MockRequest, id: string, now: number): { json: PurchaseJson; events: SeatEventJson[] } {
  const record = ownPurchase(state, request, id)
  if (record.json.status === 'refund-pending' || record.json.status === 'refunded') return { json: purchaseView(state, record, now), events: [] }
  const allowed = cancellation(state, record, now)
  if (!allowed.allowed) fail(409, 'CANCELLATION_WINDOW_CLOSED', allowed.reason ?? undefined)
  const affected = [record, ...Object.values(state.purchases).filter(item =>
    record.json.ticketCode && item.json.linkedTicketCode === record.json.ticketCode && item.json.status === 'confirmed')]
  const changes: { screeningId: string; changes: SeatEventJson['changes'] }[] = []
  for (const item of affected) {
    item.json.status = 'refund-pending'
    item.json.refund = { status: 'processing', amount: item.json.totals.total }
    item.refundAt = now + 2500
    releaseStock(state, item)
    if (item.screeningId) changes.push({ screeningId: item.screeningId, changes: Object.fromEntries(item.seatIds.map(seat => [seat, 'available'])) })
  }
  return { json: purchaseView(state, record, now), events: publish(state, changes) }
}

/* Rutas */

/** Parámetros de la ruta; las rutas solo leen los que declaran. */
type Params = [string, string, string]
type Handler = (state: MockState, request: MockRequest, params: Params, now: number) => { response: MockResponse; events?: SeatEventJson[]; mutated?: boolean }
const routes: [string, RegExp, Handler][] = []
const route = (method: string, pattern: string, handler: Handler) =>
  routes.push([method, new RegExp(`^${pattern.replace(/:\w+/g, '([^/]+)')}$`), handler])
const ok = (body: unknown, status = 200) => ({ response: { status, body } })

function ensureSession(state: MockState, sid: string) {
  state.sessions[sid] ??= { csrf: randomCode(24), email: null, name: null, codeAttempts: [] }
  return state.sessions[sid]
}
const sessionJson = (session: MockState['sessions'][string]) => ({
  kind: session.email ? 'customer' : 'guest', email: session.email, displayName: session.name, csrfToken: session.csrf
}) as const

function complexIdsOf(query: URLSearchParams) {
  const ids = query.getAll('complexId').filter(id => findComplex(id))
  return ids.length ? ids : COMPLEXES.map(complex => complex.id)
}

route('GET', '/bootstrap', () => ok({
  serverNow: new Date().toISOString(),
  complexes: COMPLEXES.map(({ baseCents: _b, rooms: _r, ...complex }) => ({ ...complex, formats: formatsOf(findComplex(complex.id)!) })),
  limits: LIMITS
}))

route('GET', '/session', (state, request) => ({ ...ok(sessionJson(ensureSession(state, request.sid))), mutated: true }))

route('POST', '/session/otp', (state, request, _params, now) => {
  const email = String((request.body as { email?: string }).email ?? '').trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(422, 'VALIDATION_FAILED', undefined, { errors: { email: ['Escribe un correo válido.'] } })
  const previous = state.otps[email]
  if (previous && now - previous.sentAt < 30000) fail(429, 'RATE_LIMITED', undefined, { retryAfter: Math.ceil((30000 - (now - previous.sentAt)) / 1000) })
  const code = String(100000 + (crypto.getRandomValues(new Uint32Array(1))[0]! % 900000))
  state.otps[email] = { code, expiresAt: now + 5 * 60000, attempts: 0, sentAt: now }
  return { ...ok({ resendAfterSeconds: 30, devCode: code }), mutated: true }
})

route('POST', '/session/otp/verify', (state, request, _params, now) => {
  const { email: rawEmail, code } = request.body as { email?: string; code?: string }
  const email = String(rawEmail ?? '').trim().toLowerCase()
  const otp = state.otps[email] ?? fail(422, 'OTP_EXPIRED')
  if (otp.expiresAt <= now) fail(422, 'OTP_EXPIRED')
  if (otp.attempts >= 3) fail(422, 'OTP_LOCKED')
  if (otp.code !== String(code ?? '').trim()) {
    otp.attempts++
    save(state)
    fail(422, otp.attempts >= 3 ? 'OTP_LOCKED' : 'OTP_INVALID')
  }
  delete state.otps[email]
  const session = ensureSession(state, request.sid)
  session.email = email
  session.name = null
  session.csrf = randomCode(24)
  return { ...ok(sessionJson(session)), mutated: true }
})

route('DELETE', '/session', (state, request) => {
  const session = ensureSession(state, request.sid)
  session.email = null
  session.name = null
  session.csrf = randomCode(24)
  return { ...ok(sessionJson(session)), mutated: true }
})

/** Popularidad: base de las películas más los boletos confirmados en los complejos consultados. */
function popularity(state: MockState, complexIds: string[]) {
  const scores = new Map(Object.entries(POPULARITY))
  for (const record of Object.values(state.purchases)) {
    if (!record.screeningId || record.json.status !== 'confirmed') continue
    const screening = findScreening(record.screeningId)
    if (!screening || !complexIds.includes(screening.complex.id)) continue
    scores.set(screening.movie.id, (scores.get(screening.movie.id) ?? 0) + record.seatIds.length)
  }
  return scores
}

route('GET', '/movies', (state, request) => {
  const stage = request.query.get('stage')
  const special = request.query.get('specialEvents')
  const sort = request.query.get('sort')
  if (sort !== null && sort !== 'popularity') fail(400, 'MALFORMED_REQUEST', 'sort solo admite popularity.')
  const limit = Number(request.query.get('limit') ?? MOVIES.length)
  if (!Number.isInteger(limit) || limit < 1) fail(400, 'MALFORMED_REQUEST', 'limit debe ser un entero positivo.')
  let list = MOVIES
    .filter(movie => { const { lastDay } = movieDates(movie); return !lastDay || lastDay >= today() })
    .filter(movie => !stage || stageOf(movie) === stage)
    .filter(movie => special === null || String(movie.isSpecialEvent) === special)
  if (sort === 'popularity') {
    const scores = popularity(state, complexIdsOf(request.query))
    list = list.filter(movie => stageOf(movie) !== 'coming-soon').sort((a, b) => (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0))
  }
  return ok({ items: list.slice(0, limit).map(movieJson) })
})

route('GET', '/movies/:slug', (_state, _request, [slug]) => {
  const movie = MOVIES.find(item => item.slug === slug || item.id === slug) ?? fail(404, 'NOT_FOUND')
  return ok(movieJson(movie))
})

route('GET', '/movies/:id/screening-dates', (state, request, [id], now) => {
  const complexes = complexIdsOf(request.query).map(cid => findComplex(cid)!)
  const dates = scheduleDays(LIMITS.scheduleDays).filter(date => complexes.some(complex =>
    screeningsFor(complex, date).some(item => item.movie.id === id && screeningStatus(state, item, now) !== 'closed')))
  return ok({ dates })
})

route('GET', '/screenings', (state, request, _params, now) => {
  const date = request.query.get('date') ?? fail(400, 'MALFORMED_REQUEST', 'Falta date.')
  const movieId = request.query.get('movieId')
  const items = complexIdsOf(request.query).flatMap(id => screeningsFor(findComplex(id)!, date))
    .filter(item => (!movieId || item.movie.id === movieId) && item.startsAt.getTime() > now)
    .map(item => screeningJson(state, item, now))
  return ok({ items })
})

route('GET', '/screenings/:id', (state, _request, [id], now) => ok(screeningJson(state, findScreening(id) ?? fail(404, 'NOT_FOUND'), now)))

route('GET', '/screenings/:id/seats', (state, _request, [id], now) => {
  const screening = findScreening(id) ?? fail(404, 'NOT_FOUND')
  return ok({ screeningId: id, version: state.seatVersions[id] ?? 0, seats: seatState(state, screening, now) })
})

route('GET', '/seat-layouts/:id/versions/:version', (_state, _request, [id, version]) => {
  const room = COMPLEXES.flatMap(complex => complex.rooms).find(item => `lay-${item.id}` === id) ?? fail(404, 'NOT_FOUND')
  const layout = layoutFor(room)
  if (String(layout.version) !== version) fail(404, 'NOT_FOUND')
  return ok(layout satisfies SeatLayoutJson)
})

route('GET', '/screenings/:id/ticket-prices', (_state, _request, [id]) => {
  const screening = findScreening(id) ?? fail(404, 'NOT_FOUND')
  const items: TicketPriceJson[] = TICKET_TYPES.map(type => {
    const allowed = type.id !== 'tt-child' || childAllowed(screening.movie.rating.code)
    return {
      ticketTypeId: type.id, name: type.name, description: type.description,
      price: money(ticketPriceCents(screening.complex, screening.room, screening.projection, type.id)),
      serviceFee: money(SERVICE_FEE_CENTS), allowed,
      reason: allowed ? null : `La clasificación ${screening.movie.rating.code} no admite boleto de niño.`
    }
  })
  return ok({ items })
})

function holdJson(hold: MockState['holds'][string], now: number): HoldJson {
  return { id: hold.id, screeningId: hold.screeningId, seatIds: hold.seatIds, expiresAt: new Date(hold.expiresAt).toISOString(), serverNow: new Date(now).toISOString() }
}

function checkSeats(state: MockState, screening: ScreeningFixture, seatIds: string[], ignoreHoldId: string | null, now: number) {
  const layoutSeats = new Set(seatIdsOf(layoutFor(screening.room)))
  if (!seatIds.length || seatIds.length > LIMITS.maxSeatsPerPurchase) fail(422, 'SEAT_LIMIT')
  if (new Set(seatIds).size !== seatIds.length || seatIds.some(id => !layoutSeats.has(id))) fail(422, 'VALIDATION_FAILED', 'Asiento inexistente.')
  const current = seatState(state, screening, now)
  const own = ignoreHoldId ? new Set(state.holds[ignoreHoldId]?.seatIds ?? []) : new Set<string>()
  const conflicting = seatIds.filter(id => current[id] !== 'available' && !own.has(id))
  if (conflicting.length) fail(409, 'SEAT_CONFLICT', undefined, { conflictingSeatIds: conflicting, seatMapVersion: state.seatVersions[screening.id] ?? 0 })
}

route('POST', '/screenings/:id/holds', (state, request, [id], now) => {
  const seatIds = ((request.body as { seatIds?: string[] }).seatIds ?? []).map(String)
  const key = request.idempotencyKey ?? fail(400, 'MALFORMED_REQUEST', 'Falta Idempotency-Key.')
  const previous = state.idempotency[key]
  const fingerprint = JSON.stringify([id, [...seatIds].sort()])
  if (previous) {
    if (previous.sid !== request.sid || previous.fingerprint !== fingerprint) fail(409, 'IDEMPOTENCY_CONFLICT')
    const existing = state.holds[previous.resultId] ?? fail(410, 'HOLD_EXPIRED')
    return ok(holdJson(existing, now), 201)
  }
  const screening = findScreening(id) ?? fail(404, 'NOT_FOUND')
  if (screening.startsAt.getTime() <= now) fail(410, 'SCREENING_CLOSED')
  // Un apartado activo por función y sesión: el anterior se libera.
  const changes: SeatEventJson['changes'] = {}
  for (const hold of Object.values(state.holds)) {
    const pending = Object.values(state.purchases).some(purchase => purchase.holdId === hold.id && purchase.json.status === 'payment-pending')
    if (hold.sid === request.sid && hold.screeningId === id && !pending) {
      delete state.holds[hold.id]
      hold.seatIds.forEach(seat => { changes[seat] = 'available' })
    }
  }
  checkSeats(state, screening, seatIds, null, now)
  const hold = { id: `h-${crypto.randomUUID()}`, sid: request.sid, screeningId: id, seatIds, expiresAt: now + HOLD_MINUTES * 60000 }
  state.holds[hold.id] = hold
  seatIds.forEach(seat => { changes[seat] = 'held' })
  state.idempotency[key] = { sid: request.sid, scope: 'hold', fingerprint, resultId: hold.id }
  return { ...ok(holdJson(hold, now), 201), events: publish(state, [{ screeningId: id, changes }]), mutated: true }
})

function ownHold(state: MockState, request: MockRequest, id: string, now: number) {
  const hold = state.holds[id]
  if (!hold || hold.sid !== request.sid) return fail(404, 'NOT_FOUND')
  if (hold.expiresAt <= now) return fail(410, 'HOLD_EXPIRED')
  return hold
}

route('GET', '/holds/:id', (state, request, [id], now) => ok(holdJson(ownHold(state, request, id, now), now)))

route('PUT', '/holds/:id/seats', (state, request, [id], now) => {
  const hold = ownHold(state, request, id, now)
  if (Object.values(state.purchases).some(purchase => purchase.holdId === hold.id && purchase.json.status === 'payment-pending')) fail(409, 'RESOURCE_IN_USE')
  const seatIds = ((request.body as { seatIds?: string[] }).seatIds ?? []).map(String)
  const screening = findScreening(hold.screeningId) ?? fail(410, 'SCREENING_CLOSED')
  checkSeats(state, screening, seatIds, hold.id, now)
  const changes: SeatEventJson['changes'] = {}
  hold.seatIds.filter(seat => !seatIds.includes(seat)).forEach(seat => { changes[seat] = 'available' })
  seatIds.filter(seat => !hold.seatIds.includes(seat)).forEach(seat => { changes[seat] = 'held' })
  // El vencimiento no se renueva al cambiar de asientos.
  hold.seatIds = seatIds
  return { ...ok(holdJson(hold, now)), events: publish(state, [{ screeningId: hold.screeningId, changes }]), mutated: true }
})

route('DELETE', '/holds/:id', (state, request, [id]) => {
  const hold = state.holds[id]
  if (!hold || hold.sid !== request.sid) return ok(undefined, 204)
  if (Object.values(state.purchases).some(purchase => purchase.holdId === hold.id && purchase.json.status === 'payment-pending')) fail(409, 'RESOURCE_IN_USE')
  delete state.holds[hold.id]
  const changes = Object.fromEntries(hold.seatIds.map(seat => [seat, 'available' as const]))
  return { ...ok(undefined, 204), events: publish(state, [{ screeningId: hold.screeningId, changes }]), mutated: true }
})

route('POST', '/ticket-code-validations', (state, request, _params, now) => {
  const session = ensureSession(state, request.sid)
  session.codeAttempts = session.codeAttempts.filter(time => now - time < 60000)
  if (session.codeAttempts.length >= 10) fail(429, 'RATE_LIMITED', undefined, { retryAfter: 60 })
  session.codeAttempts.push(now)
  save(state)
  const { code, complexId } = request.body as { code?: string; complexId?: string }
  const purchase = Object.values(state.purchases).find(item => item.json.ticketCode === String(code ?? '').toUpperCase())
  if (!purchase?.json.screening) fail(404, 'TICKET_CODE_NOT_FOUND')
  const json = purchase!.json
  if (json.status !== 'confirmed') fail(422, json.status === 'payment-pending' ? 'TICKET_CODE_NOT_FOUND' : 'TICKET_CODE_CANCELLED')
  const screening = findScreening(purchase!.screeningId!)
  if (!screening || screening.endsAt.getTime() <= now) fail(422, 'TICKET_CODE_EXPIRED')
  if (json.complex.id !== complexId) fail(422, 'TICKET_CODE_WRONG_COMPLEX', undefined, { complexId: json.complex.id })
  const grant = `g-${randomCode(20)}`
  state.grants[grant] = { sid: request.sid, ticketCode: json.ticketCode!, complexId: json.complex.id, expiresAt: screening!.endsAt.getTime() }
  return {
    ...ok({
      grant, ticketCode: json.ticketCode!, complexId: json.complex.id, movieTitle: screening!.movie.title,
      startsAt: screening!.startsAt.toISOString(), endsAt: screening!.endsAt.toISOString()
    }, 201), mutated: true
  }
})

route('POST', '/quotes', (state, request, _params, now) => ({ ...ok(createQuote(state, request, now), 201), mutated: true }))

route('POST', '/purchases', (state, request, _params, now) => ({ ...ok(createPurchase(state, request, now), 201), mutated: true }))

route('GET', '/purchases/by-idempotency-key/:key', (state, request, [key], now) => {
  const previous = state.idempotency[decodeURIComponent(key)]
  if (!previous || previous.sid !== request.sid || previous.scope !== 'purchase') fail(404, 'NOT_FOUND')
  return ok(purchaseView(state, state.purchases[previous!.resultId]!, now))
})

route('GET', '/purchases/:id', (state, request, [id], now) => ok(purchaseView(state, ownPurchase(state, request, id), now)))

route('GET', '/me/purchases', (state, request, _params, now) => {
  const email = state.sessions[request.sid]?.email
  const items = Object.values(state.purchases)
    .filter(item => item.sid === request.sid || (email && item.email === email))
    .sort((a, b) => b.json.createdAt.localeCompare(a.json.createdAt))
    .map(item => purchaseView(state, item, now))
  return ok({ items })
})

route('POST', '/purchases/:id/cancellations', (state, request, [id], now) => {
  const { json, events } = cancelPurchase(state, request, id, now)
  return { ...ok(json), events, mutated: true }
})

route('GET', '/complexes/:id/products', (state, _request, [id]) => {
  const complex = findComplex(id) ?? fail(404, 'NOT_FOUND')
  return ok({ items: PRODUCTS.map(fixture => productJson(state, complex, fixture)) })
})

route('GET', '/promotions', () => ok({
  items: PROMOTIONS.map(({ rule: _rule, ...promotion }) => ({ ...promotion, validFrom: today(), validTo: null }))
}))

route('GET', '/content/home', () => ok({
  featuredMovieIds: MOVIES.filter(movie => stageOf(movie) !== 'coming-soon').slice(0, 5).map(movie => movie.id),
  highlights: HIGHLIGHTS
}))

route('GET', '/content/pages/:slug', (_state, _request, [slug]) => {
  const page = PAGES[slug] ?? fail(404, 'NOT_FOUND')
  return ok({ slug: slug, ...page })
})

route('GET', '/content/faq', () => ok(FAQ))

/** Atiende una petición dentro de una "transacción" sobre el estado. */
export function handle(request: MockRequest): { response: MockResponse; events: SeatEventJson[] } {
  const now = Date.now()
  const state = load()
  const swept = sweep(state, now)
  try {
    const match = routes.find(([method, pattern]) => method === request.method && pattern.test(request.path))
    if (!match) return { response: problem(404, 'NOT_FOUND', `Ruta simulada inexistente: ${request.method} ${request.path}`), events: swept }
    if (request.method !== 'GET' && request.path !== '/session') {
      const session = ensureSession(state, request.sid)
      if (request.csrf !== session.csrf) return { response: problem(403, 'CSRF_INVALID'), events: swept }
    }
    const params = match[1].exec(request.path)!.slice(1).map(decodeURIComponent) as Params
    const result = match[2](state, request, params, now)
    save(state)
    return { response: result.response, events: [...swept, ...(result.events ?? [])] }
  } catch (error) {
    if (swept.length) save(state)
    if (error instanceof MockProblem) return { response: problem(error.status, error.code, error.detail, error.extra), events: swept }
    console.error('Error del simulador', error)
    return { response: problem(500, 'UNKNOWN', String(error)), events: swept }
  }
}

function problem(status: number, code: string, detail?: string, extra: Record<string, unknown> = {}): MockResponse {
  return { status, body: { type: `/problems/${code.toLowerCase()}`, title: code, status, code, detail, traceId: crypto.randomUUID().replaceAll('-', ''), ...extra } }
}

/** Para el canal de tiempo real: vence apartados aunque nadie haga peticiones. */
export function sweepNow(): SeatEventJson[] {
  const state = load()
  const events = sweep(state, Date.now())
  if (events.length || Object.values(state.purchases).some(item => item.json.status === 'payment-pending')) save(state)
  return events
}

export const businessToday = () => dateInZone(new Date(), TIME_ZONE)
