import { Link } from 'react-router'
import BrandMark from './BrandMark'
import styles from './AppFooter.module.css'

const version = __APP_VERSION__
const year = new Date().getFullYear()

export default function AppFooter() {
  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.grid}`}>
        <div className={styles.about}>
          <BrandMark />
          <p>Borrador del sitio público. Prototipo no oficial, sin relación comercial con Cinépolis.</p>
        </div>
        <nav aria-label="Compra">
          <h2>Compra</h2>
          <Link to="/cartelera">Cartelera</Link>
          <Link to="/dulceria">Dulcería</Link>
          <Link to="/promociones">Promociones</Link>
          <Link to="/mi-cuenta">Mis compras</Link>
        </nav>
        <nav aria-label="Ayuda">
          <h2>Ayuda</h2>
          <Link to="/ayuda">Preguntas frecuentes</Link>
          <Link to="/legal/contacto">Contacto</Link>
          <Link to="/legal/facturacion">Facturación</Link>
          <Link to="/legal/garantia">Garantía de satisfacción</Link>
        </nav>
        <nav aria-label="Legal">
          <h2>Legal</h2>
          <Link to="/legal/terminos">Términos de uso</Link>
          <Link to="/legal/privacidad">Aviso de privacidad</Link>
        </nav>
      </div>
      <div className={`container ${styles.bottom}`}>
        <span>© {year} · Borrador</span>
        <span>Versión {version}</span>
      </div>
    </footer>
  )
}
