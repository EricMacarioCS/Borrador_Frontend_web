<script setup lang="ts">
/**
 * Folio de boletos: se valida solo cuando el formato está completo, sin botón.
 * Espera 300 ms, cancela la validación anterior y respeta el límite de intentos del servidor.
 */
import { onBeforeUnmount, ref, watch } from 'vue'
import { CircleCheck, LoaderCircle, Ticket, X } from '@lucide/vue'
import { useServices } from '@/app/services'
import type { TicketCodeGrant } from '@/domain/models'
import { completeTicketCode } from '@/shared/lib/text'
import { toApiError } from '@/shared/lib/errors'
import { errorMessage } from '@/shared/lib/messages'
import { formatDateTime } from '@/shared/lib/datetime'

const props = defineProps<{ complexId: string; initial?: string | null; grant: TicketCodeGrant | null }>()
const emit = defineEmits<{ validated: [grant: TicketCodeGrant | null] }>()
const { checkout } = useServices()

const value = ref(props.initial ?? props.grant?.ticketCode ?? '')
const checking = ref(false)
const error = ref('')
let timer = 0
let run = 0

async function validate(code: string) {
  const current = ++run
  checking.value = true
  error.value = ''
  try {
    const grant = await checkout.validateTicketCode(code, props.complexId)
    if (current === run) emit('validated', grant)
  } catch (failure) {
    if (current !== run) return
    error.value = errorMessage(toApiError(failure))
    emit('validated', null)
  } finally {
    if (current === run) checking.value = false
  }
}

watch([value, () => props.complexId], ([text]) => {
  clearTimeout(timer)
  const code = completeTicketCode(text)
  if (props.grant && code === props.grant.ticketCode && props.grant.complexId === props.complexId) return
  if (props.grant) emit('validated', null)
  error.value = ''
  run++
  checking.value = false
  if (code) timer = window.setTimeout(() => void validate(code), 300)
}, { immediate: true })

onBeforeUnmount(() => clearTimeout(timer))

function clear() {
  value.value = ''
  emit('validated', null)
}
</script>

<template>
  <div class="code" :class="{ ok: grant, error: error }">
    <label class="field">
      <span>Folio de tus boletos</span>
      <span class="input-wrap">
        <Ticket :size="18" aria-hidden="true" />
        <input v-model="value" class="input" placeholder="CIN-XXXX-XXXX-XXXX" autocomplete="off" spellcheck="false" autocapitalize="characters"
          :aria-invalid="!!error" aria-describedby="folio-estado" />
        <LoaderCircle v-if="checking" :size="18" class="spin" aria-hidden="true" />
        <button v-else-if="value" type="button" class="clear" aria-label="Borrar folio" @click="clear"><X :size="16" /></button>
      </span>
    </label>
    <p id="folio-estado" class="status" aria-live="polite">
      <template v-if="checking">Validando folio…</template>
      <template v-else-if="grant"><CircleCheck :size="16" aria-hidden="true" /> <span>Boletos de <strong>{{ grant.movieTitle }}</strong>, {{ formatDateTime(grant.startsAt) }}</span></template>
      <template v-else-if="error">{{ error }}</template>
    </p>
  </div>
</template>

<style scoped>
.input-wrap { position: relative; display: flex; align-items: center; }
.input-wrap > svg:first-child { position: absolute; left: 14px; color: var(--blue); }
.input-wrap .input { padding-left: 42px; padding-right: 44px; font: 700 16px var(--font-title); letter-spacing: .04em; text-transform: uppercase; }
.spin, .clear { position: absolute; right: 12px; }
.spin { color: var(--blue); animation: spin 1s linear infinite; }
.clear { width: 28px; height: 28px; display: grid; place-items: center; border: 0; border-radius: 8px; background: transparent; color: var(--muted); }
.status { min-height: 22px; margin-top: 6px; display: flex; align-items: center; gap: 6px; font-size: 14px; }
.ok .status { color: var(--success); }
.ok .input { border-color: var(--success); }
.error .status { color: var(--danger); }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
