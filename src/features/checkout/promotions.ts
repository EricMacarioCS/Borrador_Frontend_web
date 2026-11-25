/**
 * Qué promociones se ofrecen en una función. Solo filtra el selector con los datos que envía el servidor;
 * el descuento y la validación definitiva siguen en la cotización.
 */
import type { Promotion, Screening } from '@/domain/models'
import { formatTime } from '@/shared/lib/datetime'

type PromotionScreening = Pick<Screening, 'businessDate' | 'startsAt' | 'projection'> & { room: Pick<Screening['room'], 'type'> }

export function promotionApplies(promotion: Promotion, screening: PromotionScreening, timeZone?: string): boolean {
  if (!promotion.appliesOnline) return false
  const rule = promotion.eligibility
  if (!rule) return true
  const weekday = new Date(`${screening.businessDate}T12:00:00Z`).getUTCDay()
  return (!rule.weekdays || rule.weekdays.includes(weekday)) &&
    (!rule.roomTypes || rule.roomTypes.includes(screening.room.type.code)) &&
    (!rule.projections || rule.projections.includes(screening.projection.code)) &&
    (!rule.startsBefore || formatTime(screening.startsAt, timeZone) < rule.startsBefore)
}
