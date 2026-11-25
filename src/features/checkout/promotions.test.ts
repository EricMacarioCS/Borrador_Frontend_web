import { describe, expect, it } from 'vitest'
import type { Promotion, PromotionEligibility } from '@/domain/models'
import { zonedInstant } from '@/shared/lib/datetime'
import { promotionApplies } from './promotions'

const promotion = (eligibility: Partial<PromotionEligibility> | null, appliesOnline = true): Promotion => ({
  id: 'p', title: 'Promo', tag: 'Prueba', description: '', conditions: '', validFrom: '2026-01-01', validTo: null, appliesOnline,
  eligibility: eligibility && { weekdays: null, roomTypes: null, projections: null, startsBefore: null, ...eligibility }
})
const screening = (date: string, time: string, room = 'traditional', projection = '2d') => ({
  businessDate: date, startsAt: zonedInstant(date, time),
  room: { type: { code: room, name: room } }, projection: { code: projection, name: projection }
})

// 2026-11-24 es martes; 2026-11-27, viernes; 2026-11-28, sábado.
describe('promociones que se ofrecen en una función', () => {
  it('filtra por día', () => {
    const tuesday = promotion({ weekdays: [2] })
    expect(promotionApplies(tuesday, screening('2026-11-24', '18:00'))).toBe(true)
    expect(promotionApplies(tuesday, screening('2026-11-27', '18:00'))).toBe(false)
  })

  it('filtra por tipo de sala y proyección', () => {
    const rule = promotion({ roomTypes: ['traditional'], projections: ['2d'] })
    expect(promotionApplies(rule, screening('2026-11-27', '18:00'))).toBe(true)
    expect(promotionApplies(rule, screening('2026-11-27', '18:00', 'imax'))).toBe(false)
    expect(promotionApplies(rule, screening('2026-11-27', '18:00', 'traditional', '3d'))).toBe(false)
  })

  it('el matiné exige fin de semana y comenzar antes de las 15:00', () => {
    const matinee = promotion({ weekdays: [0, 6], startsBefore: '15:00' })
    expect(promotionApplies(matinee, screening('2026-11-28', '14:59'))).toBe(true)
    expect(promotionApplies(matinee, screening('2026-11-28', '15:00'))).toBe(false)
    expect(promotionApplies(matinee, screening('2026-11-27', '12:00'))).toBe(false)
  })

  it('nunca ofrece las de taquilla y conserva las que no declaran condiciones', () => {
    expect(promotionApplies(promotion(null, false), screening('2026-11-27', '18:00'))).toBe(false)
    expect(promotionApplies(promotion(null), screening('2026-11-27', '18:00'))).toBe(true)
  })
})
