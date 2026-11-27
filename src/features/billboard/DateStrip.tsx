import { useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { dayParts, formatDate } from '@/shared/lib/datetime'
import styles from './DateStrip.module.css'

interface Props {
  days: string[]
  today: string
  value: string
  onChange: (day: string) => void
  available?: string[] | null
}

export default function DateStrip({ days, today, value, onChange, available }: Props) {
  const strip = useRef<HTMLDivElement>(null)

  // El día elegido queda centrado al abrir y al cambiarlo.
  useEffect(() => {
    strip.current?.querySelector<HTMLElement>('[aria-pressed="true"]')?.scrollIntoView({ inline: 'center', block: 'nearest' })
  }, [value])

  function scroll(direction: number) {
    strip.current?.scrollBy({ left: direction * strip.current.clientWidth * 0.8, behavior: 'smooth' })
  }

  return (
    <div className={styles.dates}>
      <button type="button" className={styles.arrow} aria-label="Días anteriores" onClick={() => scroll(-1)}><ChevronLeft size={20} /></button>
      <div ref={strip} className={styles.strip} role="group" aria-label="Fecha de la función">
        {days.map(day => {
          const parts = dayParts(day)
          return (
            <button key={day} type="button" aria-pressed={value === day} title={formatDate(day)}
              disabled={available ? !available.includes(day) : false} onClick={() => onChange(day)}>
              <span aria-hidden="true">{day === today ? 'HOY' : parts.weekday}</span>
              <strong>{parts.day}</strong>
              <small>{parts.month}</small>
              <span className="visually-hidden">{formatDate(day)}</span>
            </button>
          )
        })}
      </div>
      <button type="button" className={styles.arrow} aria-label="Días siguientes" onClick={() => scroll(1)}><ChevronRight size={20} /></button>
    </div>
  )
}
