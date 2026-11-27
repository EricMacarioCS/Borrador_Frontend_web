/** Club informativo, como se decidió para la primera versión: sin canje de puntos en línea. */
import type { CSSProperties } from 'react'
import styles from './ClubView.module.css'

const LEVELS = [
  { name: 'Fan', visits: 'De 0 a 9 visitas por semestre', points: '5 % de tus compras en puntos' },
  { name: 'Fanático', visits: 'De 10 a 19 visitas por semestre', points: '7 % de tus compras en puntos' },
  { name: 'Súper Fanático', visits: '20 visitas o más por semestre', points: '10 % de tus compras en puntos' }
]

export default function ClubView() {
  return (
    <div className="container page">
      <section className={styles.hero}>
        <p className="eyebrow">Club Cinépolis</p>
        <h1>Más visitas, más beneficios</h1>
        <p>Tu nivel se calcula por visitas en el semestre. En esta versión el Club es informativo: el registro y el canje de puntos se habilitarán al conectar el backend.</p>
      </section>
      <ul className={styles.levels} role="list">
        {LEVELS.map((level, index) => (
          <li key={level.name} className={styles.level} style={{ '--n': index } as CSSProperties}>
            <h2>{level.name}</h2>
            <p>{level.visits}</p>
            <strong>{level.points}</strong>
          </li>
        ))}
      </ul>
      <p className={`muted ${styles.note}`}>Porcentajes de ejemplo. Los valores definitivos vendrán del catálogo de niveles.</p>
    </div>
  )
}
