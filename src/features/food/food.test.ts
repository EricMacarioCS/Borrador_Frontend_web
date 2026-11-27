import { beforeEach, describe, expect, it } from 'vitest'
import type { Product } from '@/domain/models'
import { createCartStore, type CartLine, type CartState } from '@/app/stores/cart'
import { defaultChoices, describe as describeChoices, estimateCents, isComplete, ruleProblem, toSelection } from './selection'

const option = (id: string, extraCents = 0, isDefault = false, available = true) => ({ id, name: id, extraCents, isDefault, available })

const popcorn: Product = {
  id: 'p-palomitas', name: 'Palomitas', description: '', category: { code: 'palomitas', name: 'Palomitas' },
  structure: 'compound', basePriceCents: 5900, available: true, requiresTicketCode: true,
  rules: [
    { id: 'tamano', title: 'Tamaño', kind: 'size', min: 1, max: 1, allowSplit: false,
      options: [option('chicas'), option('medianas', 1500, true), option('grandes', 3000)] },
    { id: 'sabor', title: 'Sabor', kind: 'flavor', min: 1, max: 2, allowSplit: true,
      options: [option('mantequilla', 0, true), option('caramelo', 1000), option('queso', 1000, false, false)] },
    { id: 'extras', title: 'Extras', kind: 'extra', min: 0, max: 2, allowSplit: false,
      options: [option('mantequilla-extra', 1000), option('chile', 800)] }
  ]
}

describe('personalización de productos', () => {
  it('parte de las opciones predeterminadas disponibles', () => {
    expect(defaultChoices(popcorn)).toEqual({ tamano: ['medianas'], sabor: ['mantequilla'], extras: [] })
  })

  it('explica qué falta o qué sobra', () => {
    expect(ruleProblem(popcorn.rules[0]!, [])).toBe('Elige una opción.')
    expect(ruleProblem(popcorn.rules[1]!, ['mantequilla', 'caramelo', 'queso'])).toBe('Elige como máximo 2.')
    expect(isComplete(popcorn, { tamano: [], sabor: ['mantequilla'] })).toBe(false)
    expect(isComplete(popcorn, defaultChoices(popcorn))).toBe(true)
  })

  it('al repartir sabores no cobra el extra del sabor (igual que el servidor)', () => {
    expect(estimateCents(popcorn, { tamano: ['medianas'], sabor: ['caramelo'], extras: [] })).toBe(5900 + 1500 + 1000)
    expect(estimateCents(popcorn, { tamano: ['medianas'], sabor: ['mantequilla', 'caramelo'], extras: ['chile'] })).toBe(5900 + 1500 + 800)
  })

  it('describe la selección y la convierte a identificadores', () => {
    const choices = { tamano: ['grandes'], sabor: ['mantequilla', 'caramelo'], extras: [] }
    expect(describeChoices(popcorn, choices)).toBe('grandes · mantequilla y caramelo (mitad y mitad)')
    expect(toSelection(popcorn, choices, 2)).toEqual({
      productId: 'p-palomitas', quantity: 2,
      choices: [{ ruleId: 'tamano', optionIds: ['grandes'] }, { ruleId: 'sabor', optionIds: ['mantequilla', 'caramelo'] }, { ruleId: 'extras', optionIds: [] }]
    })
  })
})

describe('carrito de dulcería', () => {
  const line = (productId: string): Omit<CartLine, 'key'> => ({
    productId, quantity: 1, choices: [], name: productId, detail: '', estimateCents: 4500, requiresTicketCode: false
  })

  /** Carrito nuevo; cada lectura toma el estado actual. */
  function cartStore() {
    const store = createCartStore()
    return new Proxy({} as CartState, { get: (_, key) => store.getState()[key as keyof CartState] })
  }

  beforeEach(() => {
    sessionStorage.clear()
  })

  it('junta líneas iguales y limita la cantidad', () => {
    const cart = cartStore()
    for (let i = 0; i < 12; i++) cart.add('c-1', line('refresco'))
    expect(cart.lines).toHaveLength(1)
    expect(cart.count).toBe(10)
  })

  it('pertenece a un solo complejo: cambiarlo vacía el carrito y el folio validado', () => {
    const cart = cartStore()
    cart.add('c-1', line('refresco'))
    cart.setGrant({ grant: 'g', ticketCode: 'CIN-AAAA-BBBB-CCCC', complexId: 'c-1', movieTitle: 'X', startsAt: new Date(), endsAt: new Date() })
    expect(cart.canAdd('c-2')).toBe(false)
    cart.add('c-2', line('agua'))
    expect(cart.lines.map(item => item.productId)).toEqual(['agua'])
    expect(cart.grant).toBeNull()
  })

  it('la cantidad cero quita la línea', () => {
    const cart = cartStore()
    cart.add('c-1', line('agua'))
    cart.setQuantity(cart.lines[0]!.key, 0)
    expect(cart.lines).toEqual([])
  })
})
