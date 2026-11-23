<script setup lang="ts">
import BrandMark from './BrandMark.vue'

const version = __APP_VERSION__
const year = new Date().getFullYear()
</script>

<template>
  <footer class="footer">
    <div class="container grid">
      <div class="about">
        <BrandMark />
        <p>Borrador del sitio público. Prototipo no oficial, sin relación comercial con Cinépolis.</p>
      </div>
      <nav aria-label="Compra">
        <h2>Compra</h2>
        <RouterLink to="/cartelera">Cartelera</RouterLink>
        <RouterLink to="/dulceria">Dulcería</RouterLink>
        <RouterLink to="/promociones">Promociones</RouterLink>
        <RouterLink to="/mi-cuenta">Mis compras</RouterLink>
      </nav>
      <nav aria-label="Ayuda">
        <h2>Ayuda</h2>
        <RouterLink to="/ayuda">Preguntas frecuentes</RouterLink>
        <RouterLink to="/legal/contacto">Contacto</RouterLink>
        <RouterLink to="/legal/facturacion">Facturación</RouterLink>
        <RouterLink to="/legal/garantia">Garantía de satisfacción</RouterLink>
      </nav>
      <nav aria-label="Legal">
        <h2>Legal</h2>
        <RouterLink to="/legal/terminos">Términos de uso</RouterLink>
        <RouterLink to="/legal/privacidad">Aviso de privacidad</RouterLink>
      </nav>
    </div>
    <div class="container bottom">
      <span>© {{ year }} · Borrador</span>
      <span>Versión {{ version }}</span>
    </div>
  </footer>
</template>

<style scoped>
.footer { margin-top: 48px; padding-top: 40px; background: var(--grad-dark); color: #c9d6ea; }
.grid { display: grid; grid-template-columns: 1.4fr repeat(3, 1fr); gap: 32px; }
.about p { margin-top: 14px; max-width: 36ch; font-size: 14px; }
nav { display: grid; align-content: start; gap: 8px; }
h2 { margin-bottom: 4px; color: #fff; font: 700 14px var(--font-title); text-transform: uppercase; letter-spacing: .08em; }
a { color: #c9d6ea; font-size: 14px; text-decoration: none; }
a:hover { color: var(--accent); text-decoration: underline; }
.bottom { margin-top: 32px; padding-block: 16px; display: flex; justify-content: space-between; gap: 12px; border-top: 1px solid rgba(255, 255, 255, .12); font-size: 13px; }
@media (max-width: 760px) {
  .grid { grid-template-columns: 1fr 1fr; }
  .about { grid-column: 1 / -1; }
}
</style>
