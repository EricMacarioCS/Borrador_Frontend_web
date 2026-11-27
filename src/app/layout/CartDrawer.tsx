import { Link, useNavigate } from 'react-router'
import { ShoppingCart } from 'lucide-react'
import BaseDialog from '@/shared/ui/BaseDialog'
import OrderLines from '@/features/food/OrderLines'
import { useCartStore } from '@/app/stores/cart'
import { useAppStore } from '@/app/stores/app'
import { formatMoney } from '@/shared/lib/money'
import styles from './CartDrawer.module.css'

export default function CartDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { lines, complexId, needsTicketCode, estimateCents, setQuantity } = useCartStore(state => state)
  const complexName = useAppStore(state => complexId ? state.complexById(complexId)?.name : null)
  const navigate = useNavigate()

  function checkout() {
    onClose()
    void navigate('/dulceria/pago')
  }

  return (
    <BaseDialog open={open} label="Carrito de dulcería" side="right" onClose={onClose} header={<h2>Tu carrito</h2>}
      footer={lines.length > 0 && (
        <>
          <div className={styles.total}>
            <span>Total estimado</span>
            <strong>{formatMoney(estimateCents)}</strong>
          </div>
          <p className={`muted ${styles.small}`}>El importe final se confirma antes de pagar.</p>
          <button type="button" className="btn btn-primary btn-block" onClick={checkout}>Continuar al pago</button>
        </>
      )}>
      {!lines.length
        ? (
          <div className={styles.empty}>
            <ShoppingCart size={40} aria-hidden="true" />
            <p>Tu carrito está vacío.</p>
            <Link to="/dulceria" className="btn btn-secondary" onClick={onClose}>Ver dulcería</Link>
          </div>
        )
        : (
          <>
            <p className={styles.where}>Recoges en <strong>{complexName}</strong></p>
            <OrderLines lines={lines} onQuantity={setQuantity} />
            {needsTicketCode && <p className={`notice ${styles.notice}`}>Para recoger alimentos necesitarás el folio de tus boletos de este complejo.</p>}
          </>
        )}
    </BaseDialog>
  )
}
