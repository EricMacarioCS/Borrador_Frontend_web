<template>
  <div class="container page center">
    <p class="code" aria-hidden="true">404</p>
    <h1 class="page-title">No encontramos esta página</h1>
    <p class="page-lead">Puede que el enlace sea incorrecto o que la función ya no exista.</p>
    <div class="actions">
      <RouterLink to="/" class="btn btn-primary">Ir al inicio</RouterLink>
      <RouterLink to="/cartelera" class="btn btn-secondary">Ver cartelera</RouterLink>
    </div>
  </div>
</template>

<style scoped>
.center { display: grid; justify-items: center; text-align: center; gap: 10px; }
.code { font: 800 clamp(80px, 14vw, 160px)/1 var(--font-title); background: var(--grad-action); background-clip: text; -webkit-background-clip: text; color: transparent; filter: drop-shadow(0 0 24px rgba(56, 189, 248, .4)); }
.actions { margin-top: 12px; display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; }
</style>
