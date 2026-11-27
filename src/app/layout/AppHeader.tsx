import { useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router'
import { Menu, Search, ShoppingCart, User } from 'lucide-react'
import BrandMark from './BrandMark'
import ComplexBar from './ComplexBar'
import SearchDialog from './SearchDialog'
import SearchBox from './SearchBox'
import CartDrawer from './CartDrawer'
import BaseDialog from '@/shared/ui/BaseDialog'
import { useCartStore } from '@/app/stores/cart'
import { useAppStore } from '@/app/stores/app'
import styles from './AppHeader.module.css'

const NAV = [
  { to: '/cartelera', label: 'Cartelera' },
  { to: '/dulceria', label: 'Dulcería' },
  { to: '/promociones', label: 'Promociones' },
  { to: '/club', label: 'Club' },
  { to: '/ayuda', label: 'Ayuda' }
]

export default function AppHeader() {
  const count = useCartStore(state => state.count)
  const customer = useAppStore(state => state.session.kind === 'customer')
  const location = useLocation()
  const [searchOpen, setSearchOpen] = useState(false)
  const [cartOpen, setCartOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  // Al cambiar de página se cierran el menú y el carrito (se ajusta durante el render, sin efecto).
  const [lastPath, setLastPath] = useState(location.pathname + location.search)
  if (lastPath !== location.pathname + location.search) {
    setLastPath(location.pathname + location.search)
    setMenuOpen(false)
    setCartOpen(false)
  }

  return (
    <>
      <header className={styles.header}>
        <div className={`container wide ${styles.shell}`}>
          <button type="button" className={`${styles.iconBtn} ${styles.menuBtn}`} aria-label="Abrir menú" onClick={() => setMenuOpen(true)}><Menu size={22} /></button>
          <Link to="/" className={styles.homeLink}><BrandMark /></Link>
          <nav className={styles.nav} aria-label="Principal">
            {NAV.map(item => <NavLink key={item.to} to={item.to} className={styles.navLink}>{item.label}</NavLink>)}
          </nav>
          <SearchBox className={styles.headerSearch} />
          <div className={styles.actions}>
            <button type="button" className={`${styles.iconBtn} ${styles.searchBtn}`} aria-label="Buscar películas o cines" onClick={() => setSearchOpen(true)}><Search size={20} /></button>
            <Link to="/mi-cuenta" className={styles.iconBtn} aria-label={customer ? 'Mi cuenta' : 'Iniciar sesión'}>
              <User size={20} />
              <span className={styles.accountLabel}>{customer ? 'Mi cuenta' : 'Entrar'}</span>
            </Link>
            <button type="button" className={styles.iconBtn} aria-label={`Carrito, ${count} artículos`} onClick={() => setCartOpen(true)}>
              <ShoppingCart size={20} />
              {count > 0 && <span className={styles.count} aria-hidden="true">{count}</span>}
            </button>
          </div>
        </div>
      </header>
      <ComplexBar />

      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
      <BaseDialog open={menuOpen} label="Menú" side="left" onClose={() => setMenuOpen(false)} header={<BrandMark />}>
        <nav className={styles.mobileNav} aria-label="Principal">
          {NAV.map(item => <NavLink key={item.to} to={item.to}>{item.label}</NavLink>)}
          <NavLink to="/mi-cuenta">Mi cuenta y compras</NavLink>
        </nav>
      </BaseDialog>
    </>
  )
}
