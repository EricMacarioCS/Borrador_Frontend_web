import { ApiError, isAbort, toApiError } from './errors'
import { newCorrelationId } from './ids'

export interface HttpClientOptions {
  baseUrl: string
  timeoutMs?: number
  /** Devuelve el token CSRF vigente, si la sesión lo requiere. */
  csrfToken?: () => string | null
  fetchImpl?: typeof fetch
  /** Para pruebas: evita esperas reales entre reintentos. */
  sleep?: (ms: number) => Promise<void>
}

export interface RequestOptions {
  query?: Record<string, string | number | boolean | readonly string[] | undefined | null>
  body?: unknown
  signal?: AbortSignal
  idempotencyKey?: string
  /** Reintentos ante fallas temporales. Solo se usan en lecturas o con clave de idempotencia. */
  retries?: number
}

const SAFE_METHODS = new Set(['GET', 'HEAD'])

export interface HttpClient {
  get<T>(path: string, options?: RequestOptions): Promise<T>
  post<T>(path: string, options?: RequestOptions): Promise<T>
  put<T>(path: string, options?: RequestOptions): Promise<T>
  delete<T>(path: string, options?: RequestOptions): Promise<T>
}

export function createHttpClient(options: HttpClientOptions): HttpClient {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis)
  const sleep = options.sleep ?? ((ms: number) => new Promise(resolve => setTimeout(resolve, ms)))
  const timeoutMs = options.timeoutMs ?? 15000

  function url(path: string, query: RequestOptions['query']) {
    const base = options.baseUrl.replace(/\/$/, '')
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value === undefined || value === null) continue
      if (Array.isArray(value)) value.forEach(item => params.append(key, String(item)))
      else params.set(key, String(value))
    }
    const search = params.toString()
    return `${base}${path}${search ? `?${search}` : ''}`
  }

  async function once<T>(method: string, path: string, request: RequestOptions): Promise<T> {
    const headers: Record<string, string> = {
      Accept: 'application/json, application/problem+json',
      'X-Correlation-Id': newCorrelationId()
    }
    if (request.body !== undefined) headers['Content-Type'] = 'application/json'
    if (request.idempotencyKey) headers['Idempotency-Key'] = request.idempotencyKey
    const csrf = !SAFE_METHODS.has(method) ? options.csrfToken?.() : null
    if (csrf) headers['X-CSRF-Token'] = csrf

    const timeout = AbortSignal.timeout(timeoutMs)
    const signal = request.signal ? AbortSignal.any([request.signal, timeout]) : timeout
    let response: Response
    try {
      response = await fetchImpl(url(path, request.query), {
        method,
        headers,
        body: request.body === undefined ? undefined : JSON.stringify(request.body),
        credentials: 'same-origin',
        cache: 'no-store',
        signal
      })
    } catch (error) {
      if (isAbort(error) && request.signal?.aborted) throw error
      if (timeout.aborted) throw new ApiError({ status: 0, code: 'TIMEOUT' })
      throw toApiError(error)
    }

    if (response.status === 204) return undefined as T
    const text = await response.text()
    const type = response.headers.get('Content-Type') ?? ''
    const json = text && type.includes('json') ? safeJson(text) : undefined

    if (response.ok) {
      if (json === undefined && text) throw new ApiError({ status: response.status, code: 'MALFORMED_RESPONSE' })
      return json as T
    }
    throw problemToError(response, json)
  }

  async function send<T>(method: string, path: string, request: RequestOptions = {}): Promise<T> {
    const canRetry = SAFE_METHODS.has(method) || Boolean(request.idempotencyKey)
    const retries = canRetry ? (request.retries ?? (SAFE_METHODS.has(method) ? 2 : 0)) : 0
    for (let attempt = 0; ; attempt++) {
      try {
        return await once<T>(method, path, request)
      } catch (error) {
        if (!(error instanceof ApiError) || !error.transient || attempt >= retries) throw error
        const wait = error.retryAfterSeconds !== undefined
          ? error.retryAfterSeconds * 1000
          : Math.min(4000, 300 * 2 ** attempt) * (0.5 + Math.random() / 2)
        await sleep(wait)
        if (request.signal?.aborted) throw new DOMException('Cancelado', 'AbortError')
      }
    }
  }

  return {
    get: (path, request) => send('GET', path, request),
    post: (path, request) => send('POST', path, request),
    put: (path, request) => send('PUT', path, request),
    delete: (path, request) => send('DELETE', path, request)
  }
}

function safeJson(text: string): unknown {
  try { return JSON.parse(text) } catch { return undefined }
}

/** Convierte Problem Details en ApiError. Tolera errores de Kong con HTML o cuerpo vacío. */
function problemToError(response: Response, body: unknown): ApiError {
  const retryAfter = Number(response.headers.get('Retry-After'))
  const problem = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>
  const fallback = response.status === 429 ? 'RATE_LIMITED'
    : response.status === 401 ? 'SESSION_REQUIRED'
      : response.status === 403 ? 'FORBIDDEN'
        : response.status === 404 ? 'NOT_FOUND'
          : response.status >= 500 ? 'SERVICE_UNAVAILABLE' : 'UNKNOWN'
  const { code, detail, errors, traceId, ...extra } = problem
  return new ApiError({
    status: response.status,
    code: typeof code === 'string' ? code : fallback,
    detail: typeof detail === 'string' ? detail : undefined,
    fields: errors && typeof errors === 'object' ? errors as Record<string, string[]> : undefined,
    traceId: typeof traceId === 'string' ? traceId : response.headers.get('X-Correlation-Id') ?? undefined,
    retryAfterSeconds: Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined,
    extra
  })
}
