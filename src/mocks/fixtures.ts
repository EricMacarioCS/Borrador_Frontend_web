/**
 * Datos por defecto del simulador. Son ficticios y siguen la forma de la base de datos:
 * complejos de Veracruz (la versión VIP es otro complejo), salas con tipo fijo y proyección 2D o 3D,
 * precios explícitos por complejo, tipo de sala, proyección y tipo de boleto, y dulcería con reglas.
 */
import { addDays, dateInZone, DEFAULT_TIME_ZONE } from '@/shared/lib/datetime'
import type { ComplexJson, MovieJson, PromotionJson } from '@/adapters/http/schemas'

export const TIME_ZONE = DEFAULT_TIME_ZONE
export const LIMITS = { maxSeatsPerPurchase: 10, scheduleDays: 14, cancelMinutesBefore: 60 }
export const HOLD_MINUTES = 10
export const QUOTE_MINUTES = 10
export const CLEANING_MINUTES = 20
export const SERVICE_FEE_CENTS = 600

export const today = () => dateInZone(new Date(), TIME_ZONE)

/* Complejos y salas */

export interface RoomFixture {
  id: string
  number: number
  type: 'traditional' | 'imax' | 'macro-xe' | '4dx' | 'junior' | 'vip'
  projections: ('2d' | '3d')[]
}
export interface ComplexFixture extends ComplexJson {
  baseCents: number
  rooms: RoomFixture[]
}

export const ROOM_TYPES: Record<RoomFixture['type'], { name: string; surchargeCents: number }> = {
  'traditional': { name: 'Tradicional', surchargeCents: 0 },
  'junior': { name: 'Junior', surchargeCents: 1000 },
  'macro-xe': { name: 'Macro XE', surchargeCents: 3000 },
  'imax': { name: 'IMAX', surchargeCents: 4500 },
  '4dx': { name: '4DX', surchargeCents: 6000 },
  'vip': { name: 'VIP', surchargeCents: 7000 }
}
export const PROJECTIONS = { '2d': { name: '2D', surchargeCents: 0 }, '3d': { name: '3D', surchargeCents: 2500 } } as const
export const LANGUAGES = { es: 'Español', sub: 'Subtitulada' } as const

function rooms(prefix: string, types: [RoomFixture['type'], boolean][]): RoomFixture[] {
  return types.map(([type, threeD], i) => ({
    id: `${prefix}-r${i + 1}`, number: i + 1, type, projections: threeD ? ['2d', '3d'] : ['2d']
  }))
}

const base = { kind: 'traditional', address: 'Dirección por confirmar', timeZone: TIME_ZONE }

export const COMPLEXES: ComplexFixture[] = [
  {
    ...base, id: 'xal-centro', slug: 'xalapa-centro', name: 'Xalapa Centro', city: 'Xalapa', baseCents: 8500,
    rooms: rooms('xal-centro', [['imax', true], ['macro-xe', true], ['4dx', true], ['traditional', true], ['traditional', false], ['traditional', false], ['junior', false]])
  },
  {
    ...base, id: 'xal-centro-vip', slug: 'xalapa-centro-vip', name: 'Xalapa Centro VIP', city: 'Xalapa', kind: 'vip', baseCents: 9500,
    rooms: rooms('xal-centro-vip', [['vip', true], ['vip', false], ['vip', false]])
  },
  {
    ...base, id: 'ver-boulevard', slug: 'veracruz-boulevard', name: 'Veracruz Boulevard', city: 'Veracruz', baseCents: 9000,
    rooms: rooms('ver-boulevard', [['macro-xe', true], ['traditional', true], ['traditional', false], ['traditional', false], ['traditional', true], ['junior', false]])
  },
  {
    ...base, id: 'boca-costa', slug: 'boca-del-rio-costa', name: 'Boca del Río Costa', city: 'Boca del Río', baseCents: 9200,
    rooms: rooms('boca-costa', [['imax', true], ['traditional', true], ['traditional', false], ['traditional', false], ['4dx', true]])
  },
  {
    ...base, id: 'coatza-malecon', slug: 'coatzacoalcos-malecon', name: 'Coatzacoalcos Malecón', city: 'Coatzacoalcos', baseCents: 7900,
    rooms: rooms('coatza-malecon', [['traditional', true], ['traditional', false], ['traditional', false], ['macro-xe', false], ['traditional', false]])
  },
  {
    ...base, id: 'cordoba-parque', slug: 'cordoba-parque', name: 'Córdoba Parque', city: 'Córdoba', baseCents: 7600,
    rooms: rooms('cordoba-parque', [['traditional', true], ['traditional', false], ['traditional', false], ['junior', false]])
  }
]

export const findComplex = (id: string) => COMPLEXES.find(complex => complex.id === id)

/* Planos: no rectangulares, con pasillos, lugares accesibles y numeración de derecha a izquierda. */

export interface LayoutFixture {
  id: string
  version: number
  rows: { label: string; cells: ({ id: string; label: string; kind: 'standard' | 'accessible' | 'companion' | 'premium' } | null)[] }[]
}

const SHAPES: Record<RoomFixture['type'], { rows: number; columns: number; aisles: number[]; group?: number; premium?: boolean }> = {
  'traditional': { rows: 12, columns: 20, aisles: [4, 16] },
  'junior': { rows: 8, columns: 14, aisles: [7] },
  'macro-xe': { rows: 13, columns: 24, aisles: [5, 19] },
  'imax': { rows: 14, columns: 26, aisles: [6, 20] },
  '4dx': { rows: 8, columns: 16, aisles: [], group: 4 },
  'vip': { rows: 6, columns: 12, aisles: [], group: 2, premium: true }
}

const layoutCache = new Map<string, LayoutFixture>()

export function layoutFor(room: RoomFixture): LayoutFixture {
  const cached = layoutCache.get(room.id)
  if (cached) return cached
  const shape = SHAPES[room.type]
  const columns = shape.group ? shape.columns + Math.floor((shape.columns - 1) / shape.group) : shape.columns
  const layout: LayoutFixture = {
    id: `lay-${room.id}`, version: 1,
    rows: Array.from({ length: shape.rows }, (_, row) => {
      const letter = String.fromCharCode(65 + row)
      const kinds = Array.from({ length: columns }, (_, column) => {
        if (shape.group) return (column + 1) % (shape.group + 1) === 0 ? 'gap' : shape.premium ? 'premium' : 'standard'
        if (shape.aisles.includes(column)) return 'gap'
        if (row === 2 && (column < 2 || column >= columns - 2)) return column % 2 === 0 ? 'accessible' : 'companion'
        // La última fila deja libres los extremos para la salida.
        if (row === shape.rows - 1 && (column === 0 || column === columns - 1)) return 'gap'
        return 'standard'
      })
      let number = kinds.filter(kind => kind !== 'gap').length
      return {
        label: letter,
        cells: kinds.map(kind => {
          if (kind === 'gap') return null
          const label = `${letter}${number--}`
          return { id: `${room.id}-${label}`, label, kind: kind }
        })
      }
    })
  }
  layoutCache.set(room.id, layout)
  return layout
}

export const seatIdsOf = (layout: LayoutFixture) => layout.rows.flatMap(row => row.cells.flatMap(cell => cell ? [cell.id] : []))

/* Películas y eventos. Fechas relativas al día de hoy. */

export interface MovieFixture extends Omit<MovieJson, 'stage' | 'releaseDate'> {
  releaseOffset: number
  presaleOffset: number | null
  lastDayOffset: number | null
}

const media = { posterUrl: null, backdropUrl: null, trailerUrl: null }
const movie = (fixture: Omit<MovieFixture, 'media' | 'cast'> & { cast?: MovieFixture['cast'] }): MovieFixture =>
  ({ media, cast: [], ...fixture })

export const MOVIES: MovieFixture[] = [
  movie({
    id: 'm-101', slug: 'horizonte-infinito', title: 'Horizonte infinito', durationMinutes: 138,
    rating: { code: 'B', description: 'Para adolescentes de 12 años en adelante' }, genres: ['Ciencia ficción', 'Aventura'],
    isSpecialEvent: false, releaseOffset: -3, presaleOffset: null, lastDayOffset: null, accent: '#5fd4ff',
    synopsis: 'Una tripulación cruza los límites del sistema solar para encontrar un nuevo hogar para la humanidad.',
    cast: [{ name: 'Lucía Arreola', role: 'director' }, { name: 'Tomás Rivera', role: 'actor' }, { name: 'Ana Belmonte', role: 'actor' }]
  }),
  movie({
    id: 'm-102', slug: 'ciudad-de-sombras', title: 'Ciudad de sombras', durationMinutes: 114,
    rating: { code: 'B15', description: 'No recomendada para menores de 15 años' }, genres: ['Suspenso'],
    isSpecialEvent: false, releaseOffset: 9, presaleOffset: -2, lastDayOffset: null, accent: '#a78bfa',
    synopsis: 'Una detective sigue una pista imposible a través de una ciudad que nunca duerme.',
    cast: [{ name: 'Mateo Llorente', role: 'director' }, { name: 'Sofía Durán', role: 'actor' }]
  }),
  movie({
    id: 'm-103', slug: 'el-ultimo-verano', title: 'El último verano', durationMinutes: 107,
    rating: { code: 'A', description: 'Para todo público' }, genres: ['Drama'],
    isSpecialEvent: false, releaseOffset: -25, presaleOffset: null, lastDayOffset: null, accent: '#ffb86b',
    synopsis: 'Cuatro amigos vuelven al lugar donde crecieron para cumplir una promesa pendiente.'
  }),
  movie({
    id: 'm-104', slug: 'fuego-del-norte', title: 'Fuego del norte', durationMinutes: 126,
    rating: { code: 'B', description: 'Para adolescentes de 12 años en adelante' }, genres: ['Aventura', 'Acción'],
    isSpecialEvent: false, releaseOffset: -6, presaleOffset: null, lastDayOffset: null, accent: '#ff7a59',
    synopsis: 'Una exploradora debe atravesar territorio desconocido para recuperar un antiguo mapa.',
    cast: [{ name: 'Iván Castañeda', role: 'director' }, { name: 'Regina Paz', role: 'actor' }]
  }),
  movie({
    id: 'm-105', slug: 'la-gran-travesia', title: 'La gran travesía', durationMinutes: 98,
    rating: { code: 'AA', description: 'Para todo público, comprensible para menores de 7 años' }, genres: ['Animación', 'Comedia'],
    isSpecialEvent: false, releaseOffset: -12, presaleOffset: null, lastDayOffset: null, accent: '#7ee787',
    synopsis: 'Un grupo de animales del bosque emprende un viaje para salvar el río que les da hogar.'
  }),
  movie({
    id: 'm-106', slug: 'ecos-del-abismo', title: 'Ecos del abismo', durationMinutes: 101,
    rating: { code: 'C', description: 'Para adultos de 18 años en adelante' }, genres: ['Terror'],
    isSpecialEvent: false, releaseOffset: -2, presaleOffset: null, lastDayOffset: null, accent: '#ff4d6d',
    synopsis: 'Una expedición submarina descubre que algo responde a sus señales desde el fondo del océano.'
  }),
  movie({
    id: 'm-107', slug: 'risas-en-la-carretera', title: 'Risas en la carretera', durationMinutes: 112,
    rating: { code: 'B', description: 'Para adolescentes de 12 años en adelante' }, genres: ['Comedia'],
    isSpecialEvent: false, releaseOffset: 16, presaleOffset: null, lastDayOffset: null, accent: '#ffd166',
    synopsis: 'Dos hermanos que no se hablan desde hace años comparten un viaje de tres días hacia la boda de su madre.'
  }),
  movie({
    id: 'm-108', slug: 'guardianes-del-arrecife', title: 'Guardianes del arrecife', durationMinutes: 92,
    rating: { code: 'AA', description: 'Para todo público, comprensible para menores de 7 años' }, genres: ['Animación', 'Aventura'],
    isSpecialEvent: false, releaseOffset: -4, presaleOffset: null, lastDayOffset: null, accent: '#4cc9f0',
    synopsis: 'Una tortuga marina y un pez payaso unen fuerzas para proteger su arrecife de una tormenta.'
  }),
  movie({
    id: 'm-109', slug: 'la-traviata-en-vivo', title: 'La Traviata en vivo', durationMinutes: 160,
    rating: { code: 'A', description: 'Para todo público' }, genres: ['Música', 'Ópera'],
    isSpecialEvent: true, releaseOffset: 5, presaleOffset: -7, lastDayOffset: 5, accent: '#f72585',
    synopsis: 'Transmisión de ópera desde un teatro europeo. Programación de demostración.'
  }),
  movie({
    id: 'm-110', slug: 'sinfonia-bajo-las-estrellas', title: 'Sinfonía bajo las estrellas', durationMinutes: 110,
    rating: { code: 'AA', description: 'Para todo público, comprensible para menores de 7 años' }, genres: ['Música'],
    isSpecialEvent: true, releaseOffset: 2, presaleOffset: -7, lastDayOffset: 2, accent: '#b5179e',
    synopsis: 'Una experiencia audiovisual con orquesta en vivo, por una sola noche.'
  })
]

export const movieDates = (fixture: MovieFixture) => {
  const day = today()
  return {
    release: addDays(day, fixture.releaseOffset),
    saleStart: fixture.presaleOffset === null ? null : addDays(day, fixture.presaleOffset),
    lastDay: fixture.lastDayOffset === null ? null : addDays(day, fixture.lastDayOffset)
  }
}

export function stageOf(fixture: MovieFixture): MovieJson['stage'] {
  const day = today()
  const { release, saleStart } = movieDates(fixture)
  if (release > day) return saleStart && saleStart <= day ? 'presale' : 'coming-soon'
  return addDays(release, 14) >= day ? 'premiere' : 'now-showing'
}

/** Días en que la película se puede comprar. */
export function onSaleFrom(fixture: MovieFixture): string | null {
  const { release, saleStart } = movieDates(fixture)
  if (release <= today()) return today()
  return saleStart && saleStart <= today() ? release : null
}

/* Tipos de boleto y precios explícitos. */

export const TICKET_TYPES = [
  { id: 'tt-general', name: 'General', description: 'Admisión general', percent: 100 },
  { id: 'tt-child', name: 'Niño', description: 'De 3 a 11 años', percent: 75 },
  { id: 'tt-senior', name: 'Adulto mayor', description: '60 años o más, con credencial INAPAM', percent: 80 }
] as const

const RESTRICTED_FOR_CHILDREN = new Set(['B15', 'C', 'D'])

/**
 * En la base de datos cada precio está escrito de forma explícita. El simulador los genera una vez
 * al peso entero, de modo que no hay redondeos en tiempo de compra.
 */
export function ticketPriceCents(complex: ComplexFixture, room: RoomFixture, projection: '2d' | '3d', ticketTypeId: string): number {
  const full = complex.baseCents + ROOM_TYPES[room.type].surchargeCents + PROJECTIONS[projection].surchargeCents
  const type = TICKET_TYPES.find(item => item.id === ticketTypeId)
  if (!type) throw new Error(`Tipo de boleto desconocido: ${ticketTypeId}`)
  return Math.round(full * type.percent / 100 / 100) * 100
}

export const childAllowed = (ratingCode: string) => !RESTRICTED_FOR_CHILDREN.has(ratingCode)

/* Promociones. Las condiciones se evalúan en el servidor, nunca en la interfaz. */

export interface PromotionFixture extends Omit<PromotionJson, 'validFrom' | 'validTo'> {
  rule: { kind: '2x1' | 'percent' | 'none'; percent?: number; weekdays?: number[]; roomTypes?: RoomFixture['type'][]; projections?: ('2d' | '3d')[] }
}

export const PROMOTIONS: PromotionFixture[] = [
  {
    id: 'promo-martes', title: '2×1 los martes', tag: 'Martes', appliesOnline: true,
    description: 'Dos boletos al precio de uno en salas tradicionales.',
    conditions: 'Funciones de martes en sala Tradicional 2D. En cada par no se cobra el boleto de menor precio. No es acumulable.',
    rule: { kind: '2x1', weekdays: [2], roomTypes: ['traditional'], projections: ['2d'] }
  },
  {
    id: 'promo-imax', title: 'Jueves IMAX', tag: 'Formato', appliesOnline: true,
    description: '20 % de descuento en boletos IMAX.',
    conditions: 'Funciones de jueves en salas IMAX. No es acumulable.',
    rule: { kind: 'percent', percent: 20, weekdays: [4], roomTypes: ['imax'] }
  },
  {
    id: 'promo-matine', title: 'Matiné familiar', tag: 'Familia', appliesOnline: true,
    description: '15 % de descuento en funciones de fin de semana antes de las 15:00.',
    conditions: 'Funciones de sábado y domingo que inicien antes de las 15:00. No es acumulable.',
    rule: { kind: 'percent', percent: 15, weekdays: [0, 6] }
  },
  {
    id: 'promo-msi', title: 'Meses sin intereses', tag: 'Banco', appliesOnline: false,
    description: 'Ejemplo de campaña bancaria para compras en taquilla.',
    conditions: 'Informativa: no se aplica en compras en línea.',
    rule: { kind: 'none' }
  }
]

/* Dulcería */

export interface ProductFixture {
  n: number
  name: string
  description: string
  category: 'combos' | 'palomitas' | 'bebidas' | 'alimentos' | 'dulces' | 'promocionales'
  structure: 'simple' | 'compound' | 'combo'
  baseCents: number
  requiresTicketCode: boolean
  /** Existencias limitadas para demostrar productos agotados. */
  stock?: number
  rules: { key: string; title: string; kind: string; min: number; max: number; allowSplit?: boolean; options: [string, number, boolean?][] }[]
}

export const CATEGORIES: Record<ProductFixture['category'], string> = {
  combos: 'Combos', palomitas: 'Palomitas', bebidas: 'Bebidas', alimentos: 'Alimentos', dulces: 'Dulces', promocionales: 'Promocionales'
}

const popcornFlavors: [string, number, boolean?][] = [['Mantequilla', 0, true], ['Caramelo', 0], ['Queso', 0], ['Chile y limón', 0]]
const drinkFlavors: [string, number, boolean?][] = [['Cola', 0, true], ['Cola sin azúcar', 0], ['Limón', 0], ['Naranja', 0]]

export const PRODUCTS: ProductFixture[] = [
  {
    n: 1, name: 'Combo pareja', description: 'Palomitas grandes y dos refrescos grandes', category: 'combos', structure: 'combo',
    baseCents: 18900, requiresTicketCode: true,
    rules: [
      { key: 'sabor', title: 'Elige hasta 2 sabores de palomitas', kind: 'flavor', min: 1, max: 2, allowSplit: true, options: popcornFlavors },
      { key: 'bebida1', title: 'Primer refresco', kind: 'choice', min: 1, max: 1, options: drinkFlavors },
      { key: 'bebida2', title: 'Segundo refresco', kind: 'choice', min: 1, max: 1, options: drinkFlavors }
    ]
  },
  {
    n: 2, name: 'Combo individual', description: 'Palomitas medianas y un refresco mediano', category: 'combos', structure: 'combo',
    baseCents: 12900, requiresTicketCode: true,
    rules: [
      { key: 'sabor', title: 'Sabor de palomitas', kind: 'flavor', min: 1, max: 1, options: popcornFlavors },
      { key: 'bebida', title: 'Refresco', kind: 'choice', min: 1, max: 1, options: drinkFlavors }
    ]
  },
  {
    n: 3, name: 'Palomitas', description: 'Recién hechas, con tu sabor favorito', category: 'palomitas', structure: 'compound',
    baseCents: 5900, requiresTicketCode: true,
    rules: [
      { key: 'tamano', title: 'Tamaño', kind: 'size', min: 1, max: 1, options: [['Chicas', 0], ['Medianas', 1500, true], ['Grandes', 3000], ['Jumbo', 4500]] },
      { key: 'sabor', title: 'Elige hasta 2 sabores', kind: 'flavor', min: 1, max: 2, allowSplit: true, options: popcornFlavors },
      { key: 'extra', title: 'Extras', kind: 'extra', min: 0, max: 2, options: [['Mantequilla extra', 1000], ['Chile en polvo', 500]] }
    ]
  },
  {
    n: 4, name: 'Refresco', description: 'Bien frío, en el sabor que elijas', category: 'bebidas', structure: 'compound',
    baseCents: 4900, requiresTicketCode: true,
    rules: [
      { key: 'tamano', title: 'Tamaño', kind: 'size', min: 1, max: 1, options: [['Mediano', 0, true], ['Grande', 1000], ['Jumbo', 2000]] },
      { key: 'sabor', title: 'Sabor', kind: 'flavor', min: 1, max: 1, options: drinkFlavors }
    ]
  },
  { n: 5, name: 'Agua natural', description: 'Botella de 600 ml', category: 'bebidas', structure: 'simple', baseCents: 3500, requiresTicketCode: true, rules: [] },
  {
    n: 6, name: 'Nachos con queso', description: 'Totopos con queso caliente', category: 'alimentos', structure: 'compound',
    baseCents: 7900, requiresTicketCode: true,
    rules: [{ key: 'extra', title: 'Extras', kind: 'extra', min: 0, max: 3, options: [['Jalapeños', 1200], ['Queso extra', 1800], ['Salsa picante', 500]] }]
  },
  { n: 7, name: 'Hot dog clásico', description: 'Con papas y aderezos', category: 'alimentos', structure: 'simple', baseCents: 8900, requiresTicketCode: true, rules: [] },
  { n: 8, name: 'Gomitas', description: 'Bolsa de 150 g', category: 'dulces', structure: 'simple', baseCents: 4500, requiresTicketCode: true, rules: [] },
  { n: 9, name: 'Chocolate', description: 'Barra de 100 g', category: 'dulces', structure: 'simple', baseCents: 4500, requiresTicketCode: true, rules: [] },
  { n: 10, name: 'Vaso coleccionable', description: 'Edición limitada de 800 ml', category: 'promocionales', structure: 'simple', baseCents: 32900, requiresTicketCode: false, stock: 24, rules: [] },
  { n: 11, name: 'Palomera edición especial', description: 'Incluye palomitas medianas', category: 'promocionales', structure: 'simple', baseCents: 44900, requiresTicketCode: true, stock: 18, rules: [] },
  { n: 12, name: 'Set de pines', description: 'Colección de 4 piezas', category: 'promocionales', structure: 'simple', baseCents: 21900, requiresTicketCode: false, stock: 0, rules: [] }
]

export const productId = (complexId: string, n: number) => `p-${complexId}-${n}`
export const optionId = (product: string, ruleKey: string, index: number) => `${product}-${ruleKey}-${index}`

/* Contenido */

export const HIGHLIGHTS = [
  { id: 'h-martes', title: '2×1 todos los martes', text: 'En salas tradicionales 2D de todos los complejos.', ctaLabel: 'Ver promociones', ctaPath: '/promociones', tone: 'blue' },
  { id: 'h-dulceria', title: 'Pide tu dulcería en línea', text: 'Con el folio de tus boletos, recoge sin hacer fila.', ctaLabel: 'Ir a dulcería', ctaPath: '/dulceria', tone: 'violet' },
  { id: 'h-club', title: 'Club Cinépolis', text: 'Conoce los niveles y beneficios del programa.', ctaLabel: 'Conocer el Club', ctaPath: '/club', tone: 'cyan' }
]

export const PAGES: Record<string, { title: string; paragraphs: string[] }> = {
  'terminos': { title: 'Términos de uso', paragraphs: ['Borrador. El texto definitivo lo proporcionará el área jurídica.', 'Precios, promociones y folios de este ambiente son ficticios.'] },
  'privacidad': { title: 'Aviso de privacidad', paragraphs: ['Borrador. El aviso definitivo debe cumplir la Ley Federal de Protección de Datos Personales en Posesión de los Particulares vigente.'] },
  'facturacion': { title: 'Facturación', paragraphs: ['La facturación electrónica estará disponible cuando se integre el proveedor autorizado.'] },
  'contacto': { title: 'Contacto', paragraphs: ['Los medios de contacto se publicarán antes del lanzamiento.'] },
  'garantia': { title: 'Garantía de satisfacción', paragraphs: ['Las películas con garantía permiten registrar una reclamación. El formulario se habilitará al conectar el backend.'] }
}

export const FAQ = [
  { question: '¿Necesito boletos para pedir dulcería en línea?', answer: 'Sí. Los alimentos requieren el folio de una compra de boletos vigente del mismo complejo. Si compras todo junto, se vincula automáticamente.' },
  { question: '¿Puedo usar mi folio más de una vez?', answer: 'Sí. Admite varios pedidos hasta que termine tu función.' },
  { question: '¿Dónde encuentro mi folio?', answer: 'En la confirmación de compra y en Mis compras.' },
  { question: '¿Puedo cancelar mi compra?', answer: 'Sí, hasta 60 minutos antes de la función. El reembolso se procesa con el mismo método de pago.' },
  { question: '¿Cuánto tiempo tengo para pagar?', answer: 'Tus asientos quedan apartados 10 minutos. El tiempo no se reinicia al cambiar de asientos.' }
]
