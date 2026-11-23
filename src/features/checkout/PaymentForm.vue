<script setup lang="ts">
/**
 * Datos del comprador y método de pago. Nunca se piden datos de tarjeta aquí:
 * con la pasarela real, el pago ocurre en la página o el marco del proveedor.
 */
import { computed, reactive, useId } from 'vue'
import { ShieldCheck } from '@lucide/vue'
import type { Customer } from '@/domain/models'
import { useConfig } from '@/app/services'

const props = defineProps<{ initialEmail: string | null }>()
const config = useConfig()
const uid = useId()
const form = reactive({ firstName: '', lastName: '', email: props.initialEmail ?? '', method: config.apiMode === 'mock' ? 'simulated-approve' : 'card', accepted: false })
const touched = reactive({ firstName: false, lastName: false, email: false, accepted: false })

const errors = computed(() => ({
  firstName: form.firstName.trim().length < 2 ? 'Escribe tu nombre.' : '',
  lastName: form.lastName.trim().length < 2 ? 'Escribe tu apellido.' : '',
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()) ? '' : 'Escribe un correo válido.',
  accepted: form.accepted ? '' : 'Acepta los términos para continuar.'
}))
const valid = computed(() => Object.values(errors.value).every(value => !value))

const METHODS = computed(() => config.apiMode === 'mock'
  ? [
    { value: 'simulated-approve', label: 'Aprobar pago (simulación)', hint: 'La compra se confirma en unos segundos.' },
    { value: 'simulated-decline', label: 'Rechazar pago (simulación)', hint: 'Para probar el manejo de un pago rechazado.' }
  ]
  : [{ value: 'card', label: 'Tarjeta de crédito o débito', hint: 'Continuarás en la página segura del proveedor de pagos.' }])

/** Marca todo como tocado y devuelve los datos si son válidos. */
function submit(): { customer: Customer; method: string } | null {
  if (!config.features.onlinePayments) return null
  Object.keys(touched).forEach(key => { touched[key as keyof typeof touched] = true })
  if (!valid.value) return null
  return { customer: { firstName: form.firstName.trim(), lastName: form.lastName.trim(), email: form.email.trim() }, method: form.method }
}

defineExpose({ submit, valid })
</script>

<template>
  <div class="payment">
    <p v-if="!config.features.onlinePayments" class="notice notice-warning" role="status">
      Los pagos en línea están suspendidos por el momento. Tus asientos siguen apartados mientras dure el tiempo; también puedes comprar en taquilla.
    </p>
    <fieldset class="group">
      <legend>Tus datos</legend>
      <div class="fields">
        <div class="field">
          <label :for="`${uid}-nombre`">Nombre</label>
          <input :id="`${uid}-nombre`" v-model="form.firstName" class="input" autocomplete="given-name"
            :aria-invalid="touched.firstName && !!errors.firstName" :aria-describedby="`${uid}-nombre-error`" @blur="touched.firstName = true" />
          <small :id="`${uid}-nombre-error`" class="field-error">{{ touched.firstName ? errors.firstName : '' }}</small>
        </div>
        <div class="field">
          <label :for="`${uid}-apellido`">Apellido</label>
          <input :id="`${uid}-apellido`" v-model="form.lastName" class="input" autocomplete="family-name"
            :aria-invalid="touched.lastName && !!errors.lastName" :aria-describedby="`${uid}-apellido-error`" @blur="touched.lastName = true" />
          <small :id="`${uid}-apellido-error`" class="field-error">{{ touched.lastName ? errors.lastName : '' }}</small>
        </div>
        <div class="field wide">
          <label :for="`${uid}-correo`">Correo electrónico</label>
          <input :id="`${uid}-correo`" v-model="form.email" class="input" type="email" autocomplete="email" inputmode="email"
            :aria-invalid="touched.email && !!errors.email" :aria-describedby="`${uid}-correo-ayuda`" @blur="touched.email = true" />
          <small v-if="touched.email && errors.email" :id="`${uid}-correo-ayuda`" class="field-error">{{ errors.email }}</small>
          <small v-else :id="`${uid}-correo-ayuda`" class="muted">Ahí enviaremos tu comprobante y podrás consultar tus compras.</small>
        </div>
      </div>
    </fieldset>
    <fieldset class="group">
      <legend>Método de pago</legend>
      <label v-for="method in METHODS" :key="method.value" class="method" :class="{ checked: form.method === method.value }">
        <input v-model="form.method" type="radio" name="metodo" :value="method.value" />
        <span><strong>{{ method.label }}</strong><small>{{ method.hint }}</small></span>
      </label>
      <p class="secure"><ShieldCheck :size="16" aria-hidden="true" /> Este sitio no recibe ni guarda datos de tarjeta.</p>
    </fieldset>
    <label class="terms">
      <input v-model="form.accepted" type="checkbox" @change="touched.accepted = true" />
      <span>Acepto los <RouterLink to="/legal/terminos" target="_blank">términos de uso</RouterLink> y el <RouterLink to="/legal/privacidad" target="_blank">aviso de privacidad</RouterLink>.</span>
    </label>
    <small v-if="touched.accepted && errors.accepted" class="field-error">{{ errors.accepted }}</small>
  </div>
</template>

<style scoped>
.payment { display: grid; gap: 18px; }
.group { margin: 0; padding: 18px; border: 1px solid var(--line); border-radius: var(--radius-l); background: #fff; }
.group legend { padding: 0 6px; font: 800 16px var(--font-title); }
.fields { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.wide { grid-column: 1 / -1; }
.method { margin-top: 10px; padding: 12px; display: flex; gap: 12px; align-items: flex-start; border: 1px solid var(--line-strong); border-radius: 12px; cursor: pointer; }
.method.checked { border-color: var(--blue); background: var(--accent-soft); box-shadow: 0 0 0 1px var(--blue); }
.method input { margin-top: 4px; accent-color: var(--blue); }
.method span { display: grid; }
.method small { color: var(--muted); }
.secure { margin-top: 12px; display: flex; align-items: center; gap: 6px; color: var(--success); font-size: 13px; }
.terms { display: flex; gap: 10px; align-items: flex-start; font-size: 14px; }
.terms input { margin-top: 3px; width: 18px; height: 18px; accent-color: var(--blue); }
@media (max-width: 560px) { .fields { grid-template-columns: minmax(0, 1fr); } }
</style>
