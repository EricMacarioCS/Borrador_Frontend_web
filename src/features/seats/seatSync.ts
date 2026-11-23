/**
 * Sincronizador del mapa: foto completa con versión + eventos numerados.
 * Tolera eventos perdidos, repetidos o desordenados, y reconexiones durante la carga.
 * No depende de SignalR: recibe la carga y los eventos desde fuera.
 */
import type { SeatEvent, SeatSnapshot } from '@/domain/models'

export interface SeatSync {
  sync(): Promise<void>
  receive(event: Pick<SeatEvent, 'version' | 'changes'>): void
}

export function createSeatSync(
  load: () => Promise<SeatSnapshot>,
  publish: (state: SeatSnapshot) => void,
  onStale: (error: unknown) => void
): SeatSync {
  let state: SeatSnapshot | null = null
  let pending: Pick<SeatEvent, 'version' | 'changes'>[] = []
  let syncing = false
  let again = false

  async function sync(): Promise<void> {
    if (syncing) {
      again = true // por ejemplo, reconectó durante la carga
      return
    }
    syncing = true
    try {
      const snapshot = await load()
      // Una foto más vieja que lo ya mostrado no lo reemplaza.
      state = state && state.version > snapshot.version ? state : snapshot
      syncing = false
      const queued = pending.sort((a, b) => a.version - b.version)
      pending = []
      publish(state)
      queued.forEach(receive)
      if (again) {
        again = false
        void sync()
      }
    } catch (error) {
      syncing = false
      again = false
      onStale(error)
    }
  }

  function receive(event: Pick<SeatEvent, 'version' | 'changes'>): void {
    if (syncing || !state) {
      pending.push(event)
      return
    }
    if (event.version <= state.version) return
    if (event.version > state.version + 1) {
      pending.push(event)
      void sync()
      return
    }
    state = { version: event.version, seats: { ...state.seats, ...event.changes } }
    publish(state)
  }

  return { sync, receive }
}
