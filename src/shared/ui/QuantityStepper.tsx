import { Minus, Plus } from 'lucide-react'
import styles from './QuantityStepper.module.css'

interface Props {
  label: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
}

export default function QuantityStepper({ label, value, onChange, min = 0, max = 10 }: Props) {
  const change = (step: number) => onChange(Math.min(max, Math.max(min, value + step)))
  return (
    <div className={styles.stepper} role="group" aria-label={label}>
      <button type="button" disabled={value <= min} aria-label={`Quitar uno: ${label}`} onClick={() => change(-1)}><Minus size={16} /></button>
      <output aria-live="polite">{value}</output>
      <button type="button" disabled={value >= max} aria-label={`Agregar uno: ${label}`} onClick={() => change(1)}><Plus size={16} /></button>
    </div>
  )
}
