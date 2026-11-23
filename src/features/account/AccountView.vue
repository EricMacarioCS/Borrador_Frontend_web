<script setup lang="ts">
/**
 * Acceso sin contraseña con código de un solo uso al correo (tabla otp_verificacion).
 * Las compras de invitado de este navegador se ven sin iniciar sesión.
 */
import { computed, ref } from 'vue'
import { useQueryClient } from '@tanstack/vue-query'
import { LogOut, Mail } from '@lucide/vue'
import StateView from '@/shared/ui/StateView.vue'
import { useConfig, useServices } from '@/app/services'
import { useAppStore } from '@/app/stores/app'
import { keys, useMyPurchases } from '@/app/queries'
import { PURCHASE_STATUS_LABELS } from '@/domain/labels'
import { formatDateTime } from '@/shared/lib/datetime'
import { formatMoney } from '@/shared/lib/money'
import { toApiError } from '@/shared/lib/errors'
import { errorMessage } from '@/shared/lib/messages'
import { toast } from '@/shared/composables/feedback'

const { account, mode } = useServices()
const config = useConfig()
const app = useAppStore()
const queryClient = useQueryClient()
const purchases = useMyPurchases()

const email = ref('')
const code = ref('')
const step = ref<'email' | 'code'>('email')
const devCode = ref<string | null>(null)
const busy = ref(false)
const error = ref('')
const signedIn = computed(() => app.session.kind === 'customer')

async function requestCode() {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) { error.value = 'Escribe un correo válido.'; return }
  busy.value = true
  error.value = ''
  try {
    const result = await account.requestCode(email.value.trim())
    devCode.value = result.devCode
    step.value = 'code'
  } catch (failure) {
    error.value = errorMessage(toApiError(failure))
  } finally {
    busy.value = false
  }
}

async function verify() {
  busy.value = true
  error.value = ''
  try {
    app.session = await account.verifyCode(email.value.trim(), code.value.trim())
    // La caché de la sesión anterior no debe mostrarse con la nueva.
    queryClient.removeQueries({ queryKey: keys.purchases() })
    toast('Sesión iniciada.')
  } catch (failure) {
    error.value = errorMessage(toApiError(failure))
  } finally {
    busy.value = false
  }
}

async function signOut() {
  app.session = await account.signOut()
  queryClient.clear()
  step.value = 'email'
  code.value = ''
  toast('Sesión cerrada.', 'info')
}
</script>

<template>
  <div class="container page grid">
    <section class="card access">
      <template v-if="signedIn">
        <p class="eyebrow">Mi cuenta</p>
        <h1>Hola</h1>
        <p class="muted">Sesión iniciada como <strong>{{ app.session.email }}</strong>.</p>
        <button type="button" class="btn btn-secondary" @click="signOut"><LogOut :size="18" /> Cerrar sesión</button>
      </template>
      <template v-else-if="!config.features.accounts">
        <p class="eyebrow">Mi cuenta</p>
        <h1>Tus compras</h1>
        <p class="muted">El acceso con correo no está disponible por ahora. Aquí ves las compras hechas desde este navegador; tus boletos también llegan por correo.</p>
      </template>
      <template v-else>
        <p class="eyebrow">Mi cuenta</p>
        <h1>Consulta tus compras</h1>
        <p class="muted">Te enviamos un código de un solo uso al correo con el que compraste. No necesitas contraseña.</p>
        <form v-if="step === 'email'" class="form" novalidate @submit.prevent="requestCode">
          <label class="field">
            <span>Correo electrónico</span>
            <input v-model="email" class="input" type="email" autocomplete="email" inputmode="email" required :aria-invalid="!!error" />
          </label>
          <button type="submit" class="btn btn-primary" :disabled="busy"><Mail :size="18" /> {{ busy ? 'Enviando…' : 'Enviar código' }}</button>
        </form>
        <form v-else class="form" novalidate @submit.prevent="verify">
          <p class="muted">Escribe el código de 6 dígitos que enviamos a <strong>{{ email }}</strong>.</p>
          <p v-if="mode === 'mock' && devCode" class="notice">Simulación: tu código es <strong>{{ devCode }}</strong>.</p>
          <label class="field">
            <span>Código</span>
            <input v-model="code" class="input code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" required :aria-invalid="!!error" />
          </label>
          <div class="row">
            <button type="submit" class="btn btn-primary" :disabled="busy || code.length !== 6">{{ busy ? 'Verificando…' : 'Entrar' }}</button>
            <button type="button" class="btn btn-ghost" @click="step = 'email'">Cambiar correo</button>
          </div>
        </form>
        <p v-if="error" class="field-error" role="alert">{{ error }}</p>
      </template>
    </section>

    <section class="purchases" aria-labelledby="mis-compras">
      <h2 id="mis-compras">Mis compras</h2>
      <p v-if="!signedIn" class="muted">Se muestran las compras hechas desde este navegador.</p>
      <StateView :loading="purchases.isPending.value" :error="purchases.error.value" :empty="!purchases.data.value?.length" skeleton="rows"
        empty-title="Sin compras" empty-text="Tus boletos y pedidos aparecerán aquí." @retry="purchases.refetch()">
        <ul class="list" role="list">
          <li v-for="purchase in purchases.data.value" :key="purchase.id">
            <RouterLink :to="`/compras/${purchase.id}`" class="item card">
              <span class="title">{{ purchase.screening?.movieTitle ?? 'Pedido de dulcería' }}</span>
              <span class="muted">{{ purchase.complex.name }} · {{ formatDateTime(purchase.screening?.startsAt ?? purchase.createdAt) }}</span>
              <span class="meta">
                <span class="badge">{{ PURCHASE_STATUS_LABELS[purchase.status] }}</span>
                <strong>{{ formatMoney(purchase.totals.totalCents) }}</strong>
                <span v-if="purchase.ticketCode" class="muted">Folio {{ purchase.ticketCode }}</span>
              </span>
            </RouterLink>
          </li>
        </ul>
      </StateView>
    </section>
  </div>
</template>

<style scoped>
.grid { display: grid; grid-template-columns: 380px 1fr; gap: 28px; align-items: start; }
.access { padding: 24px; display: grid; gap: 12px; justify-items: start; }
.access h1 { font: 800 28px var(--font-title); }
.form { width: 100%; display: grid; gap: 14px; }
.code { font: 800 24px var(--font-title); letter-spacing: .3em; text-align: center; }
.row { display: flex; flex-wrap: wrap; gap: 8px; }
.purchases h2 { margin-bottom: 8px; font: 800 24px var(--font-title); }
.list { margin-top: 12px; display: grid; gap: 12px; }
.item { padding: 16px 18px; display: grid; gap: 4px; text-decoration: none; transition: box-shadow .3s, transform .3s var(--ease); }
.item:hover { transform: translateY(-2px); box-shadow: 0 0 0 1px var(--accent), 0 14px 30px rgba(11, 21, 48, .12); }
.title { font: 800 18px var(--font-title); }
.meta { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
@media (max-width: 860px) { .grid { grid-template-columns: minmax(0, 1fr); } }
</style>
