/** Todos los importes viajan y se guardan en centavos enteros. Nunca se calcula un cobro en el navegador. */
export type Cents = number

const formatters = new Map<string, Intl.NumberFormat>()

function formatter(withDecimals: boolean) {
  const key = withDecimals ? 'd' : 'i'
  let value = formatters.get(key)
  if (!value) {
    value = new Intl.NumberFormat('es-MX', {
      style: 'currency', currency: 'MXN',
      minimumFractionDigits: withDecimals ? 2 : 0, maximumFractionDigits: withDecimals ? 2 : 0
    })
    formatters.set(key, value)
  }
  return value
}

export function isCents(value: unknown): value is Cents {
  return typeof value === 'number' && Number.isSafeInteger(value)
}

/** $83 o $83.50: los centavos solo aparecen cuando existen. */
export function formatMoney(cents: Cents): string {
  if (!isCents(cents)) throw new TypeError(`Importe inválido: ${String(cents)}`)
  return formatter(cents % 100 !== 0).format(cents / 100)
}

export function sumCents(values: readonly Cents[]): Cents {
  return values.reduce((total, value) => total + value, 0)
}
