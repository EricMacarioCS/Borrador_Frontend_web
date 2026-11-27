import { useMemo } from 'react'
import { Link } from 'react-router'
import { ArrowRight, MapPin, Sparkles } from 'lucide-react'
import HeroCarousel from './HeroCarousel'
import DateStrip from '@/features/billboard/DateStrip'
import { useScheduleDays } from '@/features/billboard/dates'
import { useQueryParam } from '@/features/billboard/filters'
import PosterArt from '@/shared/ui/PosterArt'
import StateView from '@/shared/ui/StateView'
import { useHome, useMovies, useScreenings } from '@/app/queries'
import { useAppStore } from '@/app/stores/app'
import { STAGE_LABELS } from '@/domain/labels'
import { formatDate } from '@/shared/lib/datetime'
import { cx } from '@/shared/lib/cx'
import styles from './HomeView.module.css'

const EXPERIENCES = [
  { name: 'IMAX', text: 'Pantalla gigante y sonido de alta precisión.' },
  { name: 'Macro XE', text: 'Pantalla de pared a pared con audio envolvente.' },
  { name: '4DX', text: 'Movimiento, viento y efectos sincronizados con la película.' },
  { name: 'VIP', text: 'Butacas reclinables y servicio a tu lugar.' },
  { name: 'Junior', text: 'Salas pensadas para los más pequeños.' }
]

export default function HomeView() {
  const selectedComplexes = useAppStore(state => state.selectedComplexes)
  const selectedComplexIds = useAppStore(state => state.selectedComplexIds)
  const browseComplexIds = useAppStore(state => state.browseComplexIds)
  const askForComplexes = useAppStore(state => state.askForComplexes)
  const home = useHome()
  const movies = useMovies(selectedComplexIds)
  const { today, days } = useScheduleDays()
  const [date, setDate] = useQueryParam('fecha', today)
  // Sin cines elegidos se muestra lo que hay en todos los complejos.
  const screenings = useScreenings(browseComplexIds, date)

  const featured = useMemo(() => {
    const ids = home.data?.featuredMovieIds ?? []
    return ids.map(id => movies.data?.find(movie => movie.id === id)).filter(movie => movie !== undefined)
  }, [home.data, movies.data])

  /** Funciones del día por película: cuántas hay y en qué formatos especiales. */
  const daily = useMemo(() => {
    const byMovie = new Map<string, { count: number; formats: Set<string> }>()
    for (const screening of screenings.data ?? []) {
      if (screening.status === 'closed' || screening.status === 'cancelled') continue
      const entry = byMovie.get(screening.movieId) ?? { count: 0, formats: new Set<string>() }
      entry.count++
      if (screening.room.type.code !== 'traditional') entry.formats.add(screening.room.type.name)
      if (screening.projection.code !== '2d') entry.formats.add(screening.projection.name)
      byMovie.set(screening.movieId, entry)
    }
    return byMovie
  }, [screenings.data])
  const showing = (movies.data ?? []).filter(movie => daily.has(movie.id)).map(movie => ({ movie, ...daily.get(movie.id)! }))
  // Preventas y eventos sin funciones ese día siguen visibles aquí.
  const upcoming = (movies.data ?? []).filter(movie =>
    movie.stage === 'coming-soon' || ((movie.isSpecialEvent || movie.stage === 'presale') && !daily.has(movie.id)))

  const names = selectedComplexes.map(complex => complex.name)
  const where = !names.length ? null : names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} y ${names.at(-1)}`
  const dateQuery = date === today ? '' : `?fecha=${date}`
  const highlights = home.data?.highlights ?? []

  return (
    <div>
      <StateView loading={home.isPending || movies.isPending} error={home.error ?? movies.error} skeleton="block" className={styles.heroState}
        onRetry={() => { void home.refetch(); void movies.refetch() }}>
        {featured.length > 0 && <HeroCarousel movies={featured} />}
      </StateView>

      <div className="container">
        <section className="section" aria-labelledby="cartelera">
          <div className="section-head">
            <div className={styles.heading}>
              <h2 id="cartelera">En cartelera</h2>
              {where
                ? <p className={styles.where}><MapPin size={15} aria-hidden="true" /> {where}</p>
                : <p className={styles.where}>En todos nuestros cines. <button type="button" className={styles.link} onClick={() => askForComplexes()}>Elige tu cine</button> para ver solo lo que tienes cerca.</p>}
            </div>
            <Link to={`/cartelera${dateQuery}`} className="btn btn-small btn-secondary">Ver todos los horarios <ArrowRight size={16} /></Link>
          </div>
          <div className={`card ${styles.dateCard}`}>
            <DateStrip value={date} onChange={setDate} days={days} today={today} />
          </div>
          <StateView loading={screenings.isPending || movies.isPending} error={screenings.error} empty={!showing.length} skeleton="cards"
            emptyTitle={`No hay funciones el ${formatDate(date)}`} emptyText={where ? 'Prueba con otra fecha u otros cines.' : 'Prueba con otra fecha.'}
            onRetry={() => void screenings.refetch()}>
            <ul className={cx(styles.posterGrid, screenings.isPlaceholderData && styles.refreshing)} role="list">
              {showing.map(item => (
                <li key={item.movie.id}>
                  <Link to={`/peliculas/${item.movie.slug}${dateQuery}`} className={styles.posterCard}>
                    <PosterArt title={item.movie.title} accent={item.movie.accent} rating={item.movie.rating.code} src={item.movie.posterUrl} decorative />
                    <span className={styles.posterTitle}>{item.movie.title}</span>
                    <span className={styles.posterMeta}>{item.movie.isSpecialEvent ? 'Evento especial' : STAGE_LABELS[item.movie.stage]} · {item.movie.genres[0]}</span>
                    <span className={styles.posterExtra}>
                      <span className={styles.count}>{item.count} {item.count === 1 ? 'función' : 'funciones'}</span>
                      {[...item.formats].slice(0, 3).map(format => <span key={format} className={styles.format}>{format}</span>)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </StateView>
        </section>

        {upcoming.length > 0 && (
          <section className="section" aria-labelledby="proximamente">
            <div className="section-head"><h2 id="proximamente">Próximamente y eventos</h2></div>
            <ul className={styles.posters} role="list">
              {upcoming.map(movie => (
                <li key={movie.id}>
                  <Link to={`/peliculas/${movie.slug}`} className={styles.posterCard}>
                    <PosterArt title={movie.title} accent={movie.accent} rating={movie.rating.code} src={movie.posterUrl} decorative />
                    <span className={styles.posterTitle}>{movie.title}</span>
                    <span className={styles.posterMeta}>{movie.stage === 'presale' ? 'Preventa · ' : ''}{formatDate(movie.releaseDate, 'short')}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {highlights.length > 0 && (
          <section className={`section ${styles.highlights}`} aria-label="Destacados del sitio">
            {highlights.map(item => (
              <article key={item.id} className={cx(styles.highlight, styles[item.tone])}>
                <h2>{item.title}</h2>
                <p>{item.text}</p>
                <Link to={item.ctaPath} className="btn btn-small btn-dark">{item.ctaLabel}</Link>
              </article>
            ))}
          </section>
        )}

        <section className={`section ${styles.last}`} aria-labelledby="experiencias">
          <div className="section-head"><h2 id="experiencias"><Sparkles size={22} aria-hidden="true" className={styles.inlineIcon} /> Experiencias</h2></div>
          <ul className={styles.experiences} role="list">
            {EXPERIENCES.map(item => (
              <li key={item.name} className={styles.experience}>
                <strong>{item.name}</strong>
                <span>{item.text}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
