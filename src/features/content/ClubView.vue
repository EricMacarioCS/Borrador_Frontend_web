<script setup lang="ts">
/** Club informativo, como se decidió para la primera versión: sin canje de puntos en línea. */
const LEVELS = [
  { name: 'Fan', visits: 'De 0 a 9 visitas por semestre', points: '5 % de tus compras en puntos' },
  { name: 'Fanático', visits: 'De 10 a 19 visitas por semestre', points: '7 % de tus compras en puntos' },
  { name: 'Súper Fanático', visits: '20 visitas o más por semestre', points: '10 % de tus compras en puntos' }
]
</script>

<template>
  <div class="container page">
    <section class="hero">
      <p class="eyebrow">Club Cinépolis</p>
      <h1>Más visitas, más beneficios</h1>
      <p>Tu nivel se calcula por visitas en el semestre. En esta versión el Club es informativo: el registro y el canje de puntos se habilitarán al conectar el backend.</p>
    </section>
    <ul class="levels" role="list">
      <li v-for="(level, index) in LEVELS" :key="level.name" class="level" :style="{ '--n': index }">
        <h2>{{ level.name }}</h2>
        <p>{{ level.visits }}</p>
        <strong>{{ level.points }}</strong>
      </li>
    </ul>
    <p class="muted note">Porcentajes de ejemplo. Los valores definitivos vendrán del catálogo de niveles.</p>
  </div>
</template>

<style scoped>
.hero { padding: 36px; border-radius: var(--radius-l); background: radial-gradient(70% 120% at 100% 0%, rgba(255, 201, 60, .35), transparent 60%), var(--grad-dark); color: #fff; }
.hero .eyebrow { color: var(--gold); }
.hero h1 { margin: 8px 0 12px; font: 800 clamp(28px, 4vw, 44px) var(--font-title); }
.hero p { max-width: 70ch; color: #dbe6f7; }
.levels { margin-top: 24px; display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 18px; }
.level { padding: 24px; display: grid; gap: 8px; border: 1px solid var(--line); border-radius: var(--radius-l); background: linear-gradient(160deg, #fff, color-mix(in srgb, var(--accent) calc(10% + var(--n) * 12%), #fff)); box-shadow: var(--shadow-card); }
.level h2 { color: var(--blue); font: 800 24px var(--font-title); }
.level p { color: var(--muted); }
.note { margin-top: 14px; font-size: 13px; }
</style>
