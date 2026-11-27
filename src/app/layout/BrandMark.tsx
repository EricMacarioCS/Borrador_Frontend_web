import styles from './BrandMark.module.css'

/** Marca del sitio. La clase global `brand-word` permite reducir el texto en celular. */
export default function BrandMark() {
  return (
    <span className={styles.brand} aria-label="Cinépolis">
      <span className={styles.mark} aria-hidden="true">c</span>
      <span className={`brand-word ${styles.word}`} aria-hidden="true">cinépolis</span>
    </span>
  )
}
