<script setup lang="ts">
import { Check, CircleAlert, Info, X } from '@lucide/vue'
import BaseDialog from '@/shared/ui/BaseDialog.vue'
import { answerConfirm, confirmState, dismissToast, toasts } from '@/shared/composables/feedback'
</script>

<template>
  <div class="toasts" aria-live="polite">
    <TransitionGroup name="toast">
      <div v-for="item in toasts" :key="item.id" class="toast" :class="item.tone" :role="item.tone === 'error' ? 'alert' : 'status'">
        <span class="icon"><CircleAlert v-if="item.tone === 'error'" :size="16" /><Info v-else-if="item.tone === 'info'" :size="16" /><Check v-else :size="16" /></span>
        <span class="text">{{ item.text }}</span>
        <button type="button" aria-label="Cerrar aviso" @click="dismissToast(item.id)"><X :size="16" /></button>
      </div>
    </TransitionGroup>
  </div>

  <BaseDialog :open="!!confirmState.request" :label="confirmState.request?.title ?? 'Confirmar'" size="small" @close="answerConfirm(false)">
    <template #header><h2>{{ confirmState.request?.title }}</h2></template>
    <p class="confirm-text">{{ confirmState.request?.text }}</p>
    <template #footer>
      <div class="confirm-actions">
        <button type="button" class="btn btn-ghost" @click="answerConfirm(false)">{{ confirmState.request?.cancelLabel ?? 'Volver' }}</button>
        <button type="button" class="btn" :class="confirmState.request?.danger ? 'btn-secondary danger' : 'btn-primary'" autofocus @click="answerConfirm(true)">
          {{ confirmState.request?.confirmLabel }}
        </button>
      </div>
    </template>
  </BaseDialog>
</template>

<style scoped>
.toasts { position: fixed; right: 20px; bottom: 20px; z-index: 3000; display: grid; gap: 10px; width: min(420px, calc(100vw - 40px)); }
.toast {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 12px 12px 14px;
  border: 1px solid rgba(56, 189, 248, .35);
  border-radius: 14px;
  background: var(--grad-menu);
  color: #fff;
  box-shadow: var(--shadow-float);
}
.icon { width: 28px; height: 28px; flex-shrink: 0; display: grid; place-items: center; border-radius: 50%; background: var(--grad-action); color: #06142f; }
.error .icon { background: #ef4444; color: #fff; }
.text { flex: 1; font-size: 14px; }
.toast button { width: 32px; height: 32px; display: grid; place-items: center; border: 0; border-radius: 8px; background: transparent; color: #b8c7dd; }
.toast button:hover { background: rgba(255, 255, 255, .1); color: #fff; }
.toast-enter-active, .toast-leave-active { transition: opacity .25s, transform .3s var(--ease); }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateY(14px); }
.confirm-text { color: var(--muted); }
.confirm-actions { display: flex; justify-content: flex-end; flex-wrap: wrap; gap: 10px; }
.danger { color: var(--danger); border-color: #f1b4ae; }
</style>
