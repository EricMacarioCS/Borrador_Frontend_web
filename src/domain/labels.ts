import type { MovieStage, PurchaseStatus } from './models'

export const STAGE_LABELS: Record<MovieStage, string> = {
  'coming-soon': 'Próximamente',
  'presale': 'Preventa',
  'premiere': 'Estreno',
  'now-showing': 'En cartelera'
}

export const PURCHASE_STATUS_LABELS: Record<PurchaseStatus, string> = {
  'payment-pending': 'Confirmando pago',
  'confirmed': 'Confirmada',
  'payment-failed': 'Pago rechazado',
  'refund-pending': 'Reembolso en proceso',
  'refunded': 'Reembolsada',
  'cancelled': 'Cancelada'
}

export const PICKUP_LABELS = { before: 'Antes de la función', during: 'Durante la función' } as const

export function durationLabel(minutes: number) {
  const hours = Math.floor(minutes / 60)
  return hours ? `${hours} h ${minutes % 60} min` : `${minutes} min`
}
