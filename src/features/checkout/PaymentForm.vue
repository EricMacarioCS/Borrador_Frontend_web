<script setup lang="ts">
/**
 * Datos del comprador y método de pago. Nunca se piden datos de tarjeta aquí:
 * con la pasarela real, el pago ocurre en la página o el marco del proveedor.
 */
import { computed, nextTick, reactive, ref, useId } from 'vue'
import { FlaskConical, ShieldCheck } from '@lucide/vue'
import type { Customer } from '@/domain/models'
import { useConfig } from '@/app/services'

const props = defineProps<{ initialEmail: string | null }>()
const config = useConfig()
const uid = useId()
const root = ref<HTMLElement>()
const isMock = config.apiMode === 'mock'
const form = reactive({ firstName: '', lastName: '', email: props.initialEmail ?? '', method: isMock ? 'simulated-approve' : 'card', accepted: false })
const touched = reactive({ firstName: false, lastName: false, email: false, accepted: false })

const errors = computed(() => ({
  firstName: form.firstName.trim().length < 2 ? 'Escribe tu nombre.' : '',
  lastName: form.lastName.trim().length < 2 ? 'Escribe tu apellido.' : '',
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()) ? '' : 'Escribe un correo válido.',
  accepted: form.accepted ? '' : 'Acepta los términos para continuar.'
}))
const valid = computed(() => Object.values(errors.value).every(value => !value))

// Los resultados de prueba solo existen en el simulador; con el API real nunca se muestran.
const TEST_OUTCOMES = [
  { value: 'simulated-approve', label: 'Aprobar el pago', hint: 'La compra se confirma en unos segundos.' },
  { value: 'simulated-decline', label: 'Rechazar el pago', hint: 'Sirve para probar qué pasa con un pago rechazado.' }
]
const METHODS = [{ value: 'card', label: 'Tarjeta de crédito o débito', hint: 'Continuarás en la página segura del proveedor de pagos.' }]

/** Marca todo como tocado, lleva al primer campo con error y devuelve los datos si son válidos. */
function submit(): { customer: Customer; method: string } | null {
  if (!config.features.onlinePayments) return null
  Object.keys(touched).forEach(key => { touched[key as keyof typeof touched] = true })
  if (!valid.value) {
    void nextTick(() => root.value?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
    return null
  }
  return { customer: { firstName: form.firstName.trim(), lastName: form.lastName.trim(), email: form.email.trim() }, method: form.method }
}

defineExpose({ submit, valid })
</script>

<template>
  <div ref="root" class="payment">
    <p v-if="!config.features.onlinePayments" class="notice notice-warning" role="status">
      Los pagos en línea están suspendidos por el momento. Tus asientos siguen apartados mientras dure el tiempo; también puedes comprar en taquilla.
    </p>
    <p class="required-note">Todos los campos son obligatorios <span class="required" aria-hidden="true">*</span></p>
    <fieldset class="group">
      <legend>Tus datos</legend>
      <div class="fields">
        <div class="field">
          <label :for="`${uid}-nombre`">Nombre <span class="required" aria-hidden="true">*</span></label>
          <input :id="`${uid}-nombre`" v-model="form.firstName" class="input" autocomplete="given-name" required
            :aria-invalid="touched.firstName && !!errors.firstName" :aria-describedby="`${uid}-nombre-error`" @blur="touched.firstName = true" />
          <small :id="`${uid}-nombre-error`" class="field-error">{{ touched.firstName ? errors.firstName : '' }}</small>
        </div>
        <div class="field">
          <label :for="`${uid}-apellido`">Apellido <span class="required" aria-hidden="true">*</span></label>
          <input :id="`${uid}-apellido`" v-model="form.lastName" class="input" autocomplete="family-name" required
            :aria-invalid="touched.lastName && !!errors.lastName" :aria-describedby="`${uid}-apellido-error`" @blur="touched.lastName = true" />
          <small :id="`${uid}-apellido-error`" class="field-error">{{ touched.lastName ? errors.lastName : '' }}</small>
        </div>
        <div class="field wide">
          <label :for="`${uid}-correo`">Correo electrónico <span class="required" aria-hidden="true">*</span></label>
          <input :id="`${uid}-correo`" v-model="form.email" class="input" type="email" autocomplete="email" inputmode="email" required
            :aria-invalid="touched.email && !!errors.email" :aria-describedby="`${uid}-correo-ayuda`" @blur="touched.email = true" />
          <small v-if="touched.email && errors.email" :id="`${uid}-correo-ayuda`" class="field-error">{{ errors.email }}</small>
          <small v-else :id="`${uid}-correo-ayuda`" class="muted">Ahí enviaremos tu comprobante y podrás consultar tus compras.</small>
        </div>
      </div>
    </fieldset>
    <fieldset v-if="!isMock" class="group">
      <legend>Método de pago</legend>
      <label v-for="method in METHODS" :key="method.value" class="method" :class="{ checked: form.method === method.value }">
        <input v-model="form.method" type="radio" :name="`${uid}-metodo`" :value="method.value" />
        <span><strong>{{ method.label }}</strong><small>{{ method.hint }}</small></span>
      </label>
      <p class="secure"><ShieldCheck :size="16" aria-hidden="true" /> Este sitio no recibe ni guarda datos de tarjeta.</p>
    </fieldset>
    <div class="terms-block">
      <label class="terms">
        <input v-model="form.accepted" type="checkbox" required :aria-invalid="touched.accepted && !!errors.accepted"
          :aria-describedby="`${uid}-terminos-error`" @change="touched.accepted = true" @blur="touched.accepted = true" />
        <span>Acepto los <RouterLink to="/legal/terminos" target="_blank">términos de uso</RouterLink> y el <RouterLink to="/legal/privacidad" target="_blank">aviso de privacidad</RouterLink>. <span class="required" aria-hidden="true">*</span></span>
      </label>
      <small :id="`${uid}-terminos-error`" class="field-error">{{ touched.accepted ? errors.accepted : '' }}</small>
    </div>
    <fieldset v-if="isMock" class="test-mode">
      <legend><FlaskConical :size="14" aria-hidden="true" /> Modo de prueba: elige el resultado del pago</legend>
      <p class="test-help">Este bloque solo existe en la demostración. No se pide tarjeta ni se hacen cobros.</p>
      <div class="outcomes">
        <label v-for="outcome in TEST_OUTCOMES" :key="outcome.value" class="outcome" :class="{ checked: form.method === outcome.value }">
          <input v-model="form.method" type="radio" :name="`${uid}-metodo`" :value="outcome.value" />
          <span><strong>{{ outcome.label }}</strong><small>{{ outcome.hint }}</small></span>
        </label>
      </div>
    </fieldset>
  </div>
</template>

<style scoped>
.payment { display: grid; gap: 18px; }
.required-note { color: var(--muted); font-size: 13px; }
.required { color: var(--danger); font-weight: 700; }
.group { min-width: 0; margin: 0; padding: 18px; border: 1px solid var(--line); border-radius: var(--radius-l); background: var(--glass-strong); }
.group legend { padding: 0 6px; font: 800 16px var(--font-title); }
.fields { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.wide { grid-column: 1 / -1; }
.method { margin-top: 10px; padding: 12px; display: flex; gap: 12px; align-items: flex-start; border: 1px solid var(--line-strong); border-radius: 12px; cursor: pointer; }
.method.checked { border-color: var(--blue); background: var(--accent-soft); box-shadow: 0 0 0 1px var(--blue); }
.method input { margin-top: 4px; accent-color: var(--blue); }
.method span { display: grid; }
.method small { color: var(--muted); }
.terms-block { display: grid; gap: 6px; }
.terms input[aria-invalid='true'] { outline: 2px solid var(--danger); outline-offset: 1px; }
/* Aspecto de herramienta de desarrollo, para que no se confunda con un método de pago. */
.test-mode { min-width: 0; margin: 8px 0 0; padding: 14px 16px 16px; border: 2px dashed #8a97ad; border-radius: var(--radius-m); background: repeating-linear-gradient(135deg, #eef1f6 0 10px, #f4f6fa 10px 20px); font-family: ui-monospace, 'Cascadia Code', Consolas, monospace; }
.test-mode legend { padding: 4px 10px; display: inline-flex; align-items: center; gap: 6px; border-radius: 6px; background: #26324a; color: #ffd866; font-size: 12px; font-weight: 700; }
.test-help { color: #44516b; font-size: 12px; }
.outcomes { margin-top: 10px; display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 8px; }
.outcome { padding: 10px 12px; display: flex; gap: 10px; align-items: flex-start; border: 1px solid #b8c1d1; border-radius: 8px; background: #fff; cursor: pointer; }
.outcome.checked { border-color: #26324a; box-shadow: 0 0 0 1px #26324a; }
.outcome input { margin-top: 3px; accent-color: #26324a; }
.outcome span { display: grid; gap: 2px; }
.outcome strong { font-size: 13px; }
.outcome small { color: #44516b; font-size: 12px; }
.secure { margin-top: 12px; display: flex; align-items: center; gap: 6px; color: var(--success); font-size: 13px; }
.terms { display: flex; gap: 10px; align-items: flex-start; font-size: 14px; }
.terms input { margin-top: 3px; width: 18px; height: 18px; accent-color: var(--blue); }
@media (max-width: 560px) { .fields { grid-template-columns: minmax(0, 1fr); } }
</style>
