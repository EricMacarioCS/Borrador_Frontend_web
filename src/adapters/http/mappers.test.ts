import { describe, expect, it, vi } from 'vitest'
import { MovieDto, ScreeningDto } from './schemas'
import { parse, toMovie, toScreening } from './mappers'
import { ApiError } from '@/shared/lib/errors'

const screening = {
  id: 's-1', movieId: 'm-1', complexId: 'c-1',
  startsAt: '2026-11-24T19:30:00-06:00', endsAt: '2026-11-24T21:40:00-06:00', businessDate: '2026-11-24',
  room: { id: 'r-1', label: 'Sala 5', type: { code: 'traditional', name: 'Tradicional' } },
  projection: { code: '2d', name: '2D' }, language: { code: 'es', name: 'Español' },
  status: 'on-sale', occupancy: { unavailable: 10, capacity: 120 },
  fromPrice: { amount: 8500, currency: 'MXN' }, layout: { id: 'l-1', version: 3 }
}

const movie = {
  id: 'm-1', slug: 'pelicula', title: 'Película', synopsis: '', durationMinutes: 100,
  rating: { code: 'B', description: '' }, genres: [], isSpecialEvent: false, releaseDate: '2026-11-20',
  stage: 'now-showing', cast: [], accent: null, media: { posterUrl: null, backdropUrl: null, trailerUrl: null }
}

function malformed(run: () => unknown) {
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
  try {
    run()
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).code).toBe('MALFORMED_RESPONSE')
    return
  }
  throw new Error('Se esperaba MALFORMED_RESPONSE')
}

describe('conversión de respuestas', () => {
  it('convierte una función válida a tipos del dominio', () => {
    const result = toScreening(parse(ScreeningDto, screening, 'screening'))
    expect(result.startsAt.toISOString()).toBe('2026-11-25T01:30:00.000Z')
    expect(result.fromPriceCents).toBe(8500)
    expect(result.status).toBe('on-sale')
  })

  it('rechaza instantes sin zona horaria como respuesta inválida, no como error de red', () => {
    malformed(() => parse(ScreeningDto, { ...screening, startsAt: '2026-11-24T19:30:00' }, 'screening'))
  })

  it('rechaza dinero en otra moneda o con decimales', () => {
    malformed(() => parse(ScreeningDto, { ...screening, fromPrice: { amount: 85.5, currency: 'MXN' } }, 'screening'))
    malformed(() => parse(ScreeningDto, { ...screening, fromPrice: { amount: 8500, currency: 'USD' } }, 'screening'))
  })

  it('un estado nuevo del backend no rompe la pantalla: se trata como no vendible', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const result = toScreening(parse(ScreeningDto, { ...screening, status: 'paused' }, 'screening'))
    expect(result.status).toBe('closed')
    expect(warn).toHaveBeenCalled()
  })

  it('sin color de acento se deriva uno estable del título', () => {
    const first = toMovie(parse(MovieDto, movie, 'movie'))
    const second = toMovie(parse(MovieDto, movie, 'movie'))
    expect(first.accent).toMatch(/^hsl\(\d+ 85% 60%\)$/)
    expect(first.accent).toBe(second.accent)
  })
})
