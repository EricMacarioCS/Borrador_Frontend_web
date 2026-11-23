/**
 * Contrato JSON de la API pública (`/api/v1`). Es la referencia para backend: camelCase,
 * IDs como texto, dinero en centavos y fechas ISO 8601 con zona.
 * El simulador produce exactamente estas formas, así que ambos modos usan los mismos conversores.
 */
import { z } from 'zod'
import { isInstant } from '@/shared/lib/datetime'

export const MoneyDto = z.object({ amount: z.number().int(), currency: z.literal('MXN') })
export const LabeledDto = z.object({ code: z.string(), name: z.string() })
/** Un instante sin zona se rechaza aquí: sería una hora ambigua entre servidor, complejo y navegador. */
const Instant = z.string().refine(isInstant, 'Se esperaba un instante ISO 8601 con zona horaria')
const BusinessDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export const ComplexDto = z.object({
  id: z.string(), slug: z.string(), name: z.string(), city: z.string(),
  kind: z.string(), address: z.string(), timeZone: z.string(),
  /** Opcional mientras el backend no lo envíe: la interfaz solo deja de mostrar los formatos. */
  formats: z.array(z.object({ code: z.string(), name: z.string(), kind: z.string() })).default([])
})

export const BootstrapDto = z.object({
  serverNow: Instant,
  complexes: z.array(ComplexDto),
  limits: z.object({
    maxSeatsPerPurchase: z.number().int().positive(),
    scheduleDays: z.number().int().positive(),
    cancelMinutesBefore: z.number().int().min(0)
  })
})

export const MovieDto = z.object({
  id: z.string(), slug: z.string(), title: z.string(), synopsis: z.string(),
  durationMinutes: z.number().int().positive(),
  rating: z.object({ code: z.string(), description: z.string() }),
  genres: z.array(z.string()),
  isSpecialEvent: z.boolean(),
  releaseDate: BusinessDate,
  stage: z.string(),
  cast: z.array(z.object({ name: z.string(), role: z.string() })),
  accent: z.string().nullable(),
  media: z.object({ posterUrl: z.string().nullable(), backdropUrl: z.string().nullable(), trailerUrl: z.string().nullable() })
})

export const ScreeningDto = z.object({
  id: z.string(), movieId: z.string(), complexId: z.string(),
  startsAt: Instant, endsAt: Instant, businessDate: BusinessDate,
  room: z.object({ id: z.string(), label: z.string(), type: LabeledDto }),
  projection: LabeledDto,
  language: LabeledDto,
  status: z.string(),
  occupancy: z.object({ unavailable: z.number().int().min(0), capacity: z.number().int().positive() }),
  fromPrice: MoneyDto,
  layout: z.object({ id: z.string(), version: z.number().int() })
})

export const SeatLayoutDto = z.object({
  id: z.string(), version: z.number().int(),
  rows: z.array(z.object({
    label: z.string(),
    cells: z.array(z.object({ id: z.string(), label: z.string(), kind: z.string() }).nullable())
  }))
})

export const SeatStatusDto = z.enum(['available', 'held', 'sold', 'blocked'])
export const SeatSnapshotDto = z.object({ screeningId: z.string(), version: z.number().int(), seats: z.record(z.string(), SeatStatusDto) })
export const SeatEventDto = z.object({ screeningId: z.string(), version: z.number().int(), changes: z.record(z.string(), SeatStatusDto) })

export const TicketPriceDto = z.object({
  ticketTypeId: z.string(), name: z.string(), description: z.string(),
  price: MoneyDto, serviceFee: MoneyDto, allowed: z.boolean(), reason: z.string().nullable()
})

export const HoldDto = z.object({
  id: z.string(), screeningId: z.string(), seatIds: z.array(z.string()), expiresAt: Instant, serverNow: Instant
})

export const PromotionDto = z.object({
  id: z.string(), title: z.string(), tag: z.string(), description: z.string(), conditions: z.string(),
  validFrom: BusinessDate, validTo: BusinessDate.nullable(), appliesOnline: z.boolean()
})

export const ProductDto = z.object({
  id: z.string(), name: z.string(), description: z.string(), category: LabeledDto, structure: z.string(),
  basePrice: MoneyDto, available: z.boolean(), requiresTicketCode: z.boolean(),
  rules: z.array(z.object({
    id: z.string(), title: z.string(), kind: z.string(),
    min: z.number().int().min(0), max: z.number().int().min(1), allowSplit: z.boolean(),
    options: z.array(z.object({ id: z.string(), name: z.string(), extraPrice: MoneyDto, isDefault: z.boolean(), available: z.boolean() }))
  }))
})

export const TicketCodeGrantDto = z.object({
  grant: z.string(), ticketCode: z.string(), complexId: z.string(), movieTitle: z.string(), startsAt: Instant, endsAt: Instant
})

export const QuoteDto = z.object({
  id: z.string(),
  lines: z.array(z.object({
    kind: z.enum(['ticket', 'product']), description: z.string(), detail: z.string(),
    quantity: z.number().int().positive(), unitPrice: MoneyDto, total: MoneyDto
  })),
  subtotal: MoneyDto, discount: MoneyDto, serviceFee: MoneyDto, total: MoneyDto,
  promotion: z.object({ id: z.string(), title: z.string(), applied: z.boolean(), reason: z.string().nullable() }).nullable(),
  expiresAt: Instant
})

export const PurchaseDto = z.object({
  id: z.string(), status: z.string(), createdAt: Instant,
  complex: z.object({ id: z.string(), name: z.string() }),
  ticketCode: z.string().nullable(), admissionToken: z.string().nullable(),
  screening: z.object({
    id: z.string(), movieTitle: z.string(), rating: z.string(), startsAt: Instant, room: z.string(),
    roomType: z.string(), projection: z.string(), language: z.string()
  }).nullable(),
  tickets: z.array(z.object({ seatLabel: z.string(), ticketType: z.string(), price: MoneyDto })),
  items: z.array(z.object({ name: z.string(), detail: z.string(), quantity: z.number().int().positive(), total: MoneyDto })),
  pickup: z.enum(['before', 'during']).nullable(),
  linkedTicketCode: z.string().nullable(),
  totals: z.object({ subtotal: MoneyDto, discount: MoneyDto, serviceFee: MoneyDto, total: MoneyDto }),
  promotionTitle: z.string().nullable(),
  cancellation: z.object({ allowed: z.boolean(), until: Instant.nullable(), reason: z.string().nullable() }),
  refund: z.object({ status: z.string(), amount: MoneyDto }),
  payment: z.union([z.object({ kind: z.literal('none') }), z.object({ kind: z.literal('redirect'), url: z.string() })])
})

export const SessionDto = z.object({
  kind: z.enum(['guest', 'customer']), email: z.string().nullable(), displayName: z.string().nullable(), csrfToken: z.string().nullable()
})

export const OtpRequestedDto = z.object({ resendAfterSeconds: z.number().int().min(0), devCode: z.string().nullable() })

export const HomeDto = z.object({
  featuredMovieIds: z.array(z.string()),
  highlights: z.array(z.object({ id: z.string(), title: z.string(), text: z.string(), ctaLabel: z.string(), ctaPath: z.string(), tone: z.string() }))
})
export const PageDto = z.object({ slug: z.string(), title: z.string(), paragraphs: z.array(z.string()) })
export const FaqDto = z.array(z.object({ question: z.string(), answer: z.string() }))

export const ListOf = <T extends z.ZodType>(item: T) => z.object({ items: z.array(item) })

/* Tipos de entrada: el simulador los usa para producir exactamente este contrato. */
export type MoneyJson = z.input<typeof MoneyDto>
export type ComplexJson = z.input<typeof ComplexDto>
export type BootstrapJson = z.input<typeof BootstrapDto>
export type MovieJson = z.input<typeof MovieDto>
export type ScreeningJson = z.input<typeof ScreeningDto>
export type SeatLayoutJson = z.input<typeof SeatLayoutDto>
export type SeatSnapshotJson = z.input<typeof SeatSnapshotDto>
export type SeatEventJson = z.input<typeof SeatEventDto>
export type TicketPriceJson = z.input<typeof TicketPriceDto>
export type HoldJson = z.input<typeof HoldDto>
export type PromotionJson = z.input<typeof PromotionDto>
export type ProductJson = z.input<typeof ProductDto>
export type TicketCodeGrantJson = z.input<typeof TicketCodeGrantDto>
export type QuoteJson = z.input<typeof QuoteDto>
export type PurchaseJson = z.input<typeof PurchaseDto>
export type SessionJson = z.input<typeof SessionDto>
export type OtpRequestedJson = z.input<typeof OtpRequestedDto>
export type HomeJson = z.input<typeof HomeDto>
export type PageJson = z.input<typeof PageDto>
export type FaqJson = z.input<typeof FaqDto>

/** Peticiones que envía el frontend. */
export interface QuoteRequestJson {
  complexId: string
  holdId: string | null
  ticketCodeGrant: string | null
  tickets: { seatId: string; ticketTypeId: string }[]
  items: { productId: string; quantity: number; choices: { ruleId: string; optionIds: string[] }[] }[]
  promotionId: string | null
  pickup: 'before' | 'during' | null
}
export interface PurchaseRequestJson {
  quoteId: string
  customer: { firstName: string; lastName: string; email: string }
  paymentMethod: string
}
