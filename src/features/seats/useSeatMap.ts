/**
 * Estado en vivo de los asientos de una función. Orden correcto (sección 7 del análisis):
 * suscribirse, pedir la foto, aplicar eventos; al reconectar, volver a pedir la foto.
 * Además consulta cada 30 s y al volver a la pestaña, por si se perdió el último evento.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { ChannelStatus } from '@/domain/ports'
import type { SeatSnapshot } from '@/domain/models'
import { useConfig, useServices } from '@/app/services'
import { createSeatSync } from './seatSync'

export function useSeatMap(screeningId: string, layoutRef: { id: string; version: number } | null) {
  const { seats, seatChannel } = useServices()
  const config = useConfig()
  const realtime = config.features.realtimeSeats
  const [snapshot, setSnapshot] = useState<SeatSnapshot | null>(null)
  const [channel, setChannel] = useState<ChannelStatus>('connecting')
  const [stale, setStale] = useState(false)
  const current = useRef<{ sync: () => Promise<void> } | null>(null)

  // El plano no cambia durante la venta: se guarda en caché por versión.
  const layoutId = layoutRef?.id
  const layoutVersion = layoutRef?.version
  const layout = useQuery({
    queryKey: ['seat-layout', layoutId, layoutVersion],
    queryFn: ({ signal }) => seats.getLayout(layoutId!, layoutVersion!, signal),
    enabled: layoutId !== undefined,
    staleTime: Infinity
  })

  // Cambiar de función reinicia la foto. Se ajusta durante el render para no pintar la foto anterior.
  const [shownId, setShownId] = useState(screeningId)
  if (shownId !== screeningId) {
    setShownId(screeningId)
    setSnapshot(null)
  }

  useEffect(() => {
    let disposed = false
    let retry = 0
    const sync = createSeatSync(
      () => seats.getSeatState(screeningId),
      state => {
        if (disposed) return
        setSnapshot(state)
        setStale(false)
      },
      () => {
        if (disposed) return
        setStale(true)
        retry = window.setTimeout(() => void sync.sync(), 3000)
      }
    )

    current.current = sync
    let unsubscribe: (() => Promise<void>) | null = null
    const subscription = realtime
      ? seatChannel.subscribe(screeningId, {
        onEvent: event => { if (!disposed) sync.receive(event) },
        onStatus: status => { if (!disposed) setChannel(status) },
        onReconnected: () => { if (!disposed) void sync.sync() }
      }).then(stop => {
        if (disposed) void stop()
        else unsubscribe = stop
      }).catch(() => { if (!disposed) setChannel('disconnected') })
      : Promise.resolve().then(() => { if (!disposed) setChannel('disconnected') })

    void subscription.finally(() => { if (!disposed) void sync.sync() })

    const poll = window.setInterval(() => {
      if (document.visibilityState === 'visible') void sync.sync()
    }, realtime ? 30000 : 10000)
    const onVisible = () => { if (document.visibilityState === 'visible') void sync.sync() }
    const onShow = (event: PageTransitionEvent) => { if (event.persisted) void sync.sync() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('pageshow', onShow)

    return () => {
      disposed = true
      clearTimeout(retry)
      clearInterval(poll)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('pageshow', onShow)
      void unsubscribe?.()
    }
  }, [screeningId, realtime, seats, seatChannel])

  /** Fuerza una foto nueva, por ejemplo después de un conflicto de asientos. */
  const refresh = useCallback(async () => {
    await current.current?.sync()
  }, [])

  return { layout, snapshot, channel, stale, refresh }
}
