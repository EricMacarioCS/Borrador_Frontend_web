/**
 * Estado en vivo de los asientos de una función. Orden correcto (sección 7 del análisis):
 * suscribirse, pedir la foto, aplicar eventos; al reconectar, volver a pedir la foto.
 * Además consulta cada 30 s y al volver a la pestaña, por si se perdió el último evento.
 */
import { computed, onBeforeUnmount, ref, shallowRef, watch, type Ref } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import type { ChannelStatus } from '@/domain/ports'
import type { SeatSnapshot } from '@/domain/models'
import { useConfig, useServices } from '@/app/services'
import { createSeatSync } from './seatSync'

export function useSeatMap(screeningId: Ref<string>, layoutRef: Ref<{ id: string; version: number } | null>) {
  const { seats, seatChannel } = useServices()
  const config = useConfig()
  const snapshot = shallowRef<SeatSnapshot | null>(null)
  const channel = ref<ChannelStatus>('connecting')
  const stale = ref(false)

  // El plano no cambia durante la venta: se guarda en caché por versión.
  const layout = useQuery({
    queryKey: computed(() => ['seat-layout', layoutRef.value?.id, layoutRef.value?.version]),
    queryFn: ({ signal }) => seats.getLayout(layoutRef.value!.id, layoutRef.value!.version, signal),
    enabled: computed(() => layoutRef.value !== null),
    staleTime: Infinity
  })

  let cleanup: (() => void) | null = null
  let current: { sync: () => Promise<void> } | null = null

  function start(id: string) {
    let disposed = false
    let retry = 0
    const sync = createSeatSync(
      () => seats.getSeatState(id),
      state => {
        if (disposed) return
        snapshot.value = state
        stale.value = false
      },
      () => {
        if (disposed) return
        stale.value = true
        retry = window.setTimeout(() => void sync.sync(), 3000)
      }
    )

    current = sync
    let unsubscribe: (() => Promise<void>) | null = null
    const subscription = config.features.realtimeSeats
      ? seatChannel.subscribe(id, {
        onEvent: event => { if (!disposed) sync.receive(event) },
        onStatus: status => { if (!disposed) channel.value = status },
        onReconnected: () => { if (!disposed) void sync.sync() }
      }).then(stop => {
        if (disposed) void stop()
        else unsubscribe = stop
      }).catch(() => { channel.value = 'disconnected' })
      : Promise.resolve().then(() => { channel.value = 'disconnected' })

    void subscription.finally(() => { if (!disposed) void sync.sync() })

    const poll = window.setInterval(() => {
      if (document.visibilityState === 'visible') void sync.sync()
    }, config.features.realtimeSeats ? 30000 : 10000)
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
  }

  watch(screeningId, id => {
    cleanup?.()
    snapshot.value = null
    cleanup = start(id)
  }, { immediate: true })

  onBeforeUnmount(() => cleanup?.())

  /** Fuerza una foto nueva, por ejemplo después de un conflicto de asientos. */
  async function refresh() {
    await current?.sync()
  }

  return { layout, snapshot, channel, stale, refresh }
}

