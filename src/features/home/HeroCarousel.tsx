/**
 * Portada con cartel pequeño y fondo animado del color de la película.
 * Sin imágenes ni video: cuando existan, el fondo usará `backdropUrl` y el tráiler un video propio.
 */
import { useEffect, useState, type CSSProperties } from 'react'
import { Link } from 'react-router'
import { ChevronLeft, ChevronRight, Pause, Play, Ticket } from 'lucide-react'
import PosterArt from '@/shared/ui/PosterArt'
import QuickBuy from './QuickBuy'
import { appStore } from '@/app/stores/app'
import { STAGE_LABELS, durationLabel } from '@/domain/labels'
import type { Movie } from '@/domain/models'
import styles from './HeroCarousel.module.css'

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

export default function HeroCarousel({ movies }: { movies: Movie[] }) {
  const [index, setIndexState] = useState(0)
  const [buying, setBuying] = useState(false)
  const [paused, setPaused] = useState(reducedMotion)
  const movie = movies[index] ?? movies[0]
  const count = movies.length

  /** Cambiar de diapositiva cierra la compra rápida. */
  function setIndex(next: number) {
    setIndexState(next)
    setBuying(false)
  }
  const go = (step: number) => setIndex((index + step + count) % count)

  // Avance automático cada 8 s, salvo en pausa, durante la compra rápida o con una sola película.
  useEffect(() => {
    if (paused || buying || count < 2) return
    const timer = window.setInterval(() => {
      setIndexState(current => (current + 1) % count)
    }, 8000)
    return () => clearInterval(timer)
  }, [paused, buying, count])

  // Sin cine elegido primero se pide el cine y luego se muestra la película.
  function buy() {
    if (!movie) return
    if (!appStore.getState().selectedComplexIds.length) appStore.getState().askForComplexes(`/peliculas/${movie.slug}`)
    else setBuying(!buying)
  }

  if (!movie) return null
  return (
    <>
      <section className={styles.hero} style={{ '--hero-accent': movie.accent } as CSSProperties} aria-roledescription="carrusel" aria-label="Destacados">
        <div className={styles.backdrop} aria-hidden="true">
          <span className={`${styles.orb} ${styles.a}`} /><span className={`${styles.orb} ${styles.b}`} /><span className={`${styles.orb} ${styles.c}`} />
        </div>
        <div className={styles.shade} aria-hidden="true" />
        <div key={movie.id} className={`container ${styles.content}`} aria-roledescription="diapositiva" aria-label={`${index + 1} de ${count}`}>
          <PosterArt className={styles.poster} title={movie.title} accent={movie.accent} rating={movie.rating.code} src={movie.posterUrl} decorative />
          <div className={styles.copy}>
            <p className={styles.kicker}><b>{movie.isSpecialEvent ? 'Evento especial' : STAGE_LABELS[movie.stage]}</b></p>
            <h1>{movie.title}</h1>
            <p className={styles.meta}>
              <span className={styles.tag}>{movie.rating.code}</span>
              {movie.genres.join(', ')} · {durationLabel(movie.durationMinutes)}
            </p>
            <p className={styles.synopsis}>{movie.synopsis}</p>
            <div className={styles.actions}>
              <button type="button" className={styles.buy} aria-expanded={buying} onClick={buy}><Ticket size={18} /> Comprar boletos</button>
              <Link to={`/peliculas/${movie.slug}`} className="btn btn-dark">Ver detalles</Link>
            </div>
          </div>
        </div>
        {count > 1 && (
          <>
            <button type="button" className={`${styles.arrow} ${styles.previous}`} aria-label="Destacado anterior" onClick={() => go(-1)}><ChevronLeft size={34} /></button>
            <button type="button" className={`${styles.arrow} ${styles.next}`} aria-label="Destacado siguiente" onClick={() => go(1)}><ChevronRight size={34} /></button>
            <div className={styles.dots} role="group" aria-label="Elegir destacado">
              {movies.map((item, i) => <button key={item.id} type="button" aria-pressed={i === index} aria-label={item.title} onClick={() => setIndex(i)} />)}
            </div>
            <button type="button" className={styles.pause} aria-label={paused ? 'Reanudar carrusel' : 'Pausar carrusel'} onClick={() => setPaused(!paused)}>
              {paused ? <Play size={16} /> : <Pause size={16} />}
            </button>
          </>
        )}
      </section>
      {buying && <QuickBuy key={movie.id} movie={movie} onClose={() => setBuying(false)} />}
    </>
  )
}
