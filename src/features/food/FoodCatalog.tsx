/**
 * Catálogo de dulcería: categorías, productos y personalización.
 * Es el mismo en la pestaña Dulcería y en el paso de alimentos de la compra de boletos;
 * cada vista decide qué hacer con el producto elegido (carrito o compra en curso).
 */
import { useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import ProductGrid from './ProductGrid'
import ProductCustomizer from './ProductCustomizer'
import StateView from '@/shared/ui/StateView'
import { useProducts } from '@/app/queries'
import { normalizeText } from '@/shared/lib/text'
import type { CartLine } from '@/app/stores/cart'
import type { Product } from '@/domain/models'
import styles from './FoodCatalog.module.css'

interface Props {
  complexId: string | null
  /** Categorías que no aplican en este contexto. */
  excludeCategories?: string[]
  category: string
  onCategory: (value: string) => void
  onAdd: (line: Omit<CartLine, 'key'>) => void
}

const NONE: string[] = []

export default function FoodCatalog({ complexId, excludeCategories = NONE, category, onCategory, onAdd }: Props) {
  const products = useProducts(complexId)
  const [customizing, setCustomizing] = useState<Product | null>(null)
  const [term, setTerm] = useState('')

  const available = (products.data ?? []).filter(product => !excludeCategories.includes(product.category.code))
  const seen = new Map<string, { label: string; count: number }>()
  for (const product of available) {
    const entry = seen.get(product.category.code) ?? { label: product.category.name, count: 0 }
    entry.count++
    seen.set(product.category.code, entry)
  }
  const categories = [{ value: 'todas', label: 'Todo', count: available.length }, ...[...seen].map(([value, { label, count }]) => ({ value, label, count }))]
  const query = normalizeText(term)
  const shown = available.filter(product =>
    (category === 'todas' || product.category.code === category) &&
    (!query || normalizeText(`${product.name} ${product.description}`).includes(query)))

  // Cambiar de cine regresa a todas las categorías.
  const lastComplex = useRef(complexId)
  const categoryChange = useRef(onCategory)
  useEffect(() => { categoryChange.current = onCategory })
  useEffect(() => {
    if (lastComplex.current === complexId) return
    lastComplex.current = complexId
    categoryChange.current('todas')
  }, [complexId])

  function add(line: Omit<CartLine, 'key'>) {
    onAdd(line)
    setCustomizing(null)
  }

  return (
    <div className={styles.catalog}>
      <div className={styles.bar}>
        <div className="chip-row" role="group" aria-label="Categoría">
          {categories.map(item => (
            <button key={item.value} type="button" className="chip" aria-pressed={category === item.value} onClick={() => onCategory(item.value)}>
              {item.label} <span className={styles.n}>{item.count}</span>
            </button>
          ))}
        </div>
        <label className={styles.search}>
          <Search size={17} aria-hidden="true" />
          <span className="visually-hidden">Buscar en dulcería</span>
          <input value={term} onChange={event => setTerm(event.target.value)} type="search" placeholder="Buscar producto" autoComplete="off" />
          {term && <button type="button" className={styles.clear} aria-label="Borrar búsqueda" onClick={() => setTerm('')}><X size={14} /></button>}
        </label>
      </div>

      <StateView loading={products.isPending && Boolean(complexId)} error={products.error} empty={!shown.length} skeleton="cards"
        emptyTitle={term ? `No hay productos con «${term}»` : 'No hay productos en esta categoría'} onRetry={() => void products.refetch()}>
        <ProductGrid products={shown} onChoose={setCustomizing} />
      </StateView>

      <ProductCustomizer product={customizing} onClose={() => setCustomizing(null)} onAdd={add} />
    </div>
  )
}
