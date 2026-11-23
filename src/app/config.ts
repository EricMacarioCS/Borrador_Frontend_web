import { z } from 'zod'

/**
 * Configuración en tiempo de ejecución. Se lee de `/config.json` para promover la misma compilación
 * entre ambientes; las variables VITE_* solo dan valores de respaldo.
 */
const ConfigSchema = z.object({
  apiMode: z.enum(['mock', 'http']),
  apiBaseUrl: z.string().min(1),
  hubUrl: z.string().min(1),
  environmentName: z.string(),
  supportEmail: z.string().nullable(),
  features: z.object({
    realtimeSeats: z.boolean(),
    onlinePayments: z.boolean(),
    accounts: z.boolean()
  }),
  mock: z.object({
    latencyMs: z.tuple([z.number().int().min(0), z.number().int().min(0)]),
    failureRate: z.number().min(0).max(1)
  })
})

export type AppConfig = z.infer<typeof ConfigSchema>

const defaults: AppConfig = {
  apiMode: import.meta.env.VITE_API_MODE ?? 'mock',
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '/api/v1',
  hubUrl: import.meta.env.VITE_HUB_URL ?? '/hubs/seats',
  environmentName: 'local',
  supportEmail: null,
  features: { realtimeSeats: true, onlinePayments: true, accounts: true },
  mock: { latencyMs: [120, 420], failureRate: 0 }
}

export async function loadConfig(): Promise<AppConfig> {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}config.json`, { cache: 'no-store' })
    if (!response.ok) return defaults
    const raw = await response.json() as Partial<AppConfig>
    const merged = {
      ...defaults, ...raw,
      features: { ...defaults.features, ...raw.features },
      mock: { ...defaults.mock, ...raw.mock }
    }
    const parsed = ConfigSchema.safeParse(merged)
    if (!parsed.success) {
      console.error('config.json inválido; se usan valores por defecto.', parsed.error.issues)
      return defaults
    }
    return parsed.data
  } catch {
    return defaults
  }
}
