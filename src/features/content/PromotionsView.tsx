import { Link } from 'react-router'
import { CalendarDays, CreditCard, Store } from 'lucide-react'
import StateView from '@/shared/ui/StateView'
import { usePromotions } from '@/app/queries'
import { formatDate } from '@/shared/lib/datetime'
import { cx } from '@/shared/lib/cx'
import type { Promotion } from '@/domain/models'
import styles from './PromotionsView.module.css'

/** Acento por tipo de promoción. Un tipo nuevo del catálogo usa el cian. */
const ACCENTS: Record<string, string> = { Martes: 'cyan', Formato: 'violet', Familia: 'gold', Banco: 'green' }
const accent = (promotion: Promotion) => ACCENTS[promotion.tag] ?? 'cyan'
/** Cifra del beneficio (2×1, 20 %) tal como viene en el texto de la promoción, si la trae. */
const figure = (promotion: Promotion) => `${promotion.title} ${promotion.description}`.match(/\d+\s?×\s?\d+|\d+\s?%/)?.[0] ?? null

export default function PromotionsView() {
  const promotions = usePromotions()
  return (
    <div className="container page">
      <p className="eyebrow">Promociones</p>
      <h1 className="page-title">Ahorra en tu próxima función</h1>
      <p className="page-lead">Solo se aplica una promoción por compra. Las condiciones se revisan al calcular tu total.</p>
      <StateView loading={promotions.isPending} error={promotions.error} empty={!promotions.data?.length} skeleton="cards" onRetry={() => void promotions.refetch()}>
        <ul className={styles.grid} role="list">
          {promotions.data?.map(promotion => {
            const amount = figure(promotion)
            return (
              <li key={promotion.id} className={cx(styles.promo, styles[`accent-${accent(promotion)}`])}>
                <span className={styles.tag}>{promotion.tag}</span>
                <h2>{promotion.title}</h2>
                <div className={styles.benefit}>
                  {amount
                    ? <strong className={styles.figure} aria-hidden="true">{amount}</strong>
                    : <CreditCard className={styles.figureIcon} size={44} strokeWidth={1.6} aria-hidden="true" />}
                  <p>{promotion.description}</p>
                </div>
                <p className={styles.conditions}>{promotion.conditions}</p>
                <p className={styles.valid}>
                  <CalendarDays size={15} aria-hidden="true" />
                  Vigente desde el {formatDate(promotion.validFrom, 'short')}{promotion.validTo ? ` hasta el ${formatDate(promotion.validTo, 'short')}` : ''}
                </p>
                <div className={styles.action}>
                  {promotion.appliesOnline
                    ? <Link to="/cartelera" className="btn btn-primary btn-block">Elegir función</Link>
                    : <p className={styles.boxOffice}><Store size={16} aria-hidden="true" /> Solo en taquilla</p>}
                </div>
              </li>
            )
          })}
        </ul>
      </StateView>
    </div>
  )
}
