/** Barra de cines: cada cine elegido en su propia burbuja, con botón para quitarlo. La preferencia se guarda en el navegador. */
import { MapPin, Plus, X } from 'lucide-react'
import { useAppStore } from '@/app/stores/app'
import styles from './ComplexBar.module.css'

export default function ComplexBar() {
  const selected = useAppStore(state => state.selectedComplexes)
  const city = useAppStore(state => state.selectedCity)
  const askForComplexes = useAppStore(state => state.askForComplexes)
  const removeComplex = useAppStore(state => state.removeComplex)

  return (
    <div className={styles.bar}>
      <div className={`container wide ${styles.inner}`}>
        <MapPin size={18} aria-hidden="true" className={styles.pin} />
        {selected.length
          ? (
            <>
              <span className={`${styles.label} ${styles.cityLabel}`}>Tus cines en <strong>{city}</strong>:</span>
              <ul className={styles.bubbles} role="list" aria-label="Cines elegidos">
                {selected.map(complex => (
                  <li key={complex.id} className={styles.bubble}>
                    <button type="button" className={styles.name} aria-haspopup="dialog" title={`Cambiar cines (${complex.name})`} onClick={() => askForComplexes()}>{complex.name}</button>
                    <button type="button" className={styles.remove} aria-label={`Quitar ${complex.name}`} onClick={() => removeComplex(complex.id)}><X size={14} /></button>
                  </li>
                ))}
              </ul>
              <button type="button" className={styles.add} aria-haspopup="dialog" aria-label="Agregar o cambiar cines" onClick={() => askForComplexes()}>
                <Plus size={16} /> <span className={styles.addText}>Agregar o cambiar</span>
              </button>
            </>
          )
          : (
            <>
              <span className={styles.label}>Elige un cine para ver horarios y comprar boletos.</span>
              <button type="button" className={`${styles.add} ${styles.strong}`} aria-haspopup="dialog" onClick={() => askForComplexes()}><Plus size={16} /> Elegir cine</button>
            </>
          )}
      </div>
    </div>
  )
}
