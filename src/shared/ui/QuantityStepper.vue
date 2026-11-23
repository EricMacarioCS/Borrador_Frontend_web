<script setup lang="ts">
import { Minus, Plus } from '@lucide/vue'

const props = withDefaults(defineProps<{ label: string; min?: number; max?: number }>(), { min: 0, max: 10 })
const model = defineModel<number>({ required: true })
const change = (step: number) => { model.value = Math.min(props.max, Math.max(props.min, model.value + step)) }
</script>

<template>
  <div class="stepper" role="group" :aria-label="label">
    <button type="button" :disabled="model <= min" :aria-label="`Quitar uno: ${label}`" @click="change(-1)"><Minus :size="16" /></button>
    <output aria-live="polite">{{ model }}</output>
    <button type="button" :disabled="model >= max" :aria-label="`Agregar uno: ${label}`" @click="change(1)"><Plus :size="16" /></button>
  </div>
</template>

<style scoped>
.stepper { display: inline-flex; align-items: center; gap: 10px; }
.stepper button {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border: 1px solid var(--line-strong);
  border-radius: 50%;
  background: linear-gradient(180deg, #fff, #edf4ff);
  color: var(--blue);
  transition: box-shadow .2s, background .2s, color .2s;
}
.stepper button:hover:not(:disabled) { background: var(--grad-blue); color: #fff; box-shadow: 0 0 16px rgba(79, 140, 255, .5); }
.stepper button:disabled { opacity: .45; }
output { min-width: 22px; text-align: center; font: 700 16px var(--font-title); }
</style>
