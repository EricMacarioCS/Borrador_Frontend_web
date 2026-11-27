import { Link } from 'react-router'
import StateView from '@/shared/ui/StateView'
import { useFaq } from '@/app/queries'
import styles from './HelpView.module.css'

export default function HelpView() {
  const faq = useFaq()
  return (
    <div className={`container page ${styles.narrow}`}>
      <p className="eyebrow">Ayuda</p>
      <h1 className="page-title">Preguntas frecuentes</h1>
      <StateView loading={faq.isPending} error={faq.error} empty={!faq.data?.length} skeleton="rows" onRetry={() => void faq.refetch()}>
        <div className={styles.list}>
          {faq.data?.map(item => (
            <details key={item.question} className={styles.item}>
              <summary>{item.question}</summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      </StateView>
      <p className={`muted ${styles.more}`}>¿No encontraste tu respuesta? Consulta <Link to="/legal/contacto">contacto</Link>.</p>
    </div>
  )
}
