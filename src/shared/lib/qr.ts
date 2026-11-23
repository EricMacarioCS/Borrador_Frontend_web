/**
 * Generador QR local (versión 3, corrección L, máscara 0, modo byte).
 * Se genera en el navegador para no enviar el token de acceso a servicios externos.
 * Admite hasta 53 bytes; el token de acceso del backend debe respetar ese límite o usar otra versión.
 */
const SIZE = 29
const DATA_BYTES = 55
const EC_BYTES = 15
export const QR_MAX_BYTES = 53
export const QR_SIZE = SIZE

function multiply(a: number, b: number) {
  let result = 0
  for (let i = 7; i >= 0; i--) {
    result = (result << 1) ^ ((result >>> 7) * 0x11d)
    result ^= ((b >>> i) & 1) * a
  }
  return result
}

function errorCorrection(data: number[]) {
  const divisor = Array<number>(EC_BYTES - 1).fill(0).concat(1)
  let root = 1
  for (let i = 0; i < EC_BYTES; i++) {
    for (let j = 0; j < EC_BYTES; j++) {
      divisor[j] = multiply(divisor[j]!, root)
      if (j + 1 < EC_BYTES) divisor[j] = divisor[j]! ^ divisor[j + 1]!
    }
    root = multiply(root, 2)
  }
  const result = Array<number>(EC_BYTES).fill(0)
  for (const byte of data) {
    const factor = byte ^ result.shift()!
    result.push(0)
    divisor.forEach((value, i) => { result[i] = result[i]! ^ multiply(value, factor) })
  }
  return result
}

export function qrMatrix(text: string): boolean[][] {
  const bytes = [...new TextEncoder().encode(text)]
  if (bytes.length > QR_MAX_BYTES) throw new RangeError('El texto no cabe en el código QR.')

  const bits: number[] = []
  const push = (value: number, length: number) => {
    for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1)
  }
  push(4, 4)
  push(bytes.length, 8)
  bytes.forEach(byte => push(byte, 8))
  push(0, 4)
  const data: number[] = []
  for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join('').padEnd(8, '0'), 2))
  for (let filler = 0xec; data.length < DATA_BYTES; filler ^= 0xec ^ 0x11) data.push(filler)
  const codewords = [...data, ...errorCorrection(data)]

  const grid = Array.from({ length: SIZE }, () => Array<boolean>(SIZE).fill(false))
  const fixed = Array.from({ length: SIZE }, () => Array<boolean>(SIZE).fill(false))
  const set = (x: number, y: number, dark: boolean) => {
    if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return
    grid[y]![x] = dark
    fixed[y]![x] = true
  }

  for (let i = 0; i < SIZE; i++) {
    set(6, i, i % 2 === 0)
    set(i, 6, i % 2 === 0)
  }
  for (const [cx, cy] of [[3, 3], [SIZE - 4, 3], [3, SIZE - 4]] as const) {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const ring = Math.max(Math.abs(dx), Math.abs(dy))
        set(cx + dx, cy + dy, ring !== 2 && ring !== 4)
      }
    }
  }
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) set(22 + dx, 22 + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1)
  }

  const formatData = 1 << 3
  let remainder = formatData
  for (let i = 0; i < 10; i++) remainder = (remainder << 1) ^ ((remainder >>> 9) * 0x537)
  const format = ((formatData << 10) | remainder) ^ 0x5412
  const bit = (i: number) => ((format >>> i) & 1) === 1
  for (let i = 0; i <= 5; i++) set(8, i, bit(i))
  set(8, 7, bit(6))
  set(8, 8, bit(7))
  set(7, 8, bit(8))
  for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i))
  for (let i = 0; i < 8; i++) set(SIZE - 1 - i, 8, bit(i))
  for (let i = 8; i < 15; i++) set(8, SIZE - 15 + i, bit(i))
  set(8, SIZE - 8, true)

  let index = 0
  let upward = true
  for (let right = SIZE - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5
    for (let step = 0; step < SIZE; step++) {
      const y = upward ? SIZE - 1 - step : step
      for (const x of [right, right - 1]) {
        if (fixed[y]![x]) continue
        const dark = index < codewords.length * 8 && ((codewords[index >>> 3]! >>> (7 - (index & 7))) & 1) === 1
        grid[y]![x] = dark !== ((x + y) % 2 === 0)
        index++
      }
    }
    upward = !upward
  }
  return grid
}

/** Ruta SVG con margen de 4 módulos. */
export function qrPath(text: string): string {
  return qrMatrix(text)
    .flatMap((row, y) => row.map((dark, x) => dark ? `M${x + 4} ${y + 4}h1v1h-1z` : ''))
    .join('')
}
