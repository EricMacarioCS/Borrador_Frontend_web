<script setup lang="ts">
/** Barra de cines: cada cine elegido en su propia burbuja, con botón para quitarlo. La preferencia se guarda en el navegador. */
import { MapPin, Plus, X } from '@lucide/vue'
import { useAppStore } from '@/app/stores/app'

const app = useAppStore()
</script>

<template>
  <div class="bar">
    <div class="container wide inner">
      <MapPin :size="18" aria-hidden="true" class="pin" />
      <template v-if="app.selectedComplexes.length">
        <span class="label city-label">Tus cines en <strong>{{ app.selectedCity }}</strong>:</span>
        <ul class="bubbles" role="list" aria-label="Cines elegidos">
          <li v-for="complex in app.selectedComplexes" :key="complex.id" class="bubble">
            <button type="button" class="name" aria-haspopup="dialog" :title="`Cambiar cines (${complex.name})`" @click="app.askForComplexes()">{{ complex.name }}</button>
            <button type="button" class="remove" :aria-label="`Quitar ${complex.name}`" @click="app.removeComplex(complex.id)"><X :size="14" /></button>
          </li>
        </ul>
        <button type="button" class="add" aria-haspopup="dialog" aria-label="Agregar o cambiar cines" @click="app.askForComplexes()"><Plus :size="16" /> <span class="add-text">Agregar o cambiar</span></button>
      </template>
      <template v-else>
        <span class="label">Elige un cine para ver horarios y comprar boletos.</span>
        <button type="button" class="add strong" aria-haspopup="dialog" @click="app.askForComplexes()"><Plus :size="16" /> Elegir cine</button>
      </template>
    </div>
  </div>
</template>

<style scoped>
.bar {
  background: radial-gradient(55% 240% at 85% 50%, rgba(56, 189, 248, .22), transparent 70%), linear-gradient(100deg, #0e1d40 0%, #15336a 55%, #134a74 100%);
  box-shadow: inset 0 -1px 0 rgba(123, 224, 255, .2);
  color: #fff;
}
.inner { min-height: 50px; padding-block: 7px; display: flex; flex-wrap: wrap; align-items: center; gap: 8px 10px; }
.pin { flex: none; color: var(--accent); }
.label { color: #cfe3ff; font-size: 14px; }
.label strong { color: #fff; }
.bubbles { display: flex; flex-wrap: wrap; gap: 8px; }
.bubble {
  display: inline-flex;
  align-items: center;
  border: 1px solid rgba(255, 255, 255, .42);
  border-radius: 999px;
  background: linear-gradient(180deg, rgba(255, 255, 255, .22), rgba(255, 255, 255, .06));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, .25);
  transition: box-shadow .2s, background .2s;
}
.bubble:hover { background: rgba(255, 255, 255, .2); box-shadow: 0 0 16px rgba(56, 189, 248, .45), inset 0 1px 0 rgba(255, 255, 255, .25); }
.name { padding: 5px 4px 5px 14px; border: 0; background: none; color: #fff; font: 700 14px var(--font-title); white-space: nowrap; }
.remove { width: 28px; height: 28px; margin-right: 2px; display: grid; place-items: center; border: 0; border-radius: 50%; background: transparent; color: #cfe3ff; }
.remove:hover { background: rgba(255, 255, 255, .22); color: #fff; }
.add {
  padding: 5px 12px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: 1px dashed rgba(255, 255, 255, .55);
  border-radius: 999px;
  background: transparent;
  color: #fff;
  font: 700 13px var(--font-title);
  white-space: nowrap;
}
.add:hover { border-style: solid; background: rgba(255, 255, 255, .14); }
.add.strong { border: 0; background: var(--grad-action); color: #06142f; box-shadow: 0 0 16px rgba(56, 189, 248, .4); }
@media (max-width: 720px) {
  /* En celular las burbujas se desplazan en una sola línea para no crecer la barra. */
  .inner { flex-wrap: nowrap; }
  .city-label { display: none; }
  .label { font-size: 13px; }
  .bubbles { flex-wrap: nowrap; min-width: 0; overflow-x: auto; scrollbar-width: none; }
  .bubbles::-webkit-scrollbar { display: none; }
  .add { flex: none; }
  .add:not(.strong) { width: 34px; height: 34px; padding: 0; justify-content: center; }
  .add:not(.strong) .add-text { display: none; }
}
@media (max-width: 720px) and (pointer: coarse) { .remove { width: 32px; height: 32px; } }
</style>
