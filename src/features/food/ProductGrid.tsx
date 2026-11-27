import type { CSSProperties } from 'react'
import { Plus } from 'lucide-react'
import type { Product } from '@/domain/models'
import { formatMoney } from '@/shared/lib/money'
import { hashHue } from '@/shared/lib/text'
import { cx } from '@/shared/lib/cx'
import styles from './ProductGrid.module.css'

export default function ProductGrid({ products, onChoose }: { products: Product[]; onChoose: (product: Product) => void }) {
  const sorted = [...products].sort((a, b) => Number(b.available) - Number(a.available))
  return (
    <ul className={styles.grid} role="list">
      {sorted.map(product => (
        <li key={product.id} className={cx(styles.product, !product.available && styles.off)}>
          <div className={styles.art} style={{ '--hue': hashHue(product.category.code) } as CSSProperties} aria-hidden="true">{product.name.slice(0, 1)}</div>
          <div className={styles.copy}>
            <h3>{product.name}</h3>
            <p>{product.description}</p>
            <strong>{product.rules.length ? 'Desde ' : ''}{formatMoney(product.basePriceCents)}</strong>
          </div>
          <button type="button" className={`btn btn-small ${product.available ? 'btn-primary' : 'btn-secondary'}`} disabled={!product.available}
            aria-label={product.available ? `Agregar ${product.name}` : `${product.name} agotado`} onClick={() => onChoose(product)}>
            {product.available ? <><Plus size={16} /> Agregar</> : 'Agotado'}
          </button>
        </li>
      ))}
    </ul>
  )
}
