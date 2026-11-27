import { Check, CircleAlert, Info, X } from 'lucide-react'
import BaseDialog from '@/shared/ui/BaseDialog'
import { answerConfirm, dismissToast, useFeedback } from '@/shared/feedback'
import { cx } from '@/shared/lib/cx'
import styles from './FeedbackHost.module.css'

export default function FeedbackHost() {
  const toasts = useFeedback(state => state.toasts)
  const request = useFeedback(state => state.confirm)

  return (
    <>
      <div className={styles.toasts} aria-live="polite">
        {toasts.map(item => (
          <div key={item.id} className={cx(styles.toast, styles[item.tone])} role={item.tone === 'error' ? 'alert' : 'status'}>
            <span className={styles.icon}>{item.tone === 'error' ? <CircleAlert size={16} /> : item.tone === 'info' ? <Info size={16} /> : <Check size={16} />}</span>
            <span className={styles.text}>{item.text}</span>
            <button type="button" aria-label="Cerrar aviso" onClick={() => dismissToast(item.id)}><X size={16} /></button>
          </div>
        ))}
      </div>

      <BaseDialog open={!!request} label={request?.title ?? 'Confirmar'} size="small" onClose={() => answerConfirm(false)}
        header={<h2>{request?.title}</h2>}
        footer={(
          <div className={styles.confirmActions}>
            <button type="button" className="btn btn-ghost" onClick={() => answerConfirm(false)}>{request?.cancelLabel ?? 'Volver'}</button>
            <button type="button" className={cx('btn', request?.danger ? `btn-secondary ${styles.danger}` : 'btn-primary')} data-autofocus onClick={() => answerConfirm(true)}>
              {request?.confirmLabel}
            </button>
          </div>
        )}>
        <p className={styles.confirmText}>{request?.text}</p>
      </BaseDialog>
    </>
  )
}
