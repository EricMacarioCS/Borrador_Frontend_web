/**
 * Canal de asientos sobre SignalR. Solo avisa cambios: las operaciones van por REST.
 * Contrato del hub (`/hubs/seats`):
 *   cliente → SubscribeScreening(screeningId), UnsubscribeScreening(screeningId)
 *   hub → SeatsChanged({ screeningId, version, changes })
 */
import { HubConnectionBuilder, HubConnectionState, LogLevel, type HubConnection, type IRetryPolicy } from '@microsoft/signalr'
import type { ChannelStatus, SeatChannelPort } from '@/domain/ports'
import type { SeatEvent } from '@/domain/models'
import { SeatEventDto } from '@/adapters/http/schemas'

/** Reintenta para siempre con espera creciente y variación aleatoria, hasta 30 s. */
const retryForever: IRetryPolicy = {
  nextRetryDelayInMilliseconds: ({ previousRetryCount }) =>
    Math.min(30000, 1000 * 2 ** Math.min(previousRetryCount, 5)) * (0.7 + Math.random() * 0.6)
}

export function createSignalRSeatChannel(hubUrl: string): SeatChannelPort {
  let connection: HubConnection | null = null
  let starting: Promise<void> | null = null
  const subscriptions = new Map<string, Set<{
    onEvent: (event: SeatEvent) => void
    onStatus: (status: ChannelStatus) => void
    onReconnected: () => void
  }>>()

  const broadcastStatus = (status: ChannelStatus) => subscriptions.forEach(set => set.forEach(handler => handler.onStatus(status)))

  function build(): HubConnection {
    const hub = new HubConnectionBuilder()
      .withUrl(hubUrl, { withCredentials: true })
      .withAutomaticReconnect(retryForever)
      .configureLogging(LogLevel.Warning)
      .build()

    hub.on('SeatsChanged', (payload: unknown) => {
      const parsed = SeatEventDto.safeParse(payload)
      if (!parsed.success) return console.warn('Evento de asientos inválido', parsed.error.issues)
      subscriptions.get(parsed.data.screeningId)?.forEach(handler => handler.onEvent(parsed.data))
    })
    hub.onreconnecting(() => broadcastStatus('reconnecting'))
    hub.onreconnected(() => {
      // Los grupos no sobreviven a la reconexión: primero se vuelve a suscribir, luego se pide la foto.
      void (async () => {
        for (const screeningId of subscriptions.keys()) await hub.invoke('SubscribeScreening', screeningId)
        broadcastStatus('connected')
        subscriptions.forEach(set => set.forEach(handler => handler.onReconnected()))
      })()
    })
    hub.onclose(() => broadcastStatus('disconnected'))
    return hub
  }

  async function ensureStarted(): Promise<HubConnection> {
    connection ??= build()
    if (connection.state === HubConnectionState.Connected) return connection
    // La reconexión automática no cubre el primer arranque: se reintenta aquí.
    starting ??= (async () => {
      for (let attempt = 0; ; attempt++) {
        try {
          await connection.start()
          return
        } catch (error) {
          if (attempt >= 4) throw error
          await new Promise(resolve => setTimeout(resolve, retryForever.nextRetryDelayInMilliseconds({
            previousRetryCount: attempt, elapsedMilliseconds: 0, retryReason: error as Error
          }) ?? 1000))
        }
      }
    })().finally(() => { starting = null })
    await starting
    return connection
  }

  return {
    async subscribe(screeningId, handlers) {
      handlers.onStatus('connecting')
      const set = subscriptions.get(screeningId) ?? new Set()
      set.add(handlers)
      subscriptions.set(screeningId, set)
      try {
        const hub = await ensureStarted()
        if (set.size === 1) await hub.invoke('SubscribeScreening', screeningId)
        handlers.onStatus('connected')
      } catch {
        handlers.onStatus('disconnected')
      }
      return async () => {
        set.delete(handlers)
        if (set.size) return
        subscriptions.delete(screeningId)
        if (connection?.state === HubConnectionState.Connected) {
          await connection.invoke('UnsubscribeScreening', screeningId).catch(() => undefined)
        }
        if (!subscriptions.size) await connection?.stop().catch(() => undefined)
      }
    }
  }
}
