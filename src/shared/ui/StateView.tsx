/** Estados de una consulta: cargando, error recuperable o vacío. Si no hay ninguno, muestra el contenido. */
import type { ReactNode } from 'react'
import { CircleAlert, RefreshCw, SearchX } from 'lucide-react'
import { toApiError } from '@/shared/lib/errors'
import { errorMessage, supportReference } from '@/shared/lib/messages'
import styles from './StateView.module.css'

interface Props {
  loading?: boolean
  error?: unknown
  empty?: boolean
  emptyTitle?: string
  emptyText?: string
  emptyActions?: ReactNode
  skeleton?: 'cards' | 'rows' | 'block'
  onRetry?: () => void
  className?: string
  children?: ReactNode
}

export default function StateView({ loading, error, empty, emptyTitle, emptyText, emptyActions, skeleton, onRetry, className, children }: Props) {
  const apiError = error ? toApiError(error) : null
  const reference = apiError && supportReference(apiError)
  let content: ReactNode
  if (loading) {
    content = (
      <div aria-busy="true">
        <span className="visually-hidden" role="status">Cargando…</span>
        {skeleton === 'cards'
          ? <div className={styles.grid}>{Array.from({ length: 8 }, (_, n) => <div key={n} className={`skeleton ${styles.card}`} />)}</div>
          : skeleton === 'rows'
            ? <div className={styles.rows}>{Array.from({ length: 5 }, (_, n) => <div key={n} className={`skeleton ${styles.row}`} />)}</div>
            : <div className={`skeleton block-skeleton ${styles.block}`} />}
      </div>
    )
  } else if (apiError) {
    content = (
      <div className={styles.message} role="alert">
        <CircleAlert size={34} aria-hidden="true" />
        <h2>No pudimos cargar esta información</h2>
        <p>{errorMessage(apiError)}</p>
        {reference && <small>Referencia: {reference}</small>}
        <button type="button" className="btn btn-secondary" onClick={onRetry}><RefreshCw size={16} /> Reintentar</button>
      </div>
    )
  } else if (empty) {
    content = (
      <div className={styles.message}>
        <SearchX size={34} aria-hidden="true" />
        <h2>{emptyTitle ?? 'Sin resultados'}</h2>
        {emptyText && <p>{emptyText}</p>}
        {emptyActions}
      </div>
    )
  } else {
    content = children
  }
  return <div className={className ? `state-view ${className}` : 'state-view'}>{content}</div>
}
