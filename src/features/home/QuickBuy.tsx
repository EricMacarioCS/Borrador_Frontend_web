/** Compra rápida bajo la portada. Solo aparece al pulsar "Comprar boletos". */
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { X } from 'lucide-react'
import BaseSelect from '@/shared/ui/BaseSelect'
import { useScreeningDates, useScreenings } from '@/app/queries'
import { useAppStore } from '@/app/stores/app'
import { formatDate, formatTime } from '@/shared/lib/datetime'
import type { Movie } from '@/domain/models'
import styles from './QuickBuy.module.css'

export default function QuickBuy({ movie, onClose }: { movie: Movie; onClose: () => void }) {
  const selectedComplexes = useAppStore(state => state.selectedComplexes)
  const primaryId = useAppStore(state => state.primaryComplex?.id ?? null)
  const navigate = useNavigate()

  const [complexId, setComplexIdState] = useState<string | null>(primaryId)
  const complexIds = complexId ? [complexId] : []
  const dates = useScreeningDates(movie.id, complexIds)
  // La fecha elegida, o la primera con funciones mientras no se elija otra.
  const [chosenDate, setChosenDate] = useState<string | null>(null)
  const date = chosenDate && dates.data?.includes(chosenDate) ? chosenDate : dates.data?.[0] ?? null
  const screenings = useScreenings(complexIds, date ?? '', movie.id)
  const [screeningId, setScreeningId] = useState<string | null>(null)

  // Cambiar de cine o de fecha borra el horario elegido.
  function setComplexId(value: string) {
    setComplexIdState(value)
    setChosenDate(null)
    setScreeningId(null)
  }
  function setDate(value: string) {
    setChosenDate(value)
    setScreeningId(null)
  }

  const complexOptions = selectedComplexes.map(complex => ({ value: complex.id, label: complex.name, hint: complex.city }))
  const dateOptions = (dates.data ?? []).map(value => ({ value, label: formatDate(value) }))
  const timeOptions = (screenings.data ?? []).map(item => ({
    value: item.id,
    label: formatTime(item.startsAt),
    hint: `${item.room.type.name} · ${item.projection.name} · ${item.language.name}`,
    disabled: item.status !== 'on-sale'
  }))
  const notOnSale = movie.stage === 'coming-soon' || (!dates.isPending && !dates.data?.length)

  return (
    <section className={styles.quick} aria-label={`Compra rápida de ${movie.title}`}>
      <div className={`container ${styles.grid}`}>
        <div className={styles.title}>
          <span className="eyebrow">Compra rápida</span>
          <strong>{movie.title}</strong>
        </div>
        {!notOnSale
          ? (
            <>
              <BaseSelect value={complexId} onChange={setComplexId} label="Cine" options={complexOptions} />
              <BaseSelect value={date} onChange={setDate} label="Fecha" options={dateOptions} disabled={!dateOptions.length} />
              <BaseSelect value={screeningId} onChange={setScreeningId} label="Horario" options={timeOptions} disabled={!timeOptions.length}
                placeholder={screenings.isFetching ? 'Cargando…' : 'Elige un horario'} />
              <button type="button" className="btn btn-primary" disabled={!screeningId} onClick={() => void navigate(`/compra/${screeningId}`)}>Elegir asientos</button>
            </>
          )
          : <p className={`notice ${styles.soon}`}>Estreno el {formatDate(movie.releaseDate)}. La venta aún no inicia en este cine.</p>}
        <button type="button" className={styles.close} aria-label="Cerrar compra rápida" onClick={onClose}><X size={20} /></button>
      </div>
    </section>
  )
}
