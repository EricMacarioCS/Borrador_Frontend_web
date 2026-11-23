/**
 * Reglas de personalización en la interfaz: solo guían al cliente.
 * El servidor vuelve a validar mínimos, máximos y opciones, y calcula el precio.
 */
import type { ItemSelection, ModifierRule, Product } from '@/domain/models'
import type { Cents } from '@/shared/lib/money'

/** Folio que llega desde la confirmación de una compra; se usa al pagar alimentos. */
export const PENDING_TICKET_CODE_KEY = 'cp-pending-ticket-code'

export type Choices = Record<string, string[]>

/** Opciones predeterminadas: las marcadas por el catálogo o, si la regla es obligatoria y única, la primera disponible. */
export function defaultChoices(product: Product): Choices {
  return Object.fromEntries(product.rules.map(rule => {
    const defaults = rule.options.filter(option => option.isDefault && option.available).map(option => option.id).slice(0, rule.max)
    if (defaults.length >= rule.min) return [rule.id, defaults]
    const first = rule.options.find(option => option.available)
    return [rule.id, rule.min > 0 && first ? [first.id] : []]
  }))
}

export function ruleProblem(rule: ModifierRule, picked: string[]): string | null {
  if (picked.length < rule.min) return rule.min === 1 ? 'Elige una opción.' : `Elige al menos ${rule.min}.`
  if (picked.length > rule.max) return `Elige como máximo ${rule.max}.`
  return null
}

export function isComplete(product: Product, choices: Choices): boolean {
  return product.available && product.rules.every(rule => !ruleProblem(rule, choices[rule.id] ?? []))
}

/** Estimación para mostrar. Al repartir sabores no hay cargo extra, igual que en el servidor. */
export function estimateCents(product: Product, choices: Choices): Cents {
  return product.basePriceCents + product.rules.reduce((sum, rule) => {
    const picked = rule.options.filter(option => (choices[rule.id] ?? []).includes(option.id))
    if (rule.allowSplit && picked.length > 1) return sum
    return sum + picked.reduce((total, option) => total + option.extraCents, 0)
  }, 0)
}

export function describe(product: Product, choices: Choices): string {
  return product.rules.map(rule => {
    const names = rule.options.filter(option => (choices[rule.id] ?? []).includes(option.id)).map(option => option.name)
    if (!names.length) return ''
    return rule.allowSplit && names.length > 1 ? `${names.join(' y ')} (mitad y mitad)` : names.join(', ')
  }).filter(Boolean).join(' · ')
}

export function toSelection(product: Product, choices: Choices, quantity: number): ItemSelection {
  return {
    productId: product.id,
    quantity,
    choices: product.rules.map(rule => ({ ruleId: rule.id, optionIds: choices[rule.id] ?? [] }))
  }
}
