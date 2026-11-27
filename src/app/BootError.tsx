import { toApiError } from '@/shared/lib/errors'
import { supportReference } from '@/shared/lib/messages'
import styles from './BootError.module.css'

export default function BootError({ error }: { error: unknown }) {
  const apiError = toApiError(error)
  // Al arrancar, cualquier falla significa lo mismo para el cliente: el sitio no está disponible.
  const message = apiError.code === 'NETWORK' || apiError.code === 'TIMEOUT'
    ? 'Revisa tu conexión a internet e intenta de nuevo.'
    : 'El servicio no está disponible en este momento. Intenta de nuevo en unos minutos.'
  const reference = supportReference(apiError)

  return (
    <main className={styles.bootError}>
      <div className={`card ${styles.card}`}>
        <p className="eyebrow">Cinépolis</p>
        <h1>No pudimos abrir el sitio</h1>
        <p>{message}</p>
        {reference && <small>Referencia: {reference}</small>}
        <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>Intentar de nuevo</button>
      </div>
    </main>
  )
}
