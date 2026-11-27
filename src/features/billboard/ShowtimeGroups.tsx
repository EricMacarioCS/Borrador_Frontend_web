/** Horarios agrupados por complejo y por tipo de sala, proyección e idioma, con su ocupación. */
import { useMemo } from 'react'
import type { Screening } from '@/domain/models'
import { useAppStore } from '@/app/stores/app'
import { formatTime } from '@/shared/lib/datetime'
import { formatMoney } from '@/shared/lib/money'
import { cx } from '@/shared/lib/cx'
import { OCCUPANCY_LEGEND, availabilityText, freeSeatsText, occupancyPercent, occupancyTone } from '@/domain/occupancy'
import styles from './ShowtimeGroups.module.css'

interface Props {
  screenings: Screening[]
  selectedId?: string | null
  showLegend?: boolean
  onPick: (screening: Screening) => void
}

const left = (screening: Screening) => Math.max(0, screening.occupancy.capacity - screening.occupancy.unavailable)
const closed = (screening: Screening) => screening.status === 'closed' || screening.status === 'cancelled'

/** Disponibilidad de una función: texto visible, explicación, color y avance de la barra. */
function availability(screening: Screening) {
  const { unavailable, capacity } = screening.occupancy
  if (screening.status === 'sold-out') return { text: 'Agotado', detail: 'No quedan lugares libres.', tone: 'full', fill: 100 }
  if (closed(screening)) return { text: 'No disponible', detail: 'La venta en línea de esta función está cerrada.', tone: 'closed', fill: 0 }
  const percent = occupancyPercent(unavailable, capacity)
  return {
    text: availabilityText(unavailable, capacity),
    detail: `${freeSeatsText(left(screening))} de ${capacity}. La barra de color muestra qué tan llena está la sala.`,
    tone: occupancyTone(percent),
    fill: percent
  }
}

export default function ShowtimeGroups({ screenings, selectedId = null, showLegend = true, onPick }: Props) {
  const complexById = useAppStore(state => state.complexById)
  const groups = useMemo(() => {
    const byComplex = new Map<string, Map<string, Screening[]>>()
    for (const screening of screenings) {
      const complex = byComplex.get(screening.complexId) ?? new Map<string, Screening[]>()
      const key = `${screening.room.type.name} · ${screening.projection.name} · ${screening.language.name}`
      complex.set(key, [...(complex.get(key) ?? []), screening])
      byComplex.set(screening.complexId, complex)
    }
    return [...byComplex].map(([complexId, formats]) => ({
      id: complexId,
      complex: complexById(complexId),
      formats: [...formats].map(([label, items]) => ({ label, items: [...items].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime()) }))
    }))
  }, [screenings, complexById])
  const multipleComplexes = groups.length > 1

  return (
    <div>
      {groups.map(group => (
        <section key={group.id} className={styles.complex}>
          {multipleComplexes && <h3 className={styles.complexName}>{group.complex?.name}</h3>}
          {group.formats.map(format => (
            <div key={format.label} className={styles.format}>
              <p className={styles.formatLabel}>{format.label}</p>
              <ul className={styles.times} role="list">
                {format.items.map(screening => {
                  const info = availability(screening)
                  const time = formatTime(screening.startsAt, group.complex?.timeZone)
                  return (
                    <li key={screening.id}>
                      <button type="button" className={cx(styles.time, styles[`tone-${info.tone}`], selectedId === screening.id && styles.active)}
                        disabled={screening.status !== 'on-sale'} title={info.detail}
                        aria-pressed={selectedId ? selectedId === screening.id : undefined}
                        aria-label={`${time}, ${format.label}, ${info.text}. ${info.detail} Desde ${formatMoney(screening.fromPriceCents)}`}
                        onClick={() => onPick(screening)}>
                        <strong>{time}</strong>
                        <small>{info.text}</small>
                        <span className={styles.meter} aria-hidden="true"><span style={{ width: `${info.fill}%` }} /></span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </section>
      ))}
      {showLegend && (
        <div className={styles.legend} role="group" aria-label="Significado de los colores de disponibilidad">
          <span>Disponibilidad:</span>
          {OCCUPANCY_LEGEND.map(item => <i key={item.tone} className={styles[`tone-${item.tone}`]}>{item.label}</i>)}
        </div>
      )}
    </div>
  )
}
