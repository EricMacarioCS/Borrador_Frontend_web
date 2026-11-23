<script setup lang="ts">
/** Barra de complejos: elige uno o varios cines. La preferencia se guarda en el navegador. */
import { computed, ref, watch } from 'vue'
import { MapPin } from '@lucide/vue'
import BaseDialog from '@/shared/ui/BaseDialog.vue'
import { useAppStore } from '@/app/stores/app'

const app = useAppStore()
const open = ref(false)
const draft = ref<string[]>([])

const cities = computed(() => {
  const groups = new Map<string, typeof app.complexes>()
  for (const complex of app.complexes) groups.set(complex.city, [...(groups.get(complex.city) ?? []), complex])
  return [...groups]
})
const summary = computed(() => {
  const [first, ...rest] = app.selectedComplexes
  return first ? `${first.name}${rest.length ? ` y ${rest.length} más` : ''}` : 'Elige tu cine'
})

watch(open, value => { if (value) draft.value = [...app.selectedComplexIds] })

function toggle(id: string, checked: boolean) {
  draft.value = checked ? [...draft.value, id] : draft.value.filter(item => item !== id)
}
function apply() {
  if (!draft.value.length) return
  app.selectComplexes(draft.value)
  open.value = false
}
</script>

<template>
  <div class="bar">
    <div class="container inner">
      <MapPin :size="18" aria-hidden="true" />
      <span class="label">Tus cines:</span>
      <button type="button" class="picker" aria-haspopup="dialog" @click="open = true">{{ summary }}</button>
    </div>
  </div>

  <BaseDialog :open="open" label="Elige tus cines" @close="open = false">
    <template #header><h2>Elige tus cines</h2></template>
    <p class="help">Puedes elegir varios complejos para comparar horarios.</p>
    <fieldset v-for="[city, list] in cities" :key="city" class="city">
      <legend>{{ city }}</legend>
      <label v-for="complex in list" :key="complex.id" class="option">
        <input type="checkbox" :checked="draft.includes(complex.id)" @change="toggle(complex.id, ($event.target as HTMLInputElement).checked)" />
        <span>
          <strong>{{ complex.name }}</strong>
          <small v-if="complex.kind === 'vip'">Salas VIP</small>
        </span>
      </label>
    </fieldset>
    <template #footer>
      <div class="footer">
        <span class="muted">{{ draft.length }} seleccionados</span>
        <button type="button" class="btn btn-primary" :disabled="!draft.length" @click="apply">Aplicar</button>
      </div>
    </template>
  </BaseDialog>
</template>

<style scoped>
.bar {
  background: radial-gradient(60% 240% at 85% 50%, rgba(124, 92, 255, .38), transparent 70%), linear-gradient(100deg, #0f3478 0%, #174ea6 45%, #1d62c4 100%);
  color: #fff;
}
.inner { min-height: 46px; display: flex; align-items: center; gap: 8px; }
.label { font-size: 14px; color: #cfe3ff; }
.picker {
  min-width: 0;
  padding: 6px 12px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, .4);
  border-radius: 999px;
  background: rgba(255, 255, 255, .1);
  color: #fff;
  font: 700 14px var(--font-title);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.picker:hover { background: rgba(255, 255, 255, .2); box-shadow: 0 0 16px rgba(56, 189, 248, .45); }
.help { color: var(--muted); margin-bottom: 12px; }
.city { margin: 0 0 14px; padding: 0; border: 0; }
.city legend { margin-bottom: 6px; color: var(--blue); font: 700 13px var(--font-title); text-transform: uppercase; letter-spacing: .08em; }
.option { display: flex; align-items: center; gap: 12px; padding: 10px 8px; border-bottom: 1px solid var(--line); cursor: pointer; }
.option input { width: 18px; height: 18px; accent-color: var(--blue); }
.option span { display: grid; }
.option small { color: var(--muted); }
.footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
</style>
