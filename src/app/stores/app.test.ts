import { beforeEach, describe, expect, it } from 'vitest'
import { createAppStore, type AppState } from './app'
import type { Complex } from '@/domain/models'

const complex = (id: string, city: string, formats: Complex['formats'] = []): Complex => ({
  id, slug: id, name: id, city, kind: 'traditional', address: '', timeZone: 'America/Mexico_City', formats
})
const COMPLEXES = [
  complex('xal-1', 'Xalapa', [{ code: 'imax', name: 'IMAX', kind: 'room-type' }, { code: '3d', name: '3D', kind: 'projection' }]),
  complex('xal-2', 'Xalapa', [{ code: 'vip', name: 'VIP', kind: 'room-type' }]),
  complex('ver-1', 'Veracruz', [{ code: 'imax', name: 'IMAX', kind: 'room-type' }, { code: '4dx', name: '4DX', kind: 'room-type' }])
]
const LIMITS = { maxSeatsPerPurchase: 10, scheduleDays: 14, cancelMinutesBefore: 60 }

function store(saved?: string[]) {
  if (saved) localStorage.setItem('cp-selected-complexes', JSON.stringify(saved))
  // El almacén lee los cines guardados al crearse.
  const app = createAppStore()
  app.getState().setComplexes(COMPLEXES, LIMITS)
  // Cada lectura toma el estado actual, como lo vería un componente después de la acción.
  return new Proxy({} as AppState, { get: (_, key) => app.getState()[key as keyof AppState] })
}

beforeEach(() => {
  localStorage.clear()
})

describe('cines elegidos', () => {
  it('se puede no tener ningún cine: para explorar se usan todos', () => {
    const app = store()
    expect(app.selectedComplexIds).toEqual([])
    expect(app.primaryComplex).toBeNull()
    expect(app.browseComplexIds).toEqual(['xal-1', 'xal-2', 'ver-1'])
  })

  it('solo admite cines de una misma ciudad', () => {
    const app = store()
    app.selectComplexes(['xal-1', 'ver-1', 'xal-2'])
    expect(app.selectedComplexIds).toEqual(['xal-1', 'xal-2'])
    expect(app.selectedCity).toBe('Xalapa')
  })

  it('agregar un cine de otra ciudad reemplaza la selección', () => {
    const app = store(['xal-1'])
    expect(app.addComplex('xal-2')).toBe('added')
    expect(app.addComplex('xal-2')).toBe('already')
    expect(app.addComplex('ver-1')).toBe('switched-city')
    expect(app.selectedComplexIds).toEqual(['ver-1'])
  })

  it('quitar el último cine deja la selección vacía y se guarda', () => {
    const app = store(['xal-1'])
    app.removeComplex('xal-1')
    expect(app.selectedComplexIds).toEqual([])
    expect(JSON.parse(localStorage.getItem('cp-selected-complexes')!)).toEqual([])
  })

  it('al arrancar descarta cines que ya no existen o de otra ciudad', () => {
    const app = store(['borrado', 'xal-2', 'ver-1'])
    expect(app.selectedComplexIds).toEqual(['xal-2'])
  })

  it('el selector recuerda a dónde continuar y lo olvida al cerrarse', () => {
    const app = store()
    app.askForComplexes('/peliculas/una')
    expect(app.pickerOpen).toBe(true)
    expect(app.pendingPath).toBe('/peliculas/una')
    app.closePicker()
    expect(app.pickerOpen).toBe(false)
    expect(app.pendingPath).toBeNull()
  })

  it('reúne los formatos de todos los complejos sin repetir y deja las proyecciones al final', () => {
    const app = store()
    expect(app.allFormats.map(format => format.code)).toEqual(['imax', 'vip', '4dx', '3d'])
  })
})
