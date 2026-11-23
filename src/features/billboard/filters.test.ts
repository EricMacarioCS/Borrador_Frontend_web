import { describe, expect, it } from 'vitest'
import { facetOptions, matchesFilters, type ScreeningFilters } from './filters'
import type { Screening } from '@/domain/models'

const TZ = 'America/Mexico_City'
let n = 0
function screening(room: string, projection: string, language: string, time: string): Screening {
  n++
  return {
    id: `s-${n}`, movieId: 'm-1', complexId: 'c-1',
    startsAt: new Date(`2026-11-24T${time}:00-06:00`), endsAt: new Date(`2026-11-24T23:59:00-06:00`), businessDate: '2026-11-24',
    room: { id: 'r', label: 'Sala 1', type: { code: room, name: room.toUpperCase() } },
    projection: { code: projection, name: projection.toUpperCase() },
    language: { code: language, name: language },
    status: 'on-sale', occupancy: { unavailable: 0, capacity: 100 }, fromPriceCents: 8500, layout: { id: 'l', version: 1 }
  }
}
const none: ScreeningFilters = { roomTypes: [], projections: [], languages: [], dayparts: [] }
const DAY = [
  screening('imax', '2d', 'es', '11:00'),
  screening('imax', '3d', 'sub', '16:00'),
  screening('4dx', '3d', 'es', '19:30'),
  screening('traditional', '2d', 'es', '13:00')
]
const ids = (filters: ScreeningFilters) => DAY.filter(item => matchesFilters(item, filters, TZ)).map(item => item.id)

describe('filtros de la cartelera', () => {
  it('varias opciones del mismo grupo suman resultados', () => {
    expect(ids({ ...none, roomTypes: ['imax', '4dx'] })).toHaveLength(3)
  })

  it('entre grupos se deben cumplir todos', () => {
    expect(ids({ ...none, roomTypes: ['imax', '4dx'], projections: ['3d'] })).toHaveLength(2)
    expect(ids({ ...none, roomTypes: ['imax'], languages: ['es'], dayparts: ['noche'] })).toHaveLength(0)
  })

  it('las franjas de horario usan la hora del complejo', () => {
    expect(ids({ ...none, dayparts: ['manana'] })).toHaveLength(1)
    expect(ids({ ...none, dayparts: ['mediodia', 'noche'] })).toHaveLength(2)
  })

  it('cada opción cuenta las funciones que daría con los demás filtros aplicados', () => {
    const rooms = facetOptions(DAY, { ...none, projections: ['3d'], roomTypes: ['imax'] }, 'roomTypes', TZ)
    expect(Object.fromEntries(rooms.map(option => [option.value, option.count]))).toEqual({ 'imax': 1, '4dx': 1, 'traditional': 0 })
  })

  it('una opción marcada que ya no existe ese día se conserva para poder quitarla', () => {
    const rooms = facetOptions(DAY, { ...none, roomTypes: ['vip'] }, 'roomTypes', TZ, code => `Sala ${code}`)
    expect(rooms.find(option => option.value === 'vip')).toEqual({ value: 'vip', label: 'Sala vip', count: 0 })
  })
})
