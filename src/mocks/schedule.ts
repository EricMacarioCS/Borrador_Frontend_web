/** Programación ficticia y determinista: la misma fecha siempre produce las mismas funciones. */
import { addDays, zonedInstant } from '@/shared/lib/datetime'
import {
  CLEANING_MINUTES, COMPLEXES, MOVIES, TIME_ZONE, findComplex, layoutFor, movieDates, onSaleFrom, seatIdsOf, today,
  type ComplexFixture, type MovieFixture, type RoomFixture
} from './fixtures'

export function hash(text: string): number {
  let value = 2166136261
  for (const char of text) value = Math.imul(value ^ char.charCodeAt(0), 16777619)
  value = Math.imul(value ^ (value >>> 15), 2246822507)
  return (value ^ (value >>> 13)) >>> 0
}

export interface ScreeningFixture {
  id: string
  movie: MovieFixture
  complex: ComplexFixture
  room: RoomFixture
  date: string
  startsAt: Date
  endsAt: Date
  projection: '2d' | '3d'
  language: 'es' | 'sub'
}

const cache = new Map<string, ScreeningFixture[]>()

function compact(date: string) {
  return date.replaceAll('-', '')
}

/** Películas que pueden programarse ese día en ese complejo. */
function filmsFor(date: string) {
  return MOVIES.filter(movie => {
    const from = onSaleFrom(movie)
    const { release, lastDay } = movieDates(movie)
    return from !== null && date >= release && (!lastDay || date <= lastDay)
  })
}

export function screeningsFor(complex: ComplexFixture, date: string): ScreeningFixture[] {
  const key = `${complex.id}|${date}|${today()}`
  const cached = cache.get(key)
  if (cached) return cached

  const films = filmsFor(date)
  const regular = films.filter(movie => !movie.isSpecialEvent)
  const events = films.filter(movie => movie.isSpecialEvent)
  const day = Math.round(Date.parse(`${date}T00:00:00Z`) / 86400000)
  const seed = hash(complex.id) % 7
  const list: ScreeningFixture[] = []

  complex.rooms.forEach((room, roomIndex) => {
    // La última sala tradicional recibe los eventos especiales a las 20:30.
    const eventRoom = events.length > 0 && room === [...complex.rooms].reverse().find(item => item.type === 'traditional')
    const candidates = room.type === 'junior' ? regular.filter(movie => ['AA', 'A'].includes(movie.rating.code)) : regular
    if (!candidates.length) return
    const movie = candidates[(roomIndex + day + seed) % candidates.length]!
    const interval = Math.ceil((movie.durationMinutes + CLEANING_MINUTES) / 10) * 10
    const opening = 11 * 60 + ((room.number * 35 + day * 10 + seed * 15) % 120)
    const lastStart = eventRoom ? 20 * 60 + 30 - interval : 22 * 60 + 30

    for (let minute = opening, slot = 0; minute <= lastStart; minute += interval, slot++) {
      const time = `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`
      const projection = room.projections.includes('3d') && slot % 2 === 1 ? '3d' : '2d'
      const language = movie.rating.code === 'AA' || (room.number + slot) % 3 ? 'es' : 'sub'
      list.push(make(movie, complex, room, date, time, slot, projection, language))
    }
    if (eventRoom) events.forEach((event, i) => list.push(make(event, complex, room, date, i ? '23:15' : '20:30', 90 + i, '2d', 'es')))
  })

  list.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
  cache.set(key, list)
  return list
}

function make(movie: MovieFixture, complex: ComplexFixture, room: RoomFixture, date: string, time: string, slot: number,
  projection: '2d' | '3d', language: 'es' | 'sub'): ScreeningFixture {
  const startsAt = zonedInstant(date, time, TIME_ZONE)
  return {
    id: `s-${complex.id}-${room.number}-${compact(date)}-${slot}`,
    movie, complex, room, date, startsAt, projection, language,
    endsAt: new Date(startsAt.getTime() + movie.durationMinutes * 60000)
  }
}

const ID = /^s-(.+)-(\d+)-(\d{8})-(\d+)$/

export function findScreening(id: string): ScreeningFixture | undefined {
  const match = ID.exec(id)
  if (!match) return undefined
  const complex = findComplex(match[1]!)
  const raw = match[3]!
  const date = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`
  return complex ? screeningsFor(complex, date).find(screening => screening.id === id) : undefined
}

export function scheduleDays(count: number): string[] {
  return Array.from({ length: count }, (_, i) => addDays(today(), i))
}

/** Asientos vendidos en taquilla de forma ficticia. Una de cada veinte funciones está llena. */
export function presoldSeats(screening: ScreeningFixture): Set<string> {
  const load = hash(`carga|${screening.id}`) % 20
  const percent = load === 19 ? 100 : 4 + load * 5
  return new Set(seatIdsOf(layoutFor(screening.room)).filter(seat => hash(`${seat}|${screening.id}`) % 100 < percent))
}

export { COMPLEXES }
