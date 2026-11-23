/**
 * Reglas del servidor, probadas a través de los adaptadores HTTP reales.
 * Sirven como especificación ejecutable para el backend: el API de .NET debe pasar
 * por los mismos casos (apartado atómico, cotización del servidor, idempotencia, folio, cancelación).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockBackend } from '@/mocks'
import { resetForTests } from '@/mocks/store'
import { businessToday } from '@/mocks/server'
import { createHttpAdapters } from '@/adapters/http/adapters'
import { addDays } from '@/shared/lib/datetime'
import { ApiError } from '@/shared/lib/errors'
import type { Customer } from '@/domain/models'

const SESSION_KEY = 'cp-mock-session'
const customer: Customer = { firstName: 'Ana', lastName: 'Prueba', email: 'ana@ejemplo.com' }

/** Un cliente con su propia "cookie" de sesión. Las llamadas se hacen una tras otra. */
function client(sid: string) {
  const backend = createMockBackend({ baseUrl: '/api/v1', latencyMs: [0, 0], failureRate: 0 })
  const fetchImpl: typeof fetch = (input, init) => {
    localStorage.setItem(SESSION_KEY, sid)
    return backend.fetchImpl(input, init)
  }
  return createHttpAdapters({ baseUrl: '/api/v1', fetchImpl })
}

async function rejection(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise
  } catch (error) {
    if (error instanceof ApiError) return error
    throw error
  }
  throw new Error('Se esperaba un error')
}

function advance(ms: number) {
  vi.setSystemTime(new Date(Date.now() + ms))
}

async function setup() {
  const a = client('sesion-a')
  const b = client('sesion-b')
  await a.account.getSession()
  await b.account.getSession()
  const screenings = await a.catalog.listScreenings({ complexIds: ['xal-centro'], date: addDays(businessToday(), 1) })
  const screening = screenings.find(item => item.status === 'on-sale')
  if (!screening) throw new Error('Sin funciones a la venta mañana')
  const snapshot = await a.seats.getSeatState(screening.id)
  const free = Object.entries(snapshot.seats).filter(([, status]) => status === 'available').map(([id]) => id)
  return { a, b, screening, free }
}

async function buy(ports: ReturnType<typeof client>, screening: { id: string; complexId: string }, seatIds: string[], method = 'simulated-approve') {
  const hold = await ports.checkout.createHold(screening.id, seatIds, crypto.randomUUID())
  const quote = await ports.checkout.createQuote({
    complexId: screening.complexId, holdId: hold.id, ticketCodeGrant: null,
    tickets: seatIds.map(seatId => ({ seatId, ticketTypeId: 'tt-general' })),
    items: [], promotionId: null, pickup: null
  })
  const key = crypto.randomUUID()
  const purchase = await ports.checkout.createPurchase({ quoteId: quote.id, customer, paymentMethod: method }, key)
  return { hold, quote, purchase, key }
}

beforeEach(() => {
  resetForTests()
  vi.useFakeTimers({ toFake: ['Date'] })
})
afterEach(() => {
  vi.useRealTimers()
})

describe('apartado de asientos', () => {
  it('es atómico: el segundo cliente recibe SEAT_CONFLICT con los asientos en disputa', async () => {
    const { a, b, screening, free } = await setup()
    const [s1, s2, s3] = free as [string, string, string]
    await a.checkout.createHold(screening.id, [s1, s2], crypto.randomUUID())

    const error = await rejection(b.checkout.createHold(screening.id, [s2, s3], crypto.randomUUID()))
    expect(error.status).toBe(409)
    expect(error.code).toBe('SEAT_CONFLICT')
    expect(error.extra.conflictingSeatIds).toEqual([s2])

    const seen = await b.seats.getSeatState(screening.id)
    expect(seen.seats[s1]).toBe('held')
    expect(seen.seats[s3]).toBe('available')
  })

  it('repetir la misma petición con la misma clave devuelve el mismo apartado', async () => {
    const { a, screening, free } = await setup()
    const key = crypto.randomUUID()
    const first = await a.checkout.createHold(screening.id, [free[0]!], key)
    const again = await a.checkout.createHold(screening.id, [free[0]!], key)
    expect(again.id).toBe(first.id)
  })

  it('cambiar asientos no renueva el vencimiento, y al vencer se liberan', async () => {
    const { a, b, screening, free } = await setup()
    const hold = await a.checkout.createHold(screening.id, [free[0]!], crypto.randomUUID())
    advance(5 * 60000)
    const updated = await a.checkout.updateHold(hold.id, [free[0]!, free[1]!])
    expect(updated.expiresAt.getTime()).toBe(hold.expiresAt.getTime())

    advance(6 * 60000)
    const error = await rejection(a.checkout.getHold(hold.id))
    expect(['HOLD_EXPIRED', 'NOT_FOUND']).toContain(error.code)
    const seen = await b.seats.getSeatState(screening.id)
    expect(seen.seats[free[0]!]).toBe('available')
  })
})

describe('cotización y compra', () => {
  it('el total lo calcula el servidor: precio del boleto más cargo por servicio', async () => {
    const { a, screening, free } = await setup()
    const prices = await a.checkout.getTicketPrices(screening.id)
    const general = prices.find(price => price.ticketTypeId === 'tt-general')!
    const { quote } = await buy(a, screening, [free[0]!])
    expect(quote.totalCents).toBe(general.priceCents + quote.serviceFeeCents)
    expect(quote.serviceFeeCents).toBe(600)
  })

  it('explica por qué no aplica una promoción en lugar de ignorarla', async () => {
    const { a, screening, free } = await setup()
    const hold = await a.checkout.createHold(screening.id, [free[0]!], crypto.randomUUID())
    const quote = await a.checkout.createQuote({
      complexId: screening.complexId, holdId: hold.id, ticketCodeGrant: null,
      tickets: [{ seatId: free[0]!, ticketTypeId: 'tt-general' }], items: [], promotionId: 'promo-msi', pickup: null
    })
    expect(quote.promotion?.applied).toBe(false)
    expect(quote.promotion?.reason).toBeTruthy()
    expect(quote.discountCents).toBe(0)
  })

  it('crear la compra es idempotente y se puede recuperar por su clave', async () => {
    const { a, screening, free } = await setup()
    const { quote, purchase, key } = await buy(a, screening, [free[0]!])
    const repeated = await a.checkout.createPurchase({ quoteId: quote.id, customer, paymentMethod: 'simulated-approve' }, key)
    expect(repeated.id).toBe(purchase.id)
    expect((await a.checkout.findPurchaseByKey(key))?.id).toBe(purchase.id)
  })

  it('el pago se confirma de forma asíncrona y solo entonces se entrega el folio', async () => {
    const { a, screening, free } = await setup()
    const { purchase } = await buy(a, screening, [free[0]!])
    expect(purchase.status).toBe('payment-pending')
    expect(purchase.ticketCode).toBeNull()

    advance(3000)
    const confirmed = await a.checkout.getPurchase(purchase.id)
    expect(confirmed.status).toBe('confirmed')
    expect(confirmed.ticketCode).toMatch(/^CIN-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/)
    expect((await a.seats.getSeatState(screening.id)).seats[free[0]!]).toBe('sold')
  })

  it('un pago rechazado no entrega folio y conserva el apartado para reintentar', async () => {
    const { a, screening, free } = await setup()
    const { hold, purchase } = await buy(a, screening, [free[0]!], 'simulated-decline')
    advance(3000)
    const failed = await a.checkout.getPurchase(purchase.id)
    expect(failed.status).toBe('payment-failed')
    expect(failed.ticketCode).toBeNull()
    expect((await a.checkout.getHold(hold.id)).seatIds).toEqual([free[0]])
  })
})

describe('folio y cancelación', () => {
  it('el folio solo sirve en el complejo de la función', async () => {
    const { a, screening, free } = await setup()
    const { purchase } = await buy(a, screening, [free[0]!])
    advance(3000)
    const code = (await a.checkout.getPurchase(purchase.id)).ticketCode!

    const grant = await a.checkout.validateTicketCode(code, screening.complexId)
    expect(grant.ticketCode).toBe(code)
    const error = await rejection(a.checkout.validateTicketCode(code, 'ver-boulevard'))
    expect(error.code).toBe('TICKET_CODE_WRONG_COMPLEX')
  })

  it('cancela con reembolso antes de la ventana y lo rechaza después', async () => {
    const { a, screening, free } = await setup()
    const first = await buy(a, screening, [free[0]!])
    const second = await buy(a, screening, [free[1]!])
    advance(3000)

    const cancelled = await a.checkout.cancelPurchase(first.purchase.id, crypto.randomUUID())
    expect(cancelled.status).toBe('refund-pending')
    advance(3000)
    expect((await a.checkout.getPurchase(first.purchase.id)).status).toBe('refunded')
    expect((await a.seats.getSeatState(screening.id)).seats[free[0]!]).toBe('available')

    vi.setSystemTime(new Date(screening.startsAt.getTime() - 30 * 60000))
    const error = await rejection(a.checkout.cancelPurchase(second.purchase.id, crypto.randomUUID()))
    expect(error.code).toBe('CANCELLATION_WINDOW_CLOSED')
  })

  it('las compras de otra sesión no existen para este cliente', async () => {
    const { a, b, screening, free } = await setup()
    const { purchase } = await buy(a, screening, [free[0]!])
    const error = await rejection(b.checkout.getPurchase(purchase.id))
    expect(error.status).toBe(404)
  })
})

describe('seguridad de la sesión', () => {
  it('el servidor rechaza escrituras sin el token CSRF de la sesión', async () => {
    const { screening, free } = await setup()
    const backend = createMockBackend({ baseUrl: '/api/v1', latencyMs: [0, 0], failureRate: 0 })
    localStorage.setItem(SESSION_KEY, 'sesion-sin-token')
    const response = await backend.fetchImpl(`/api/v1/screenings/${screening.id}/holds`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify({ seatIds: [free[5]] })
    })
    expect(response.status).toBe(403)
    expect(((await response.json()) as { code: string }).code).toBe('CSRF_INVALID')
  })

  it('el cliente renueva el token y repite la escritura una sola vez', async () => {
    const { screening, free } = await setup()
    const stranger = client('sesion-sin-token')
    const hold = await stranger.checkout.createHold(screening.id, [free[5]!], crypto.randomUUID())
    expect(hold.seatIds).toEqual([free[5]])
  })
})
