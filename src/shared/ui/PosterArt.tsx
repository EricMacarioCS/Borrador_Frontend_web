/**
 * Arte provisional sin imágenes: degradado con el color de la película y su título.
 * Cuando existan carteles, `src` lo reemplaza sin cambiar el tamaño ni el diseño.
 * La clase global `poster-art` permite que otras vistas ajusten su tamaño o sus esquinas.
 */
import type { CSSProperties } from 'react'
import { cx } from '@/shared/lib/cx'
import styles from './PosterArt.module.css'

interface Props {
  title: string
  accent: string
  rating?: string
  src?: string | null
  variant?: 'poster' | 'wide'
  decorative?: boolean
  className?: string
}

export default function PosterArt({ title, accent, rating, src = null, variant = 'poster', decorative = false, className }: Props) {
  const initials = title.split(/\s+/).filter(word => word.length > 2).slice(0, 2).map(word => word[0]).join('').toUpperCase()
  return (
    <div className={cx('poster-art', styles.art, styles[variant], className)} style={{ '--art': accent } as CSSProperties}
      role={decorative ? undefined : 'img'} aria-label={decorative ? undefined : `Cartel de ${title}`} aria-hidden={decorative || undefined}>
      {src
        ? <img src={src} alt="" loading="lazy" />
        : (
          <>
            <span className={styles.glow} />
            <span className={styles.initials} aria-hidden="true">{initials}</span>
            <span className={styles.title} aria-hidden="true">{title}</span>
          </>
        )}
      {rating && <span className={styles.rating} aria-hidden="true">{rating}</span>}
    </div>
  )
}
