/**
 * Modelo del frontend. Es independiente del JSON del backend y de las tablas de la base de datos:
 * los adaptadores convierten hacia este modelo. Los catálogos abiertos (tipo de sala, proyección,
 * idioma) llegan como código y nombre para que un valor nuevo no rompa la interfaz.
 */
import type { Cents } from '@/shared/lib/money'

export type Id = string

export interface Labeled {
  code: string
  name: string
}

/** Formato que ofrece un complejo. Un tipo de sala (IMAX, 4DX) o una proyección (3D): define qué filtro aplica. */
export interface ComplexFormat extends Labeled {
  kind: 'room-type' | 'projection'
}

export interface Complex {
  id: Id
  slug: string
  name: string
  city: string
  /** En la base de datos, la versión VIP de una plaza es un complejo distinto. */
  kind: 'traditional' | 'vip'
  address: string
  timeZone: string
  /** Formatos de sus salas, para el buscador y el selector de cines. */
  formats: ComplexFormat[]
}

export interface Limits {
  maxSeatsPerPurchase: number
  scheduleDays: number
  cancelMinutesBefore: number
}

export interface Bootstrap {
  serverNow: string
  complexes: Complex[]
  limits: Limits
}

export type MovieStage = 'coming-soon' | 'presale' | 'premiere' | 'now-showing'

export interface Rating {
  code: string
  description: string
}

export interface CastMember {
  name: string
  role: 'director' | 'actor' | (string & {})
}

export interface Movie {
  id: Id
  slug: string
  title: string
  synopsis: string
  durationMinutes: number
  rating: Rating
  genres: string[]
  isSpecialEvent: boolean
  /** Fecha de negocio. */
  releaseDate: string
  /** Etapa calculada por el servidor. */
  stage: MovieStage
  cast: CastMember[]
  /** Color de acento para el arte. Las imágenes llegarán después. */
  accent: string
  posterUrl: string | null
  backdropUrl: string | null
  trailerUrl: string | null
}

export type ScreeningStatus = 'on-sale' | 'sold-out' | 'closed' | 'cancelled'

export interface Screening {
  id: Id
  movieId: Id
  complexId: Id
  startsAt: Date
  endsAt: Date
  businessDate: string
  room: { id: Id; label: string; type: Labeled }
  projection: Labeled
  language: Labeled
  status: ScreeningStatus
  occupancy: { unavailable: number; capacity: number }
  fromPriceCents: Cents
  layout: { id: Id; version: number }
}

export type SeatKind = 'standard' | 'accessible' | 'companion' | 'premium'
export interface SeatCell {
  id: Id
  label: string
  kind: SeatKind
}
export interface SeatLayout {
  id: Id
  version: number
  rows: { label: string; cells: (SeatCell | null)[] }[]
}

export type SeatStatus = 'available' | 'held' | 'sold' | 'blocked'
export interface SeatSnapshot {
  version: number
  seats: Record<Id, SeatStatus>
}
export interface SeatEvent {
  screeningId: Id
  version: number
  changes: Record<Id, SeatStatus>
}

export interface TicketPrice {
  ticketTypeId: Id
  name: string
  description: string
  priceCents: Cents
  serviceFeeCents: Cents
  allowed: boolean
  reason: string | null
}

export interface Hold {
  id: Id
  screeningId: Id
  seatIds: Id[]
  expiresAt: Date
}

export interface Promotion {
  id: Id
  title: string
  tag: string
  description: string
  conditions: string
  validFrom: string
  validTo: string | null
  appliesOnline: boolean
  /** Funciones en las que puede aplicar. Si no llega, la interfaz no la descarta. */
  eligibility?: PromotionEligibility | null
}

/** Un campo en `null` significa "sin restricción". */
export interface PromotionEligibility {
  /** 0 es domingo y 6 es sábado, según la fecha de negocio de la función. */
  weekdays: number[] | null
  roomTypes: string[] | null
  projections: string[] | null
  /** Hora local del complejo (HH:MM); la función debe iniciar antes. */
  startsBefore: string | null
}

/* Dulcería: reglas de personalización como en la base de datos (mínimo, máximo y opciones). */

export interface ModifierOption {
  id: Id
  name: string
  extraCents: Cents
  isDefault: boolean
  available: boolean
}
export interface ModifierRule {
  id: Id
  title: string
  kind: 'size' | 'flavor' | 'extra' | 'choice' | (string & {})
  min: number
  max: number
  /** Permite repartir la porción entre opciones, por ejemplo dos sabores al 50 %. */
  allowSplit: boolean
  options: ModifierOption[]
}
export interface Product {
  id: Id
  name: string
  description: string
  category: Labeled
  structure: 'simple' | 'compound' | 'combo' | (string & {})
  basePriceCents: Cents
  available: boolean
  /** Exige folio de boletos vigente al comprar en línea. */
  requiresTicketCode: boolean
  rules: ModifierRule[]
}

/** Selección del cliente: solo identificadores. El precio lo calcula el servidor. */
export interface ItemSelection {
  productId: Id
  quantity: number
  choices: { ruleId: Id; optionIds: Id[] }[]
}

export interface TicketCodeGrant {
  grant: string
  ticketCode: string
  complexId: Id
  movieTitle: string
  startsAt: Date
  endsAt: Date
}

export interface QuoteRequest {
  complexId: Id
  holdId: Id | null
  ticketCodeGrant: string | null
  tickets: { seatId: Id; ticketTypeId: Id }[]
  items: ItemSelection[]
  promotionId: Id | null
  pickup: 'before' | 'during' | null
}

export interface QuoteLine {
  kind: 'ticket' | 'product'
  description: string
  detail: string
  quantity: number
  unitCents: Cents
  totalCents: Cents
}

export interface Quote {
  id: Id
  lines: QuoteLine[]
  subtotalCents: Cents
  discountCents: Cents
  serviceFeeCents: Cents
  totalCents: Cents
  promotion: { id: Id; title: string; applied: boolean; reason: string | null } | null
  expiresAt: Date
}

export interface Customer {
  firstName: string
  lastName: string
  email: string
}

export type PurchaseStatus = 'payment-pending' | 'confirmed' | 'payment-failed' | 'refund-pending' | 'refunded' | 'cancelled'

export interface Purchase {
  id: Id
  status: PurchaseStatus
  createdAt: Date
  complex: { id: Id; name: string }
  /** Solo las compras con boletos tienen folio. */
  ticketCode: string | null
  /** Credencial del QR. Distinta del folio. */
  admissionToken: string | null
  screening: {
    id: Id
    movieTitle: string
    rating: string
    startsAt: Date
    room: string
    roomType: string
    projection: string
    language: string
  } | null
  tickets: { seatLabel: string; ticketType: string; priceCents: Cents }[]
  items: { name: string; detail: string; quantity: number; totalCents: Cents }[]
  pickup: 'before' | 'during' | null
  /** Folio de los boletos al que se vinculan estos alimentos. */
  linkedTicketCode: string | null
  totals: { subtotalCents: Cents; discountCents: Cents; serviceFeeCents: Cents; totalCents: Cents }
  promotionTitle: string | null
  cancellation: { allowed: boolean; until: Date | null; reason: string | null }
  refund: { status: 'none' | 'requested' | 'processing' | 'completed' | 'failed'; amountCents: Cents }
  payment: { kind: 'none' } | { kind: 'redirect'; url: string }
}

export interface Session {
  kind: 'guest' | 'customer'
  email: string | null
  displayName: string | null
  csrfToken: string | null
}

export interface HomeContent {
  featuredMovieIds: Id[]
  highlights: { id: Id; title: string; text: string; ctaLabel: string; ctaPath: string; tone: string }[]
}

export interface InfoPage {
  slug: string
  title: string
  paragraphs: string[]
}

export interface FaqItem {
  question: string
  answer: string
}
