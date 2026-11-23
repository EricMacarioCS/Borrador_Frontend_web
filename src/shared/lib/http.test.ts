import { describe, expect, it, vi } from 'vitest'
import { createHttpClient } from './http'
import { ApiError } from './errors'

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': status >= 400 ? 'application/problem+json' : 'application/json', ...headers } })

function setup(...responses: (Response | Error)[]) {
  const fetchImpl = vi.fn<typeof fetch>()
  for (const response of responses) {
    if (response instanceof Error) fetchImpl.mockRejectedValueOnce(response)
    else fetchImpl.mockResolvedValueOnce(response)
  }
  const sleep = vi.fn(() => Promise.resolve())
  const client = createHttpClient({ baseUrl: '/api/v1/', fetchImpl, sleep, csrfToken: () => 'token-csrf' })
  const headers = (call: number) => new Headers(fetchImpl.mock.calls[call]?.[1]?.headers)
  return { client, fetchImpl, sleep, headers }
}

async function rejection(promise: Promise<unknown>): Promise<ApiError> {
  try { await promise } catch (error) { if (error instanceof ApiError) return error; throw error }
  throw new Error('Se esperaba un error')
}

describe('cliente HTTP', () => {
  it('arma la URL con la base y repite parámetros de lista', async () => {
    const { client, fetchImpl } = setup(json(200, { ok: true }))
    await client.get('/screenings', { query: { complexId: ['a', 'b'], date: '2026-11-24', movieId: undefined } })
    expect(fetchImpl.mock.calls[0]?.[0]).toBe('/api/v1/screenings?complexId=a&complexId=b&date=2026-11-24')
  })

  it('reintenta lecturas ante fallas temporales', async () => {
    const { client, fetchImpl, sleep } = setup(json(503, {}), json(503, {}), json(200, { items: [] }))
    await expect(client.get('/movies')).resolves.toEqual({ items: [] })
    expect(fetchImpl).toHaveBeenCalledTimes(3)
    expect(sleep).toHaveBeenCalledTimes(2)
  })

  it('no reintenta una escritura sin clave de idempotencia', async () => {
    const { client, fetchImpl } = setup(json(503, {}), json(201, {}))
    const error = await rejection(client.post('/quotes', { body: {} }))
    expect(error.code).toBe('SERVICE_UNAVAILABLE')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('reintenta una escritura idempotente con la misma clave', async () => {
    const { client, fetchImpl, headers } = setup(new TypeError('Failed to fetch'), json(201, { id: 'p1' }))
    await client.post('/purchases', { body: {}, idempotencyKey: 'clave-1', retries: 1 })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(headers(0).get('Idempotency-Key')).toBe('clave-1')
    expect(headers(1).get('Idempotency-Key')).toBe('clave-1')
  })

  it('respeta Retry-After', async () => {
    const { client, sleep } = setup(json(429, { code: 'RATE_LIMITED' }, { 'Retry-After': '2' }), json(200, {}))
    await client.get('/movies')
    expect(sleep).toHaveBeenCalledWith(2000)
  })

  it('envía CSRF solo en métodos que modifican', async () => {
    const { client, headers } = setup(json(200, {}), json(201, {}))
    await client.get('/session')
    await client.post('/holds')
    expect(headers(0).get('X-CSRF-Token')).toBeNull()
    expect(headers(1).get('X-CSRF-Token')).toBe('token-csrf')
    expect(headers(0).get('X-Correlation-Id')).not.toBe(headers(1).get('X-Correlation-Id'))
  })

  it('convierte Problem Details en ApiError con sus datos extra', async () => {
    const { client } = setup(json(409, { code: 'SEAT_CONFLICT', detail: 'Ocupado', traceId: 't-1', conflictingSeatIds: ['A1'] }))
    const error = await rejection(client.post('/holds'))
    expect(error).toMatchObject({ status: 409, code: 'SEAT_CONFLICT', detail: 'Ocupado', traceId: 't-1' })
    expect(error.extra.conflictingSeatIds).toEqual(['A1'])
  })

  it('tolera una página HTML del gateway', async () => {
    const { client } = setup(new Response('<html>Bad gateway</html>', { status: 502, headers: { 'Content-Type': 'text/html' } }))
    const error = await rejection(client.post('/holds'))
    expect(error.code).toBe('SERVICE_UNAVAILABLE')
  })

  it('marca como inválida una respuesta exitosa que no es JSON', async () => {
    const { client } = setup(new Response('ok', { status: 200, headers: { 'Content-Type': 'text/plain' } }))
    expect((await rejection(client.get('/movies'))).code).toBe('MALFORMED_RESPONSE')
  })

  it('204 no tiene cuerpo', async () => {
    const { client } = setup(new Response(null, { status: 204 }))
    await expect(client.delete('/holds/h1')).resolves.toBeUndefined()
  })
})
