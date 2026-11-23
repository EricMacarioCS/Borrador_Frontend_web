/**
 * Estado del simulador. Se guarda en localStorage para compartirse entre pestañas y cada operación
 * corre bajo un candado (Web Locks), igual que una transacción del servidor. Los cambios de asientos
 * se publican por BroadcastChannel para simular SignalR.
 */
import type { PurchaseJson, QuoteJson, QuoteRequestJson, SeatEventJson } from '@/adapters/http/schemas'

const KEY = 'cp-mock-state-v1'
const SESSION_KEY = 'cp-mock-session'
const CHANNEL = 'cp-mock-seats'

export interface HoldRecord { id: string; sid: string; screeningId: string; seatIds: string[]; expiresAt: number }
export interface QuoteRecord {
  id: string; sid: string; expiresAt: number; request: QuoteRequestJson; json: QuoteJson
  screeningId: string | null; linkedTicketCode: string | null
  stock: { key: string; quantity: number }[]
}
export interface PurchaseRecord {
  sid: string; email: string; screeningId: string | null; seatIds: string[]; holdId: string | null
  confirmAt: number; refundAt: number | null; stock: { key: string; quantity: number }[]
  declined: boolean
  json: PurchaseJson
}
export interface MockState {
  v: 1
  sessions: Record<string, { csrf: string; email: string | null; name: string | null; codeAttempts: number[] }>
  holds: Record<string, HoldRecord>
  quotes: Record<string, QuoteRecord>
  purchases: Record<string, PurchaseRecord>
  idempotency: Record<string, { sid: string; scope: string; fingerprint: string; resultId: string }>
  grants: Record<string, { sid: string; ticketCode: string; complexId: string; expiresAt: number }>
  otps: Record<string, { code: string; expiresAt: number; attempts: number; sentAt: number }>
  seatVersions: Record<string, number>
  stockUsed: Record<string, number>
}

const empty = (): MockState => ({
  v: 1, sessions: {}, holds: {}, quotes: {}, purchases: {}, idempotency: {}, grants: {}, otps: {}, seatVersions: {}, stockUsed: {}
})

/** Memoria de respaldo si el navegador bloquea el almacenamiento (también se usa en pruebas). */
let memory: string | null = null
let memorySid: string | null = null

function readRaw(): string | null {
  try { return localStorage.getItem(KEY) ?? memory } catch { return memory }
}
function writeRaw(value: string) {
  memory = value
  try { localStorage.setItem(KEY, value) } catch { /* Se queda en memoria. */ }
}

export function load(): MockState {
  try {
    const parsed = JSON.parse(readRaw() ?? 'null') as MockState | null
    return parsed?.v === 1 ? parsed : empty()
  } catch {
    return empty()
  }
}

export function save(state: MockState) {
  const now = Date.now()
  // Limpieza: lo vencido se descarta para que el estado no crezca sin límite.
  for (const [id, quote] of Object.entries(state.quotes)) if (quote.expiresAt < now - 3600000) delete state.quotes[id]
  for (const [id, grant] of Object.entries(state.grants)) if (grant.expiresAt < now) delete state.grants[id]
  for (const [email, otp] of Object.entries(state.otps)) if (otp.expiresAt < now - 3600000) delete state.otps[email]
  const purchases = Object.values(state.purchases).sort((a, b) => b.json.createdAt.localeCompare(a.json.createdAt))
  for (const old of purchases.slice(300)) delete state.purchases[old.json.id]
  writeRaw(JSON.stringify(state))
}

/** Identificador de sesión del navegador: simula una cookie de sesión. */
export function sessionId(): string {
  try {
    const saved = localStorage.getItem(SESSION_KEY)
    if (saved) return saved
    const created = crypto.randomUUID()
    localStorage.setItem(SESSION_KEY, created)
    return created
  } catch {
    memorySid ??= crypto.randomUUID()
    return memorySid
  }
}

/** Ejecuta la operación con exclusión entre pestañas, como una transacción. */
export async function withLock<T>(run: () => Promise<T> | T): Promise<T> {
  const locks = (globalThis.navigator as Navigator | undefined)?.locks
  if (!locks) return run()
  return locks.request('cp-mock-db', run)
}

/* Eventos de asientos */

type Listener = (event: SeatEventJson) => void
const listeners = new Set<Listener>()
let channel: BroadcastChannel | null = null

function ensureChannel() {
  if (channel || typeof BroadcastChannel === 'undefined') return
  channel = new BroadcastChannel(CHANNEL)
  channel.onmessage = message => listeners.forEach(listener => listener(message.data as SeatEventJson))
}

export function onSeatEvent(listener: Listener): () => void {
  ensureChannel()
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/** Asigna versión consecutiva por función y avisa a esta pestaña y a las demás. */
export function publish(state: MockState, changes: { screeningId: string; changes: SeatEventJson['changes'] }[]): SeatEventJson[] {
  return changes.filter(change => Object.keys(change.changes).length).map(change => {
    const version = (state.seatVersions[change.screeningId] ?? 0) + 1
    state.seatVersions[change.screeningId] = version
    return { screeningId: change.screeningId, version, changes: change.changes }
  })
}

export function deliver(events: SeatEventJson[]) {
  if (!events.length) return
  ensureChannel()
  for (const event of events) {
    listeners.forEach(listener => listener(event))
    channel?.postMessage(event)
  }
}

export function resetForTests() {
  memory = null
  memorySid = null
  try { localStorage.removeItem(KEY); localStorage.removeItem(SESSION_KEY) } catch { /* Sin almacenamiento. */ }
}
