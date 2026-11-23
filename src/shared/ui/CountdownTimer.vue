<script setup lang="ts">
/** Contador basado en el reloj del servidor. Avisa a los lectores de pantalla solo en momentos clave. */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Clock } from '@lucide/vue'
import { serverNow } from '@/shared/lib/clock'

const props = defineProps<{ until: Date }>()
const emit = defineEmits<{ expired: [] }>()
const now = ref(serverNow())
let timer = 0

const seconds = computed(() => Math.max(0, Math.ceil((props.until.getTime() - now.value) / 1000)))
const text = computed(() => `${Math.floor(seconds.value / 60)}:${String(seconds.value % 60).padStart(2, '0')}`)
const announcement = computed(() => seconds.value === 60 ? 'Queda un minuto para completar tu compra.' : seconds.value === 0 ? 'Venció el tiempo de tu apartado.' : '')

function tick() { now.value = serverNow() }
onMounted(() => { timer = window.setInterval(tick, 1000) })
onBeforeUnmount(() => clearInterval(timer))
watch(seconds, value => { if (value === 0) emit('expired') })
</script>

<template>
  <div class="countdown" :class="{ urgent: seconds < 60 }">
    <Clock :size="18" aria-hidden="true" />
    <span><span class="visually-hidden">Tiempo restante: </span><time>{{ text }}</time></span>
    <span class="visually-hidden" aria-live="assertive">{{ announcement }}</span>
  </div>
</template>

<style scoped>
.countdown {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-radius: 999px;
  background: rgba(56, 189, 248, .14);
  color: #d5f3ff;
  font: 800 16px var(--font-title);
  font-variant-numeric: tabular-nums;
}
.urgent { background: rgba(239, 68, 68, .2); color: #ffd1d1; animation: pulse 1s ease-in-out infinite alternate; }
@keyframes pulse { to { box-shadow: 0 0 18px rgba(239, 68, 68, .55); } }
</style>
