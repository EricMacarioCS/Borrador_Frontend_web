/** Colores de ocupación aprobados: azul < 25 %, verde < 50 %, naranja < 75 %, rojo desde 75 %. */
export type OccupancyTone = 'low' | 'medium' | 'high' | 'full'

export function occupancyPercent(unavailable: number, capacity: number): number {
  if (capacity <= 0) return 100
  if (unavailable >= capacity) return 100
  return Math.min(99, Math.round(unavailable / capacity * 100))
}

export function occupancyTone(percent: number): OccupancyTone {
  return percent < 25 ? 'low' : percent < 50 ? 'medium' : percent < 75 ? 'high' : 'full'
}

export const OCCUPANCY_LEGEND: { tone: OccupancyTone; label: string }[] = [
  { tone: 'low', label: 'Muchos lugares' },
  { tone: 'medium', label: 'Buena disponibilidad' },
  { tone: 'high', label: 'Quedan pocos' },
  { tone: 'full', label: 'Casi lleno' }
]

export const freeSeatsText = (free: number) => free === 1 ? '1 lugar libre' : `${free} lugares libres`

/** Texto corto de disponibilidad: con la sala holgada se da el número; al llenarse, un aviso. */
export function availabilityText(unavailable: number, capacity: number): string {
  const free = Math.max(0, capacity - unavailable)
  if (free === 0) return 'Agotado'
  const tone = occupancyTone(occupancyPercent(unavailable, capacity))
  if (tone === 'full') return 'Casi lleno'
  return tone === 'high' ? 'Quedan pocos' : freeSeatsText(free)
}
