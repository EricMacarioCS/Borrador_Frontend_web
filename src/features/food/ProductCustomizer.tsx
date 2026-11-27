/** Personalización de un producto con las reglas del catálogo (mínimo, máximo y opciones). */
import { useState } from 'react'
import BaseDialog from '@/shared/ui/BaseDialog'
import QuantityStepper from '@/shared/ui/QuantityStepper'
import { formatMoney } from '@/shared/lib/money'
import type { ModifierOption, ModifierRule, Product } from '@/domain/models'
import { defaultChoices, describe, estimateCents, isComplete, ruleProblem, toSelection, type Choices } from './selection'
import type { CartLine } from '@/app/stores/cart'
import { cx } from '@/shared/lib/cx'
import styles from './ProductCustomizer.module.css'

interface Props {
  product: Product | null
  onClose: () => void
  onAdd: (line: Omit<CartLine, 'key'>) => void
}

export default function ProductCustomizer({ product, onClose, onAdd }: Props) {
  const [choices, setChoices] = useState<Choices>(() => product ? defaultChoices(product) : {})
  const [quantity, setQuantity] = useState(1)
  const [touched, setTouched] = useState(false)

  // Al abrir otro producto se reinicia la personalización.
  const [shown, setShown] = useState(product)
  if (shown !== product) {
    setShown(product)
    if (product) {
      setChoices(defaultChoices(product))
      setQuantity(1)
      setTouched(false)
    }
  }

  const unit = product ? estimateCents(product, choices) : 0
  const ready = product ? isComplete(product, choices) : false
  const isCombo = product?.category.code === 'combos' || product?.structure === 'combo'
  const noun = isCombo ? 'combo' : 'producto'
  const quantityLabel = `Cantidad de ${noun}s`
  const addLabel = `Agregar ${quantity} ${noun}${quantity === 1 ? '' : 's'} · ${formatMoney(unit * quantity)}`

  const picked = (ruleId: string) => choices[ruleId] ?? []
  /** Con varias opciones permitidas, al llegar al máximo las demás se bloquean. */
  const full = (rule: ModifierRule) => rule.max > 1 && picked(rule.id).length >= rule.max
  const blocked = (rule: ModifierRule, option: ModifierOption) => !option.available || (full(rule) && !picked(rule.id).includes(option.id))

  function toggle(ruleId: string, optionId: string, max: number) {
    const current = choices[ruleId] ?? []
    if (max === 1) setChoices({ ...choices, [ruleId]: [optionId] })
    else if (current.includes(optionId)) setChoices({ ...choices, [ruleId]: current.filter(id => id !== optionId) })
    else if (current.length < max) setChoices({ ...choices, [ruleId]: [...current, optionId] })
  }

  function add() {
    setTouched(true)
    if (!product || !ready) return
    onAdd({
      ...toSelection(product, choices, quantity),
      name: product.name,
      detail: describe(product, choices),
      estimateCents: unit,
      requiresTicketCode: product.requiresTicketCode
    })
  }

  return (
    <BaseDialog open={!!product} label={product ? `Personalizar ${product.name}` : 'Personalizar'} onClose={onClose}
      header={<h2>{product?.name}</h2>}
      footer={
        <div className={styles.footer}>
          <p className={styles.same}>
            {quantity > 1 ? `Los ${quantity} ${noun}s llevarán la misma personalización.` : `Si pides varios ${noun}s, todos llevarán la misma personalización.`}
            {' '}Si quieres sabores u opciones distintas, agrega otro {noun} por separado.
          </p>
          <div className={styles.quantity}>
            <span aria-hidden="true">{quantityLabel}</span>
            <QuantityStepper value={quantity} onChange={setQuantity} label={quantityLabel} min={1} max={10} />
          </div>
          <button type="button" className={`btn btn-primary ${styles.add}`} disabled={!product?.available} onClick={add}>{addLabel}</button>
        </div>
      }>
      {product && (
        <>
          <div className={styles.banner} aria-hidden="true"><span>{product.category.name}</span></div>
          <p className={styles.description}>{product.description}</p>
          {product.rules.map(rule => {
            const problem = touched ? ruleProblem(rule, choices[rule.id] ?? []) : ''
            return (
              <fieldset key={rule.id} className={styles.rule}>
                <legend>
                  {rule.title}
                  <small>{rule.min > 0 ? 'Obligatorio' : 'Opcional'}{rule.max > 1 ? ` · hasta ${rule.max}` : ''}</small>
                </legend>
                {rule.allowSplit && <p className={styles.hint}>Si eliges dos, te servimos mitad y mitad.</p>}
                <div className={styles.options}>
                  {rule.options.map(option => {
                    const checked = picked(rule.id).includes(option.id)
                    const off = blocked(rule, option)
                    return (
                      <label key={option.id} className={cx(styles.option, checked && styles.checked, off && styles.off)}>
                        <input type={rule.max === 1 ? 'radio' : 'checkbox'} name={rule.id} checked={checked}
                          disabled={off} aria-disabled={off} onChange={() => toggle(rule.id, option.id, rule.max)} />
                        <span>{option.name}</span>
                        {option.extraCents > 0 && <small>+{formatMoney(option.extraCents)}</small>}
                        {!option.available && <small>Agotado</small>}
                      </label>
                    )
                  })}
                </div>
                {rule.max > 1 && <p className={styles.limit} aria-live="polite">{full(rule) ? `Ya elegiste ${rule.max} de ${rule.max}. Quita una opción para elegir otra.` : ''}</p>}
                {problem && <p className="field-error" role="alert">{problem}</p>}
              </fieldset>
            )
          })}
        </>
      )}
    </BaseDialog>
  )
}
