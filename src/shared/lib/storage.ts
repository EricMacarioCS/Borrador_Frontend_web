/**
 * Acceso seguro a localStorage y sessionStorage. Si el navegador lo bloquea,
 * la aplicación sigue funcionando en memoria. Aquí nunca se guardan precios, tokens ni datos de pago.
 */
export interface SafeStorage {
  readonly persistent: boolean
  get<T>(key: string, fallback: T): T
  set(key: string, value: unknown): void
  remove(key: string): void
}

function create(kind: 'localStorage' | 'sessionStorage'): SafeStorage {
  const memory = new Map<string, string>()
  let browser: Storage | null = null
  try {
    const candidate = globalThis[kind]
    candidate.setItem('__cp_probe__', '1')
    candidate.removeItem('__cp_probe__')
    browser = candidate
  } catch { /* Bloqueado: se usa memoria. */ }

  return {
    persistent: browser !== null,
    get<T>(key: string, fallback: T): T {
      try {
        const raw = memory.get(key) ?? browser?.getItem(key) ?? null
        return raw === null ? fallback : JSON.parse(raw) as T
      } catch {
        return fallback
      }
    },
    set(key, value) {
      const raw = JSON.stringify(value)
      try {
        if (browser) { browser.setItem(key, raw); memory.delete(key); return }
      } catch { /* Sin espacio: se usa memoria. */ }
      memory.set(key, raw)
    },
    remove(key) {
      memory.delete(key)
      try { browser?.removeItem(key) } catch { /* Nada que borrar. */ }
    }
  }
}

export const local = create('localStorage')
export const session = create('sessionStorage')
