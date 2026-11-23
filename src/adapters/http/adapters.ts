/**
 * Implementación de los puertos sobre la API REST. Se usa igual con el backend real
 * y con el simulador, que solo reemplaza `fetch`.
 */
import { z } from 'zod'
import { syncClock } from '@/shared/lib/clock'
import { createHttpClient, type HttpClient, type RequestOptions } from '@/shared/lib/http'
import { ApiError } from '@/shared/lib/errors'
import type {
  AccountPort, CatalogPort, CheckoutPort, ContentPort, FoodPort, SeatsPort
} from '@/domain/ports'
import type { QuoteRequest } from '@/domain/models'
import * as S from './schemas'
import * as M from './mappers'

export interface HttpAdapters {
  catalog: CatalogPort
  seats: SeatsPort
  checkout: CheckoutPort
  food: FoodPort
  account: AccountPort
  content: ContentPort
}

export function createHttpAdapters(options: { baseUrl: string; fetchImpl?: typeof fetch }): HttpAdapters {
  let csrfToken: string | null = null
  const raw = createHttpClient({ baseUrl: options.baseUrl, fetchImpl: options.fetchImpl, csrfToken: () => csrfToken })

  /**
   * Si la sesión rotó (cookie nueva, token viejo), se pide la sesión otra vez y se repite la escritura una sola vez.
   * Repetirla es seguro: el servidor rechazó la primera antes de procesarla.
   */
  async function write<T>(send: (path: string, request?: RequestOptions) => Promise<T>, target: string, request?: RequestOptions): Promise<T> {
    try {
      return await send(target, request)
    } catch (error) {
      if (!(error instanceof ApiError) || error.code !== 'CSRF_INVALID') throw error
      const session = M.parse(S.SessionDto, await raw.get('/session'), 'session')
      csrfToken = session.csrfToken
      return send(target, request)
    }
  }
  const http: HttpClient = {
    get: <T>(target: string, request?: RequestOptions) => raw.get<T>(target, request),
    post: <T>(target: string, request?: RequestOptions) => write<T>((p, r) => raw.post<T>(p, r), target, request),
    put: <T>(target: string, request?: RequestOptions) => write<T>((p, r) => raw.put<T>(p, r), target, request),
    delete: <T>(target: string, request?: RequestOptions) => write<T>((p, r) => raw.delete<T>(p, r), target, request)
  }
  const path = (template: string, ...values: string[]) =>
    values.reduce((result, value) => result.replace(/\{[^}]+\}/, encodeURIComponent(value)), template)

  const catalog: CatalogPort = {
    async bootstrap(signal) {
      const started = Date.now()
      const result = M.toBootstrap(M.parse(S.BootstrapDto, await http.get('/bootstrap', { signal }), 'bootstrap'))
      syncClock(result.serverNow, started)
      return result
    },
    async listMovies(query, signal) {
      const body = await http.get('/movies', {
        signal,
        query: { complexId: query.complexIds, stage: query.stage, specialEvents: query.specialEvents, sort: query.sort, limit: query.limit }
      })
      return M.parse(S.ListOf(S.MovieDto), body, 'movies').items.map(M.toMovie)
    },
    async getMovie(slug, signal) {
      return M.toMovie(M.parse(S.MovieDto, await http.get(path('/movies/{slug}', slug), { signal }), 'movie'))
    },
    async listScreenings(query, signal) {
      const body = await http.get('/screenings', {
        signal, query: { complexId: query.complexIds, date: query.date, movieId: query.movieId }
      })
      return M.parse(S.ListOf(S.ScreeningDto), body, 'screenings').items.map(M.toScreening)
    },
    async getScreening(id, signal) {
      return M.toScreening(M.parse(S.ScreeningDto, await http.get(path('/screenings/{id}', id), { signal }), 'screening'))
    },
    async listScreeningDates(movieId, complexIds, signal) {
      const body = await http.get(path('/movies/{id}/screening-dates', movieId), { signal, query: { complexId: complexIds } })
      return M.parse(z.object({ dates: z.array(z.string()) }), body, 'screening-dates').dates
    }
  }

  const seats: SeatsPort = {
    async getLayout(layoutId, version, signal) {
      const body = await http.get(path('/seat-layouts/{id}/versions/{version}', layoutId, String(version)), { signal })
      return M.toSeatLayout(M.parse(S.SeatLayoutDto, body, 'seat-layout'))
    },
    async getSeatState(screeningId, signal) {
      const body = await http.get(path('/screenings/{id}/seats', screeningId), { signal, retries: 1 })
      return M.toSeatSnapshot(M.parse(S.SeatSnapshotDto, body, 'seats'))
    }
  }

  const holdFrom = (body: unknown) => {
    const dto = M.parse(S.HoldDto, body, 'hold')
    syncClock(dto.serverNow)
    return M.toHold(dto)
  }

  const checkout: CheckoutPort = {
    async getTicketPrices(screeningId, signal) {
      const body = await http.get(path('/screenings/{id}/ticket-prices', screeningId), { signal })
      return M.parse(S.ListOf(S.TicketPriceDto), body, 'ticket-prices').items.map(M.toTicketPrice)
    },
    async createHold(screeningId, seatIds, idempotencyKey) {
      return holdFrom(await http.post(path('/screenings/{id}/holds', screeningId), { body: { seatIds }, idempotencyKey, retries: 2 }))
    },
    async getHold(holdId) {
      return holdFrom(await http.get(path('/holds/{id}', holdId)))
    },
    async updateHold(holdId, seatIds) {
      return holdFrom(await http.put(path('/holds/{id}/seats', holdId), { body: { seatIds } }))
    },
    async releaseHold(holdId) {
      await http.delete(path('/holds/{id}', holdId))
    },
    async validateTicketCode(code, complexId) {
      const body = await http.post('/ticket-code-validations', { body: { code, complexId } })
      return M.toTicketCodeGrant(M.parse(S.TicketCodeGrantDto, body, 'ticket-code'))
    },
    async createQuote(request: QuoteRequest) {
      const body: S.QuoteRequestJson = request
      return M.toQuote(M.parse(S.QuoteDto, await http.post('/quotes', { body }), 'quote'))
    },
    async createPurchase(input, idempotencyKey) {
      const body: S.PurchaseRequestJson = input
      return M.toPurchase(M.parse(S.PurchaseDto, await http.post('/purchases', { body, idempotencyKey, retries: 2 }), 'purchase'))
    },
    async getPurchase(id, signal) {
      return M.toPurchase(M.parse(S.PurchaseDto, await http.get(path('/purchases/{id}', id), { signal }), 'purchase'))
    },
    async findPurchaseByKey(idempotencyKey) {
      try {
        const body = await http.get(path('/purchases/by-idempotency-key/{key}', idempotencyKey))
        return M.toPurchase(M.parse(S.PurchaseDto, body, 'purchase'))
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return null
        throw error
      }
    },
    async listMyPurchases(signal) {
      return M.parse(S.ListOf(S.PurchaseDto), await http.get('/me/purchases', { signal }), 'purchases').items.map(M.toPurchase)
    },
    async cancelPurchase(id, idempotencyKey) {
      const body = await http.post(path('/purchases/{id}/cancellations', id), { idempotencyKey, retries: 2 })
      return M.toPurchase(M.parse(S.PurchaseDto, body, 'purchase'))
    }
  }

  const food: FoodPort = {
    async listProducts(complexId, signal) {
      const body = await http.get(path('/complexes/{id}/products', complexId), { signal })
      return M.parse(S.ListOf(S.ProductDto), body, 'products').items.map(M.toProduct)
    }
  }

  const sessionFrom = (body: unknown) => {
    const session = M.toSession(M.parse(S.SessionDto, body, 'session'))
    csrfToken = session.csrfToken
    return session
  }

  const account: AccountPort = {
    async getSession(signal) {
      return sessionFrom(await http.get('/session', { signal }))
    },
    async requestCode(email) {
      return M.parse(S.OtpRequestedDto, await http.post('/session/otp', { body: { email } }), 'otp')
    },
    async verifyCode(email, code) {
      return sessionFrom(await http.post('/session/otp/verify', { body: { email, code } }))
    },
    async signOut() {
      return sessionFrom(await http.delete('/session'))
    }
  }

  const content: ContentPort = {
    async getHome(signal) {
      return M.toHome(M.parse(S.HomeDto, await http.get('/content/home', { signal }), 'home'))
    },
    async listPromotions(signal) {
      return M.parse(S.ListOf(S.PromotionDto), await http.get('/promotions', { signal }), 'promotions').items.map(M.toPromotion)
    },
    async getPage(slug, signal) {
      return M.toPage(M.parse(S.PageDto, await http.get(path('/content/pages/{slug}', slug), { signal }), 'page'))
    },
    async getFaq(signal) {
      return M.toFaq(M.parse(S.FaqDto, await http.get('/content/faq', { signal }), 'faq'))
    }
  }

  return { catalog, seats, checkout, food, account, content }
}
