/**
 * Backend simulado: un `fetch` que atiende el contrato REST y un canal que imita SignalR.
 * Solo se carga en modo "mock"; con la API real este módulo no se descarga.
 */
import type { SeatChannelPort } from '@/domain/ports'
import { toSeatEvent } from '@/adapters/http/mappers'
import { deliver, onSeatEvent, sessionId, withLock } from './store'
import { handle, sweepNow } from './server'

export interface MockOptions {
  baseUrl: string
  latencyMs: [number, number]
  failureRate: number
}

function wait(ms: number, signal?: AbortSignal | null) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Cancelado', 'AbortError'))
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(new DOMException('Cancelado', 'AbortError'))
    }, { once: true })
  })
}

export function createMockBackend(options: MockOptions) {
  const base = new URL(options.baseUrl, globalThis.location?.origin ?? 'http://localhost')

  const fetchImpl: typeof fetch = async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, base)
    const headers = new Headers(init?.headers)
    const [min, max] = options.latencyMs
    await wait(min + Math.random() * Math.max(0, max - min), init?.signal)

    if (options.failureRate > 0 && Math.random() < options.failureRate) {
      return json(503, { code: 'SERVICE_UNAVAILABLE', title: 'Falla simulada', status: 503 })
    }

    const { response, events } = await withLock(() => handle({
      method: (init?.method ?? 'GET').toUpperCase(),
      path: url.pathname.slice(base.pathname.replace(/\/$/, '').length) || '/',
      query: url.searchParams,
      body: typeof init?.body === 'string' ? JSON.parse(init.body) as unknown : undefined,
      sid: sessionId(),
      csrf: headers.get('X-CSRF-Token'),
      idempotencyKey: headers.get('Idempotency-Key')
    }))
    deliver(events)
    return json(response.status, response.body)
  }

  return { fetchImpl, seatChannel: createMockSeatChannel() }
}

function json(status: number, body: unknown): Response {
  if (status === 204) return new Response(null, { status })
  const problem = status >= 400 ? body as Record<string, unknown> : null
  const headers: Record<string, string> = {
    'Content-Type': problem ? 'application/problem+json' : 'application/json',
    'X-Correlation-Id': crypto.randomUUID().replaceAll('-', '')
  }
  if (problem && typeof problem.retryAfter === 'number') headers['Retry-After'] = String(problem.retryAfter)
  return new Response(JSON.stringify(body), { status, headers })
}

/** Imita el hub: entrega eventos entre pestañas, vence apartados y simula reconexiones de red. */
function createMockSeatChannel(): SeatChannelPort {
  let subscribers = 0
  let sweeper: ReturnType<typeof setInterval> | null = null

  return {
    async subscribe(screeningId, handlers) {
      handlers.onStatus('connecting')
      await wait(150)
      const stop = onSeatEvent(payload => {
        if (payload.screeningId === screeningId) handlers.onEvent(toSeatEvent(payload))
      })
      const offline = () => handlers.onStatus('reconnecting')
      const online = () => {
        handlers.onStatus('connected')
        handlers.onReconnected()
      }
      window.addEventListener('offline', offline)
      window.addEventListener('online', online)
      subscribers++
      sweeper ??= setInterval(() => {
        void withLock(sweepNow).then(deliver)
      }, 3000)
      handlers.onStatus('connected')

      return () => {
        stop()
        window.removeEventListener('offline', offline)
        window.removeEventListener('online', online)
        subscribers--
        if (!subscribers && sweeper) {
          clearInterval(sweeper)
          sweeper = null
        }
        return Promise.resolve()
      }
    }
  }
}
