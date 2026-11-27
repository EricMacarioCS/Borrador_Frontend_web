/**
 * Raíz de composición: el único archivo que decide qué implementación usa cada puerto.
 * Pasar de la simulación a la API real es cambiar `apiMode` en `config.json`.
 */
import { createContext, useContext } from 'react'
import type { Services } from '@/domain/ports'
import { createHttpAdapters } from '@/adapters/http/adapters'
import type { AppConfig } from './config'

export const ServicesContext = createContext<Services | null>(null)
export const ConfigContext = createContext<AppConfig | null>(null)

export async function createServices(config: AppConfig): Promise<Services> {
  if (config.apiMode === 'http') {
    const { createSignalRSeatChannel } = await import('@/adapters/realtime/signalr')
    return {
      mode: 'http',
      ...createHttpAdapters({ baseUrl: config.apiBaseUrl }),
      seatChannel: createSignalRSeatChannel(config.hubUrl)
    }
  }
  // El simulador se descarga aparte y solo en este modo.
  const { createMockBackend } = await import('@/mocks')
  const mock = createMockBackend({ baseUrl: config.apiBaseUrl, latencyMs: config.mock.latencyMs, failureRate: config.mock.failureRate })
  return {
    mode: 'mock',
    ...createHttpAdapters({ baseUrl: config.apiBaseUrl, fetchImpl: mock.fetchImpl }),
    seatChannel: mock.seatChannel
  }
}

export function useConfig(): AppConfig {
  const config = useContext(ConfigContext)
  if (!config) throw new Error('La configuración no se cargó.')
  return config
}

export function useServices(): Services {
  const services = useContext(ServicesContext)
  if (!services) throw new Error('Los servicios no se inicializaron.')
  return services
}
