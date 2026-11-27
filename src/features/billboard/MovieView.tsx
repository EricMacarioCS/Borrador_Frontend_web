import { useEffect, type CSSProperties } from 'react'
import { useNavigate, useParams } from 'react-router'
import { ArrowLeft, Clock, Film, MapPin } from 'lucide-react'
import DateStrip from './DateStrip'
import ShowtimeGroups from './ShowtimeGroups'
import { useQueryParam } from './filters'
import { useScheduleDays } from './dates'
import PosterArt from '@/shared/ui/PosterArt'
import StateView from '@/shared/ui/StateView'
import { useMovie, useScreeningDates, useScreenings } from '@/app/queries'
import { appStore, useAppStore } from '@/app/stores/app'
import { STAGE_LABELS, durationLabel } from '@/domain/labels'
import { formatDate } from '@/shared/lib/datetime'
import type { Screening } from '@/domain/models'
import styles from './MovieView.module.css'

export default function MovieView() {
  const { slug = '' } = useParams()
  const selectedComplexes = useAppStore(state => state.selectedComplexes)
  const selectedComplexIds = useAppStore(state => state.selectedComplexIds)
  const askForComplexes = useAppStore(state => state.askForComplexes)
  const navigate = useNavigate()
  const { today, days } = useScheduleDays()
  const movie = useMovie(slug)
  const movieId = movie.data?.id
  const dates = useScreeningDates(movieId, selectedComplexIds)
  const [date, setDate] = useQueryParam('fecha', today)
  const screenings = useScreenings(selectedComplexIds, date, movieId)
  const hasComplexes = selectedComplexIds.length > 0

  // Si el día elegido no tiene funciones, se salta al primero disponible.
  useEffect(() => {
    const available = dates.data
    if (available?.length && !available.includes(date)) setDate(available[0]!)
  }, [dates.data, date, setDate])

  const title = movie.data?.title
  useEffect(() => {
    if (title) document.title = `${title} · Cinépolis`
  }, [title])

  // Al entrar por un enlace directo sin cine elegido, se pide el cine para mostrar horarios.
  useEffect(() => {
    if (!appStore.getState().selectedComplexIds.length) appStore.getState().askForComplexes()
  }, [])

  const pick = (screening: Screening) => { void navigate(`/compra/${screening.id}`) }

  if (!movie.data) {
    return (
      <div className={styles.moviePage}>
        <div className="container page">
          <StateView loading={movie.isPending} error={movie.error} skeleton="block" onRetry={() => void movie.refetch()} />
        </div>
      </div>
    )
  }

  const data = movie.data
  const directors = data.cast.filter(person => person.role === 'director').map(person => person.name)
  const actors = data.cast.filter(person => person.role !== 'director').map(person => person.name)

  return (
    <div className={styles.moviePage}>
      <section className={styles.hero} style={{ '--accent-movie': data.accent } as CSSProperties}>
        <div className={`container ${styles.heroInner}`}>
          <button type="button" className={styles.back} onClick={() => void navigate(-1)}><ArrowLeft size={18} /> Volver</button>
          <div className={styles.heroGrid}>
            <PosterArt title={data.title} accent={data.accent} rating={data.rating.code} src={data.posterUrl} />
            <div className={styles.copy}>
              <span className="badge">{data.isSpecialEvent ? 'Evento especial' : STAGE_LABELS[data.stage]}</span>
              <h1>{data.title}</h1>
              <p className={styles.meta}>
                <span className="badge badge-rating">{data.rating.code}</span>
                <span>{data.genres.join(', ')}</span>
                <span><Clock size={15} aria-hidden="true" /> {durationLabel(data.durationMinutes)}</span>
                <span>Estreno: {formatDate(data.releaseDate, 'short')}</span>
              </p>
              <p className={styles.synopsis}>{data.synopsis}</p>
              {!data.trailerUrl && <p className={styles.trailerNote}><Film size={16} aria-hidden="true" /> Tráiler disponible próximamente.</p>}
              <a href="#horarios" className="btn btn-primary">Ver horarios</a>
            </div>
            <dl className={styles.facts}>
              <div><dt>Clasificación</dt><dd>{data.rating.code} · {data.rating.description}</dd></div>
              <div><dt>Duración</dt><dd>{durationLabel(data.durationMinutes)}</dd></div>
              <div><dt>Estreno</dt><dd>{formatDate(data.releaseDate)}</dd></div>
              <div><dt>Género</dt><dd>{data.genres.join(', ')}</dd></div>
              {directors.length > 0 && <div><dt>Dirección</dt><dd>{directors.join(', ')}</dd></div>}
              {actors.length > 0 && <div><dt>Reparto</dt><dd>{actors.join(', ')}</dd></div>}
            </dl>
          </div>
        </div>
      </section>

      <section className={`container ${styles.schedule}`} aria-labelledby="horarios">
        <div className={styles.scheduleHead}>
          <h2 id="horarios">Horarios</h2>
          {hasComplexes && (
            <p className={styles.where}><MapPin size={15} aria-hidden="true" /> {selectedComplexes.map(complex => complex.name).join(' · ')}
              <button type="button" className={styles.link} onClick={() => askForComplexes()}>Cambiar</button>
            </p>
          )}
        </div>
        {!hasComplexes
          ? (
            <div className={`card ${styles.choose}`}>
              <MapPin size={30} aria-hidden="true" />
              <h3>Elige un cine para ver los horarios</h3>
              <p className="muted">Puedes elegir varios cines de una misma ciudad para comparar.</p>
              <button type="button" className="btn btn-primary" onClick={() => askForComplexes()}>Elegir cines</button>
            </div>
          )
          : (
            <StateView loading={dates.isPending} error={dates.error} empty={!dates.data?.length} skeleton="rows" onRetry={() => void dates.refetch()}
              emptyTitle={data.stage === 'coming-soon' ? 'Aún no hay venta de boletos' : 'Sin funciones en tus cines'}
              emptyText={data.stage === 'coming-soon' ? `Estreno el ${formatDate(data.releaseDate)}.` : 'Elige otros cines en la barra superior o con el botón Cambiar.'}>
              <div className={`card ${styles.scheduleCard}`}>
                <DateStrip value={date} onChange={setDate} days={days} today={today} available={dates.data ?? []} />
                <StateView loading={screenings.isPending} error={screenings.error} empty={!screenings.data?.length} skeleton="rows"
                  emptyTitle="No quedan funciones este día" onRetry={() => void screenings.refetch()}>
                  <ShowtimeGroups screenings={screenings.data ?? []} onPick={pick} />
                </StateView>
              </div>
            </StateView>
          )}
      </section>
    </div>
  )
}
