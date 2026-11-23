<script setup lang="ts">
import { computed } from 'vue'
import { toApiError } from '@/shared/lib/errors'
import { supportReference } from '@/shared/lib/messages'

const props = defineProps<{ error: unknown }>()
const apiError = computed(() => toApiError(props.error))
// Al arrancar, cualquier falla significa lo mismo para el cliente: el sitio no está disponible.
const message = computed(() => apiError.value.code === 'NETWORK' || apiError.value.code === 'TIMEOUT'
  ? 'Revisa tu conexión a internet e intenta de nuevo.'
  : 'El servicio no está disponible en este momento. Intenta de nuevo en unos minutos.')
const reference = computed(() => supportReference(apiError.value))
const reload = () => window.location.reload()
</script>

<template>
  <main class="boot-error">
    <div class="card">
      <p class="eyebrow">Cinépolis</p>
      <h1>No pudimos abrir el sitio</h1>
      <p>{{ message }}</p>
      <small v-if="reference">Referencia: {{ reference }}</small>
      <button type="button" class="btn btn-primary" @click="reload">Intentar de nuevo</button>
    </div>
  </main>
</template>

<style scoped>
.boot-error { min-height: 100dvh; display: grid; place-items: center; padding: 20px; background: var(--grad-dark); }
.card { max-width: 460px; padding: 32px; display: grid; gap: 14px; text-align: center; justify-items: center; }
h1 { font: 800 26px var(--font-title); }
p, small { color: var(--muted); }
</style>
