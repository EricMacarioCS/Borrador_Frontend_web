<script setup lang="ts">
import StateView from '@/shared/ui/StateView.vue'
import { useFaq } from '@/app/queries'

const faq = useFaq()
</script>

<template>
  <div class="container page narrow">
    <p class="eyebrow">Ayuda</p>
    <h1 class="page-title">Preguntas frecuentes</h1>
    <StateView :loading="faq.isPending.value" :error="faq.error.value" :empty="!faq.data.value?.length" skeleton="rows" @retry="faq.refetch()">
      <div class="list">
        <details v-for="item in faq.data.value" :key="item.question" class="item">
          <summary>{{ item.question }}</summary>
          <p>{{ item.answer }}</p>
        </details>
      </div>
    </StateView>
    <p class="muted more">¿No encontraste tu respuesta? Consulta <RouterLink to="/legal/contacto">contacto</RouterLink>.</p>
  </div>
</template>

<style scoped>
.narrow { max-width: 860px; }
.list { margin-top: 22px; display: grid; gap: 10px; }
.item { border: 1px solid var(--line); border-radius: var(--radius-m); background: #fff; }
.item summary { padding: 16px 18px; font: 700 16px var(--font-title); cursor: pointer; }
.item summary:hover { color: var(--blue); }
.item[open] { box-shadow: 0 0 0 1px var(--accent); }
.item p { padding: 0 18px 16px; color: var(--muted); }
.more { margin-top: 20px; }
</style>
