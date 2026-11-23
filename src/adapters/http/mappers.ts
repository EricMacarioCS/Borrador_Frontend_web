/**
 * Único lugar que conoce el JSON. Si backend renombra o anida un campo, solo cambia este archivo
 * y su esquema; las vistas no se enteran. Toda respuesta se valida antes de convertirse.
 */
import type { z } from 'zod'
import { ApiError } from '@/shared/lib/errors'
import { parseInstant } from '@/shared/lib/datetime'
import { hashHue } from '@/shared/lib/text'
import type {
  Bootstrap, FaqItem, HomeContent, Hold, InfoPage, Movie, MovieStage, Product, Promotion, Purchase, PurchaseStatus, Quote,
  Screening, ScreeningStatus, SeatEvent, SeatKind, SeatLayout, SeatSnapshot, Session, TicketCodeGrant, TicketPrice, Complex
} from '@/domain/models'
import type {
  BootstrapDto, FaqDto, HoldDto, HomeDto, MovieDto, PageDto, ProductDto, PromotionDto, PurchaseDto, QuoteDto, ScreeningDto,
  SeatEventDto, SeatLayoutDto, SeatSnapshotDto, SessionDto, TicketCodeGrantDto, TicketPriceDto, MoneyDto, ComplexDto
} from './schemas'

/** Valida y lanza un error claro si el backend envía otra forma. */
export function parse<T extends z.ZodType>(schema: T, value: unknown, what: string): z.output<T> {
  const result = schema.safeParse(value)
  if (!result.success) {
    console.error(`Respuesta inesperada en ${what}`, result.error.issues)
    throw new ApiError({ status: 200, code: 'MALFORMED_RESPONSE', detail: what })
  }
  return result.data
}

type Out<T extends z.ZodType> = z.output<T>

const cents = (money: Out<typeof MoneyDto>) => money.amount

const STAGES: readonly MovieStage[] = ['coming-soon', 'presale', 'premiere', 'now-showing']
const SCREENING_STATUSES: readonly ScreeningStatus[] = ['on-sale', 'sold-out', 'closed', 'cancelled']
const SEAT_KINDS: readonly SeatKind[] = ['standard', 'accessible', 'companion', 'premium']
const PURCHASE_STATUSES: readonly PurchaseStatus[] = ['payment-pending', 'confirmed', 'payment-failed', 'refund-pending', 'refunded', 'cancelled']
const REFUND_STATUSES = ['none', 'requested', 'processing', 'completed', 'failed'] as const

function oneOf<T extends string>(value: string, allowed: readonly T[], fallback: T, field: string): T {
  if ((allowed as readonly string[]).includes(value)) return value as T
  console.warn(`Valor desconocido en ${field}: ${value}`)
  return fallback
}

export const toComplex = (dto: Out<typeof ComplexDto>): Complex => ({
  ...dto,
  kind: dto.kind === 'vip' ? 'vip' : 'traditional',
  formats: dto.formats.map(format => ({ code: format.code, name: format.name, kind: format.kind === 'projection' ? 'projection' : 'room-type' }))
})

export const toBootstrap = (dto: Out<typeof BootstrapDto>): Bootstrap => ({
  serverNow: dto.serverNow, complexes: dto.complexes.map(toComplex), limits: dto.limits
})

export function toMovie(dto: Out<typeof MovieDto>): Movie {
  return {
    id: dto.id, slug: dto.slug, title: dto.title, synopsis: dto.synopsis,
    durationMinutes: dto.durationMinutes, rating: dto.rating, genres: dto.genres,
    isSpecialEvent: dto.isSpecialEvent, releaseDate: dto.releaseDate,
    stage: oneOf(dto.stage, STAGES, 'now-showing', 'movie.stage'),
    cast: dto.cast,
    accent: dto.accent ?? `hsl(${hashHue(dto.title)} 85% 60%)`,
    posterUrl: dto.media.posterUrl, backdropUrl: dto.media.backdropUrl, trailerUrl: dto.media.trailerUrl
  }
}

export function toScreening(dto: Out<typeof ScreeningDto>): Screening {
  return {
    id: dto.id, movieId: dto.movieId, complexId: dto.complexId,
    startsAt: parseInstant(dto.startsAt), endsAt: parseInstant(dto.endsAt), businessDate: dto.businessDate,
    room: dto.room, projection: dto.projection, language: dto.language,
    status: oneOf(dto.status, SCREENING_STATUSES, 'closed', 'screening.status'),
    occupancy: dto.occupancy, fromPriceCents: cents(dto.fromPrice), layout: dto.layout
  }
}

export const toSeatLayout = (dto: Out<typeof SeatLayoutDto>): SeatLayout => ({
  id: dto.id, version: dto.version,
  rows: dto.rows.map(row => ({
    label: row.label,
    cells: row.cells.map(cell => cell && { id: cell.id, label: cell.label, kind: oneOf(cell.kind, SEAT_KINDS, 'standard', 'seat.kind') })
  }))
})

export const toSeatSnapshot = (dto: Out<typeof SeatSnapshotDto>): SeatSnapshot => ({ version: dto.version, seats: dto.seats })
export const toSeatEvent = (dto: Out<typeof SeatEventDto>): SeatEvent => dto

export const toTicketPrice = (dto: Out<typeof TicketPriceDto>): TicketPrice => ({
  ticketTypeId: dto.ticketTypeId, name: dto.name, description: dto.description,
  priceCents: cents(dto.price), serviceFeeCents: cents(dto.serviceFee), allowed: dto.allowed, reason: dto.reason
})

export const toHold = (dto: Out<typeof HoldDto>): Hold => ({
  id: dto.id, screeningId: dto.screeningId, seatIds: dto.seatIds, expiresAt: parseInstant(dto.expiresAt)
})

export const toPromotion = (dto: Out<typeof PromotionDto>): Promotion => dto

export const toProduct = (dto: Out<typeof ProductDto>): Product => ({
  id: dto.id, name: dto.name, description: dto.description, category: dto.category, structure: dto.structure,
  basePriceCents: cents(dto.basePrice), available: dto.available, requiresTicketCode: dto.requiresTicketCode,
  rules: dto.rules.map(rule => ({
    id: rule.id, title: rule.title, kind: rule.kind, min: rule.min, max: rule.max, allowSplit: rule.allowSplit,
    options: rule.options.map(option => ({
      id: option.id, name: option.name, extraCents: cents(option.extraPrice), isDefault: option.isDefault, available: option.available
    }))
  }))
})

export const toTicketCodeGrant = (dto: Out<typeof TicketCodeGrantDto>): TicketCodeGrant => ({
  grant: dto.grant, ticketCode: dto.ticketCode, complexId: dto.complexId, movieTitle: dto.movieTitle,
  startsAt: parseInstant(dto.startsAt), endsAt: parseInstant(dto.endsAt)
})

export const toQuote = (dto: Out<typeof QuoteDto>): Quote => ({
  id: dto.id,
  lines: dto.lines.map(line => ({
    kind: line.kind, description: line.description, detail: line.detail, quantity: line.quantity,
    unitCents: cents(line.unitPrice), totalCents: cents(line.total)
  })),
  subtotalCents: cents(dto.subtotal), discountCents: cents(dto.discount),
  serviceFeeCents: cents(dto.serviceFee), totalCents: cents(dto.total),
  promotion: dto.promotion, expiresAt: parseInstant(dto.expiresAt)
})

export function toPurchase(dto: Out<typeof PurchaseDto>): Purchase {
  return {
    id: dto.id,
    status: oneOf(dto.status, PURCHASE_STATUSES, 'payment-pending', 'purchase.status'),
    createdAt: parseInstant(dto.createdAt),
    complex: dto.complex, ticketCode: dto.ticketCode, admissionToken: dto.admissionToken,
    screening: dto.screening && { ...dto.screening, startsAt: parseInstant(dto.screening.startsAt) },
    tickets: dto.tickets.map(ticket => ({ seatLabel: ticket.seatLabel, ticketType: ticket.ticketType, priceCents: cents(ticket.price) })),
    items: dto.items.map(item => ({ name: item.name, detail: item.detail, quantity: item.quantity, totalCents: cents(item.total) })),
    pickup: dto.pickup, linkedTicketCode: dto.linkedTicketCode,
    totals: {
      subtotalCents: cents(dto.totals.subtotal), discountCents: cents(dto.totals.discount),
      serviceFeeCents: cents(dto.totals.serviceFee), totalCents: cents(dto.totals.total)
    },
    promotionTitle: dto.promotionTitle,
    cancellation: { ...dto.cancellation, until: dto.cancellation.until ? parseInstant(dto.cancellation.until) : null },
    refund: { status: oneOf(dto.refund.status, REFUND_STATUSES, 'none', 'refund.status'), amountCents: cents(dto.refund.amount) },
    payment: dto.payment
  }
}

export const toSession = (dto: Out<typeof SessionDto>): Session => dto
export const toHome = (dto: Out<typeof HomeDto>): HomeContent => dto
export const toPage = (dto: Out<typeof PageDto>): InfoPage => dto
export const toFaq = (dto: Out<typeof FaqDto>): FaqItem[] => dto
