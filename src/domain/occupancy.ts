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
  { tone: 'low', label: '0–24 %' },
  { tone: 'medium', label: '25–49 %' },
  { tone: 'high', label: '50–74 %' },
  { tone: 'full', label: '75–100 %' }
]
