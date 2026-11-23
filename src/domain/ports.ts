/**
 * Puertos: lo que la interfaz necesita del backend. Hay dos implementaciones,
 * `src/adapters/http` (API real) y `src/mocks` (simulador). Las vistas solo conocen estas interfaces.
 */
import type {
  Bootstrap, Complex, FaqItem, HomeContent, Hold, Id, InfoPage, ItemSelection, Movie, MovieStage, Product, Promotion,
  Purchase, Quote, QuoteRequest, Screening, SeatEvent, SeatLayout, SeatSnapshot, Session, TicketCodeGrant, TicketPrice,
  Customer
} from './models'

export interface MovieQuery {
  /** Vacío: la cartelera de todos los complejos. */
  complexIds: Id[]
  stage?: MovieStage
  specialEvents?: boolean
  /** `popularity`: las más vistas primero (boletos vendidos recientes), solo películas a la venta. */
  sort?: 'popularity'
  limit?: number
}

export interface ScreeningQuery {
  complexIds: Id[]
  date: string
  movieId?: Id
}

export interface CatalogPort {
  bootstrap(signal?: AbortSignal): Promise<Bootstrap>
  listMovies(query: MovieQuery, signal?: AbortSignal): Promise<Movie[]>
  getMovie(slug: string, signal?: AbortSignal): Promise<Movie>
  listScreenings(query: ScreeningQuery, signal?: AbortSignal): Promise<Screening[]>
  getScreening(id: Id, signal?: AbortSignal): Promise<Screening>
  /** Fechas con funciones a la venta de una película. */
  listScreeningDates(movieId: Id, complexIds: Id[], signal?: AbortSignal): Promise<string[]>
}

export interface SeatsPort {
  getLayout(layoutId: Id, version: number, signal?: AbortSignal): Promise<SeatLayout>
  getSeatState(screeningId: Id, signal?: AbortSignal): Promise<SeatSnapshot>
}

export type ChannelStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected'

export interface SeatChannelPort {
  /** Se suscribe a una función. `onReconnected` indica que se perdieron eventos y hay que resincronizar. */
  subscribe(
    screeningId: Id,
    handlers: { onEvent: (event: SeatEvent) => void; onStatus: (status: ChannelStatus) => void; onReconnected: () => void }
  ): Promise<() => Promise<void>>
}

export interface CheckoutPort {
  getTicketPrices(screeningId: Id, signal?: AbortSignal): Promise<TicketPrice[]>
  createHold(screeningId: Id, seatIds: Id[], idempotencyKey: string): Promise<Hold>
  getHold(holdId: Id): Promise<Hold>
  updateHold(holdId: Id, seatIds: Id[]): Promise<Hold>
  releaseHold(holdId: Id): Promise<void>
  validateTicketCode(code: string, complexId: Id): Promise<TicketCodeGrant>
  createQuote(request: QuoteRequest): Promise<Quote>
  createPurchase(input: { quoteId: Id; customer: Customer; paymentMethod: string }, idempotencyKey: string): Promise<Purchase>
  getPurchase(id: Id, signal?: AbortSignal): Promise<Purchase>
  findPurchaseByKey(idempotencyKey: string): Promise<Purchase | null>
  listMyPurchases(signal?: AbortSignal): Promise<Purchase[]>
  cancelPurchase(id: Id, idempotencyKey: string): Promise<Purchase>
}

export interface FoodPort {
  listProducts(complexId: Id, signal?: AbortSignal): Promise<Product[]>
}

export interface AccountPort {
  getSession(signal?: AbortSignal): Promise<Session>
  /** Envía un código de un solo uso. En simulación devuelve el código para mostrarlo. */
  requestCode(email: string): Promise<{ resendAfterSeconds: number; devCode: string | null }>
  verifyCode(email: string, code: string): Promise<Session>
  signOut(): Promise<Session>
}

export interface ContentPort {
  getHome(signal?: AbortSignal): Promise<HomeContent>
  listPromotions(signal?: AbortSignal): Promise<Promotion[]>
  getPage(slug: string, signal?: AbortSignal): Promise<InfoPage>
  getFaq(signal?: AbortSignal): Promise<FaqItem[]>
}

export interface Services {
  mode: 'mock' | 'http'
  catalog: CatalogPort
  seats: SeatsPort
  seatChannel: SeatChannelPort
  checkout: CheckoutPort
  food: FoodPort
  account: AccountPort
  content: ContentPort
}

export type { Complex, ItemSelection }
