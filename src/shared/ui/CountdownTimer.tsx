/** Contador basado en el reloj del servidor. Avisa a los lectores de pantalla solo en momentos clave. */
import { useEffect, useRef, useState } from 'react'
import { Clock } from 'lucide-react'
import { serverNow } from '@/shared/lib/clock'
import { cx } from '@/shared/lib/cx'
import styles from './CountdownTimer.module.css'

export default function CountdownTimer({ until, onExpired }: { until: Date; onExpired?: () => void }) {
  const [now, setNow] = useState(serverNow)
  const expired = useRef(onExpired)
  useEffect(() => { expired.current = onExpired })

  useEffect(() => {
    const timer = window.setInterval(() => setNow(serverNow()), 1000)
    return () => clearInterval(timer)
  }, [])

  const seconds = Math.max(0, Math.ceil((until.getTime() - now) / 1000))
  useEffect(() => {
    if (seconds === 0) expired.current?.()
  }, [seconds])

  const text = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
  const announcement = seconds === 60 ? 'Queda un minuto para completar tu compra.' : seconds === 0 ? 'Venció el tiempo de tu apartado.' : ''

  return (
    <div className={cx(styles.countdown, seconds < 60 && styles.urgent)}>
      <Clock size={18} aria-hidden="true" />
      <span><span className="visually-hidden">Tiempo restante: </span><time>{text}</time></span>
      <span className="visually-hidden" aria-live="assertive">{announcement}</span>
    </div>
  )
}
