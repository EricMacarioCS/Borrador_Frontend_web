import { describe, expect, it } from 'vitest'
import type { SeatSnapshot } from '@/domain/models'
import { createSeatSync } from './seatSync'

type Status = SeatSnapshot['seats'][string]
interface Change { version: number; changes: Record<string, Status> }

/** Servidor de juguete: aplica cambios con versión consecutiva. */
function server(seatCount: number) {
  let version = 0
  let seats: Record<string, Status> = Object.fromEntries(Array.from({ length: seatCount }, (_, i) => [`s${i}`, 'available']))
  const log: Change[] = []
  return {
    snapshot: (): SeatSnapshot => ({ version, seats: { ...seats } }),
    change(random: () => number): Change {
      const id = `s${Math.floor(random() * seatCount)}`
      const next: Status = seats[id] === 'available' ? 'held' : 'available'
      version += 1
      seats = { ...seats, [id]: next }
      const event = { version, changes: { [id]: next } }
      log.push(event)
      return event
    },
    get log() { return log }
  }
}

/** Generador determinista para que una falla sea reproducible. */
function seeded(seed: number) {
  let value = seed
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296
    return value / 4294967296
  }
}

/** Deja correr las promesas pendientes (las cargas de prueba se resuelven en microtareas). */
async function flush() {
  for (let i = 0; i < 10; i++) await Promise.resolve()
}

describe('sincronización del mapa', () => {
  it('converge con eventos perdidos, repetidos y desordenados', async () => {
    for (let seed = 1; seed <= 40; seed++) {
      const random = seeded(seed)
      const room = server(30)
      let shown: SeatSnapshot | null = null
      const sync = createSeatSync(() => Promise.resolve(room.snapshot()), state => { shown = state }, () => undefined)
      await sync.sync()

      const delivered: Change[] = []
      for (let i = 0; i < 60; i++) {
        const event = room.change(random)
        const roll = random()
        if (roll < 0.15) continue // perdido
        delivered.push(event)
        if (roll > 0.85) delivered.push(event) // repetido
      }
      // Desordena un poco.
      for (let i = 0; i < delivered.length - 1; i++) {
        if (random() < 0.2) [delivered[i], delivered[i + 1]] = [delivered[i + 1]!, delivered[i]!]
      }
      for (const event of delivered) {
        sync.receive(event)
        await flush()
      }
      await sync.sync() // la consulta periódica cierra cualquier hueco final
      expect(shown, `semilla ${seed}`).toEqual(room.snapshot())
    }
  })

  it('si reconecta durante la carga, vuelve a pedir la foto', async () => {
    const room = server(5)
    let calls = 0
    let release: () => void = () => undefined
    let shown: SeatSnapshot | null = null
    const sync = createSeatSync(async () => {
      calls += 1
      const snapshot = room.snapshot()
      if (calls === 1) await new Promise<void>(resolve => { release = resolve })
      return snapshot
    }, state => { shown = state }, () => undefined)

    const first = sync.sync()
    room.change(() => 0.1) // cambio que la primera foto ya no ve
    void sync.sync() // reconexión mientras carga
    release()
    await first
    await flush()
    expect(calls).toBe(2)
    expect(shown).toEqual(room.snapshot())
  })

  it('no reemplaza lo mostrado con una foto más vieja', async () => {
    const room = server(3)
    const old = room.snapshot()
    let shown: SeatSnapshot | null = null
    const sync = createSeatSync(() => Promise.resolve(old), state => { shown = state }, () => undefined)
    await sync.sync()
    const event = room.change(() => 0)
    sync.receive(event)
    await sync.sync() // el servidor (o una caché) devuelve la foto vieja
    expect(shown).toEqual(room.snapshot())
  })

  it('avisa cuando no puede cargar', async () => {
    let stale = false
    const sync = createSeatSync(() => Promise.reject(new Error('sin red')), () => undefined, () => { stale = true })
    await sync.sync()
    expect(stale).toBe(true)
  })
})
