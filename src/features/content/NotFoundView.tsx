import { Link } from 'react-router'
import styles from './NotFoundView.module.css'

export default function NotFoundView() {
  return (
    <div className={`container page ${styles.center}`}>
      <p className={styles.code} aria-hidden="true">404</p>
      <h1 className="page-title">No encontramos esta página</h1>
      <p className="page-lead">Puede que el enlace sea incorrecto o que la función ya no exista.</p>
      <div className={styles.actions}>
        <Link to="/" className="btn btn-primary">Ir al inicio</Link>
        <Link to="/cartelera" className="btn btn-secondary">Ver cartelera</Link>
      </div>
    </div>
  )
}
