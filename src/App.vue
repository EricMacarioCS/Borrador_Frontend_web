<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import AppHeader from '@/app/layout/AppHeader.vue'
import AppFooter from '@/app/layout/AppFooter.vue'
import FeedbackHost from '@/app/layout/FeedbackHost.vue'
import ComplexPicker from '@/app/layout/ComplexPicker.vue'
import { useConfig } from '@/app/services'

const route = useRoute()
const config = useConfig()
const focused = computed(() => route.meta.focused === true)
</script>

<template>
  <a class="skip-link" href="#contenido">Saltar al contenido</a>
  <div v-if="config.apiMode === 'mock'" class="demo-bar" role="note">
    Ambiente de demostración: datos simulados, sin cobros reales.
  </div>
  <AppHeader v-if="!focused" />
  <main id="contenido" tabindex="-1">
    <RouterView v-slot="{ Component, route: current }">
      <Transition name="page" mode="out-in">
        <component :is="Component" :key="current.path" />
      </Transition>
    </RouterView>
  </main>
  <AppFooter v-if="!focused" />
  <ComplexPicker />
  <FeedbackHost />
</template>

<style scoped>
main { min-height: 60dvh; outline: none; }
.demo-bar {
  padding: 6px var(--page-gutter);
  background: linear-gradient(90deg, #ffc93c, #ffb02e);
  color: #3a2600;
  font: 700 12px var(--font-title);
  text-align: center;
}
.page-enter-active, .page-leave-active { transition: opacity .18s ease, transform .25s var(--ease); }
.page-enter-from { opacity: 0; transform: translateY(8px); }
.page-leave-to { opacity: 0; }
</style>
