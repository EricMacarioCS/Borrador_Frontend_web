<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { ShoppingCart, Trash2 } from '@lucide/vue'
import BaseDialog from '@/shared/ui/BaseDialog.vue'
import QuantityStepper from '@/shared/ui/QuantityStepper.vue'
import { useCartStore } from '@/app/stores/cart'
import { useAppStore } from '@/app/stores/app'
import { formatMoney } from '@/shared/lib/money'

defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()
const cart = useCartStore()
const app = useAppStore()
const router = useRouter()
const complexName = computed(() => cart.complexId ? app.complexById(cart.complexId)?.name : null)

function checkout() {
  emit('close')
  void router.push('/dulceria/pago')
}
</script>

<template>
  <BaseDialog :open="open" label="Carrito de dulcería" side="right" @close="emit('close')">
    <template #header><h2>Tu carrito</h2></template>
    <div v-if="!cart.lines.length" class="empty">
      <ShoppingCart :size="40" aria-hidden="true" />
      <p>Tu carrito está vacío.</p>
      <RouterLink to="/dulceria" class="btn btn-secondary" @click="emit('close')">Ver dulcería</RouterLink>
    </div>
    <template v-else>
      <p class="where">Recoges en <strong>{{ complexName }}</strong></p>
      <ul class="lines" role="list">
        <li v-for="line in cart.lines" :key="line.key">
          <div class="info">
            <strong>{{ line.name }}</strong>
            <small v-if="line.detail">{{ line.detail }}</small>
            <span>{{ formatMoney(line.estimateCents * line.quantity) }}</span>
          </div>
          <div class="controls">
            <QuantityStepper :model-value="line.quantity" :label="line.name" :min="1" @update:model-value="cart.setQuantity(line.key, $event)" />
            <button type="button" class="remove" :aria-label="`Quitar ${line.name}`" @click="cart.setQuantity(line.key, 0)"><Trash2 :size="18" /></button>
          </div>
        </li>
      </ul>
      <p v-if="cart.needsTicketCode" class="notice">Para recoger alimentos necesitarás el folio de tus boletos de este complejo.</p>
    </template>
    <template v-if="cart.lines.length" #footer>
      <div class="total">
        <span>Total estimado</span>
        <strong>{{ formatMoney(cart.estimateCents) }}</strong>
      </div>
      <p class="muted small">El importe final se confirma antes de pagar.</p>
      <button type="button" class="btn btn-primary btn-block" @click="checkout">Continuar al pago</button>
    </template>
  </BaseDialog>
</template>

<style scoped>
.empty { padding: 40px 0; display: grid; justify-items: center; gap: 14px; color: var(--muted); }
.where { margin-bottom: 12px; color: var(--muted); }
.lines { display: grid; }
.lines li { padding: 14px 0; display: grid; gap: 10px; border-bottom: 1px solid var(--line); }
.info { display: grid; gap: 2px; }
.info small { color: var(--muted); }
.info span { font-weight: 700; }
.controls { display: flex; align-items: center; justify-content: space-between; }
.remove { width: 38px; height: 38px; display: grid; place-items: center; border: 0; border-radius: 10px; background: transparent; color: var(--danger); }
.remove:hover { background: var(--danger-soft); }
.notice { margin-top: 14px; }
.total { display: flex; justify-content: space-between; font: 800 18px var(--font-title); }
.small { margin: 4px 0 12px; font-size: 13px; }
</style>
