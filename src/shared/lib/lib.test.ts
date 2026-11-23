import { describe, expect, it } from 'vitest'
import { formatMoney, sumCents } from './money'
import { addDays, dateInZone, formatTime, isIsoDate, parseInstant, zonedInstant } from './datetime'
import { completeTicketCode, TICKET_CODE_PATTERN } from './text'
import { QR_SIZE, qrMatrix } from './qr'

// Espacio no separable que usa Intl en algunos formatos.
const plain = (text: string) => text.replace(/\s/g, ' ')

describe('dinero', () => {
  it('muestra centavos solo cuando existen', () => {
    expect(plain(formatMoney(8500))).toBe('$85')
    expect(plain(formatMoney(8550))).toBe('$85.50')
    expect(plain(formatMoney(123456700))).toBe('$1,234,567')
  })
  it('rechaza importes que no son centavos enteros', () => {
    expect(() => formatMoney(85.5)).toThrow(TypeError)
  })
  it('suma centavos', () => {
    expect(sumCents([8500, 600, 6400])).toBe(15500)
  })
})

describe('fechas', () => {
  it('exige zona horaria en los instantes', () => {
    expect(() => parseInstant('2026-11-24T19:30:00')).toThrow(TypeError)
    expect(parseInstant('2026-11-24T19:30:00-06:00').toISOString()).toBe('2026-11-25T01:30:00.000Z')
  })
  it('valida fechas de negocio reales', () => {
    expect(isIsoDate('2026-02-28')).toBe(true)
    expect(isIsoDate('2026-02-30')).toBe(false)
    expect(isIsoDate('24/11/2026')).toBe(false)
  })
  it('convierte hora local del complejo a instante y de regreso', () => {
    const instant = zonedInstant('2026-11-24', '23:30', 'America/Mexico_City')
    expect(instant.toISOString()).toBe('2026-11-25T05:30:00.000Z')
    expect(formatTime(instant, 'America/Mexico_City')).toBe('23:30')
    // La fecha de negocio no depende de la zona del navegador.
    expect(dateInZone(instant, 'America/Mexico_City')).toBe('2026-11-24')
  })
  it('respeta el horario de verano de otras zonas', () => {
    // Tijuana en julio está en UTC−7.
    expect(zonedInstant('2026-07-10', '20:00', 'America/Tijuana').toISOString()).toBe('2026-07-11T03:00:00.000Z')
  })
  it('suma días cruzando meses y años', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02')
  })
})

describe('folio', () => {
  it('normaliza lo que escribe el cliente', () => {
    expect(completeTicketCode('cin-sfc6-2m5o-wsv6')).toBe('CIN-SFC6-2M50-WSV6')
    expect(completeTicketCode('SFC6 2M50 WSV6')).toBe('CIN-SFC6-2M50-WSV6')
    expect(completeTicketCode('CIN-ABCD-EFGH-IJKL')).toBe('CIN-ABCD-EFGH-1JK1')
  })
  it('rechaza códigos incompletos o con letras fuera del alfabeto', () => {
    expect(completeTicketCode('CIN-ABCD-EFGH')).toBeNull()
    expect(completeTicketCode('CIN-UUUU-0000-0000')).toBeNull()
  })
  it('el resultado siempre cumple el patrón', () => {
    expect(TICKET_CODE_PATTERN.test(completeTicketCode('sfc62m50wsv6')!)).toBe(true)
  })
})

describe('QR', () => {
  it('genera una matriz cuadrada con los patrones de posición', () => {
    const matrix = qrMatrix('CPA1:0123456789ABCDEFGHJKMNPQRS')
    expect(matrix).toHaveLength(QR_SIZE)
    expect(matrix.every(row => row.length === QR_SIZE)).toBe(true)
    // Esquinas: cuadro de 7×7 con borde oscuro y anillo claro.
    for (const [r, c] of [[0, 0], [0, QR_SIZE - 7], [QR_SIZE - 7, 0]] as const) {
      expect(matrix[r]![c]).toBe(true)
      expect(matrix[r + 1]![c + 1]).toBe(false)
      expect(matrix[r + 3]![c + 3]).toBe(true)
    }
  })
  it('rechaza textos que no caben', () => {
    expect(() => qrMatrix('x'.repeat(200))).toThrow()
  })
})
