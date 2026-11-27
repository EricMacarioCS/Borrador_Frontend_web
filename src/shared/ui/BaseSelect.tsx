/**
 * Lista desplegable accesible con el estilo de la web v3 (patrón combobox de WAI-ARIA).
 * La lista se dibuja en el body para no recortarse dentro de contenedores con scroll.
 */
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown } from 'lucide-react'
import { cx } from '@/shared/lib/cx'
import styles from './BaseSelect.module.css'

export interface SelectOption<V> { value: V; label: string; hint?: string; disabled?: boolean }

interface Props<T> {
  label: string
  options: SelectOption<T>[]
  value: T | null
  onChange: (value: T) => void
  placeholder?: string
  disabled?: boolean
  hideLabel?: boolean
  compact?: boolean
  icon?: ReactNode
}

export default function BaseSelect<T extends string | number>({
  label, options, value, onChange, placeholder = 'Selecciona', disabled = false, hideLabel = false, compact = false, icon
}: Props<T>) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(0)
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0, maxHeight: 320 })
  const trigger = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const typed = useRef({ text: '', timer: 0 })
  const selected = options.find(option => option.value === value)

  const place = useCallback(() => {
    const rect = trigger.current?.getBoundingClientRect()
    if (!rect) return
    const below = window.innerHeight - rect.bottom - 12
    const above = rect.top - 12
    const up = below < 220 && above > below
    const maxHeight = Math.min(340, up ? above : below)
    setPosition({ top: up ? rect.top - maxHeight - 6 : rect.bottom + 6, left: rect.left, width: rect.width, maxHeight })
  }, [])

  function show() {
    if (disabled || !options.length) return
    place()
    const index = options.findIndex(option => option.value === value)
    setHighlighted(index >= 0 ? index : options.findIndex(option => !option.disabled))
    setOpen(true)
  }

  const hide = useCallback((returnFocus = true) => {
    setOpen(false)
    if (returnFocus) trigger.current?.focus()
  }, [])

  function choose(index: number) {
    const option = options[index]
    if (!option || option.disabled) return
    onChange(option.value)
    hide()
  }

  function move(from: number, step: number) {
    const count = options.length
    for (let i = 1; i <= count; i++) {
      const next = (from + step * i + count) % count
      if (!options[next]?.disabled) {
        setHighlighted(next)
        return
      }
    }
  }

  // Al abrir, el foco pasa a la lista; la opción resaltada siempre queda a la vista.
  useLayoutEffect(() => {
    if (open) list.current?.focus()
  }, [open])
  useEffect(() => {
    if (open) list.current?.querySelector(`.${styles.highlighted}`)?.scrollIntoView({ block: 'nearest' })
  }, [open, highlighted])

  useEffect(() => {
    if (!open) return
    function onOutside(event: PointerEvent) {
      const target = event.target as Node
      if (!list.current?.contains(target) && !trigger.current?.contains(target)) hide(false)
    }
    document.addEventListener('pointerdown', onOutside, true)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      document.removeEventListener('pointerdown', onOutside, true)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, hide, place])

  function onListKey(event: KeyboardEvent) {
    if (event.key === 'ArrowDown') { event.preventDefault(); move(highlighted, 1) }
    else if (event.key === 'ArrowUp') { event.preventDefault(); move(highlighted, -1) }
    else if (event.key === 'Home') { event.preventDefault(); move(-1, 1) }
    else if (event.key === 'End') { event.preventDefault(); move(options.length, -1) }
    else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); choose(highlighted) }
    else if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); hide() }
    else if (event.key === 'Tab') hide(false)
    else if (event.key.length === 1) {
      // Búsqueda por las primeras letras.
      typed.current.text += event.key.toLowerCase()
      clearTimeout(typed.current.timer)
      typed.current.timer = window.setTimeout(() => { typed.current.text = '' }, 600)
      const match = options.findIndex(option => !option.disabled && option.label.toLowerCase().startsWith(typed.current.text))
      if (match >= 0) setHighlighted(match)
    }
  }

  function onTriggerKey(event: KeyboardEvent) {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
      event.preventDefault()
      show()
    }
  }

  return (
    <div className={cx(styles.select, compact && styles.compact)}>
      <span id={`${id}-label`} className={cx('field-label', hideLabel && 'visually-hidden')}>{label}</span>
      <button ref={trigger} type="button" className={cx(styles.trigger, open && styles.open)} role="combobox" disabled={disabled}
        aria-expanded={open} aria-controls={`${id}-list`} aria-labelledby={`${id}-label ${id}-value`} aria-haspopup="listbox"
        onClick={() => open ? hide() : show()} onKeyDown={onTriggerKey}>
        {icon}
        <span id={`${id}-value`} className={cx(!selected && styles.placeholder)}>{selected?.label ?? placeholder}</span>
        <ChevronDown size={18} className={styles.chevron} aria-hidden="true" />
      </button>
      {open && createPortal(
        <ul id={`${id}-list`} ref={list} className={styles.list} role="listbox" tabIndex={-1}
          aria-labelledby={`${id}-label`} aria-activedescendant={`${id}-opt-${highlighted}`}
          style={{ top: position.top, left: position.left, minWidth: position.width, maxHeight: position.maxHeight }}
          onKeyDown={onListKey}>
          {options.map((option, index) => (
            <li key={String(option.value)} id={`${id}-opt-${index}`} role="option"
              aria-selected={option.value === value} aria-disabled={option.disabled || undefined}
              className={cx(index === highlighted && styles.highlighted, option.value === value && styles.selected, option.disabled && styles.disabled)}
              onPointerMove={() => { if (!option.disabled) setHighlighted(index) }} onClick={() => choose(index)}>
              <span>{option.label}{option.hint && <small>{option.hint}</small>}</span>
              {option.value === value && <Check size={18} aria-hidden="true" />}
            </li>
          ))}
        </ul>,
        document.body
      )}
    </div>
  )
}
