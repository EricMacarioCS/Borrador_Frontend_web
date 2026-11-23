<script setup lang="ts">
/**
 * Ventana basada en <dialog>: el navegador da foco atrapado, Esc y fondo inerte.
 * `side` la convierte en panel lateral (carrito, menú).
 */
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { X } from '@lucide/vue'

const props = withDefaults(defineProps<{
  open: boolean
  label: string
  side?: 'center' | 'right' | 'left'
  size?: 'small' | 'medium' | 'large'
  closeOnBackdrop?: boolean
  hideClose?: boolean
}>(), { side: 'center', size: 'medium', closeOnBackdrop: true, hideClose: false })

const emit = defineEmits<{ close: [] }>()
const dialog = ref<HTMLDialogElement>()
let opener: HTMLElement | null = null

function sync(open: boolean) {
  const element = dialog.value
  if (!element) return
  if (open && !element.open) {
    opener = document.activeElement as HTMLElement | null
    element.showModal()
    document.documentElement.style.overflow = 'hidden'
    void nextTick(() => element.querySelector<HTMLElement>('[autofocus], .dialog-body :is(input, button, select, textarea, [tabindex="0"])')?.focus())
  } else if (!open && element.open) {
    element.close()
  }
}

function onClosed() {
  document.documentElement.style.overflow = ''
  if (opener?.isConnected) opener.focus()
  if (props.open) emit('close')
}

function onCancel(event: Event) {
  event.preventDefault()
  emit('close')
}

function onClick(event: MouseEvent) {
  if (props.closeOnBackdrop && event.target === dialog.value) emit('close')
}

onMounted(() => sync(props.open))
watch(() => props.open, sync)
onBeforeUnmount(() => {
  if (dialog.value?.open) {
    dialog.value.close()
    document.documentElement.style.overflow = ''
  }
})
</script>

<template>
  <dialog ref="dialog" class="dialog" :class="[`dialog-${side}`, `dialog-${size}`]" :aria-label="label"
    @cancel="onCancel" @close="onClosed" @click="onClick">
    <div class="dialog-panel">
      <header v-if="$slots.header || !hideClose" class="dialog-header">
        <slot name="header" />
        <button v-if="!hideClose" type="button" class="dialog-close" aria-label="Cerrar" @click="emit('close')"><X :size="22" /></button>
      </header>
      <div class="dialog-body"><slot /></div>
      <footer v-if="$slots.footer" class="dialog-footer"><slot name="footer" /></footer>
    </div>
  </dialog>
</template>

<style scoped>
.dialog {
  max-width: none;
  max-height: none;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ink);
}
.dialog::backdrop { background: rgba(3, 8, 22, .62); backdrop-filter: blur(4px); }
.dialog[open] { animation: dialog-in .28s var(--ease); }
.dialog-panel {
  display: flex;
  flex-direction: column;
  max-height: inherit;
  overflow: hidden;
  background: var(--surface);
  box-shadow: var(--shadow-float);
}
.dialog-center { width: min(calc(100vw - 24px), 640px); max-height: min(92dvh, 900px); margin: auto; }
.dialog-center.dialog-small { width: min(calc(100vw - 24px), 440px); }
.dialog-center.dialog-large { width: min(calc(100vw - 24px), 980px); }
.dialog-center .dialog-panel { border-radius: var(--radius-l); }
.dialog-right, .dialog-left { width: min(100vw, 440px); height: 100dvh; max-height: 100dvh; margin: 0; }
.dialog-right { margin-left: auto; }
.dialog-right .dialog-panel, .dialog-left .dialog-panel { height: 100%; }
.dialog-right[open] { animation: slide-in-right .3s var(--ease); }
.dialog-left[open] { animation: slide-in-left .3s var(--ease); }
.dialog-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 18px 20px;
  border-bottom: 1px solid var(--line);
}
.dialog-header :slotted(h2) { flex: 1; font: 800 20px var(--font-title); }
.dialog-close {
  margin-left: auto;
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: 10px;
  background: var(--surface-soft);
  color: var(--ink);
}
.dialog-close:hover { background: var(--grad-action); box-shadow: 0 0 18px var(--glow); }
.dialog-body { flex: 1; min-height: 0; overflow-y: auto; padding: 20px; }
.dialog-footer { padding: 16px 20px; border-top: 1px solid var(--line); background: var(--surface-soft); }
@keyframes dialog-in { from { opacity: 0; transform: translateY(14px) scale(.98); } }
@keyframes slide-in-right { from { transform: translateX(100%); } }
@keyframes slide-in-left { from { transform: translateX(-100%); } }
</style>
