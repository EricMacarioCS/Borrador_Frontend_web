<script setup lang="ts">
import StateView from '@/shared/ui/StateView.vue'
import { usePromotions } from '@/app/queries'
import { formatDate } from '@/shared/lib/datetime'

const promotions = usePromotions()
</script>

<template>
  <div class="container page">
    <p class="eyebrow">Promociones</p>
    <h1 class="page-title">Ahorra en tu próxima función</h1>
    <p class="page-lead">Solo se aplica una promoción por compra. Las condiciones se revisan al calcular tu total.</p>
    <StateView :loading="promotions.isPending.value" :error="promotions.error.value" :empty="!promotions.data.value?.length" skeleton="cards" @retry="promotions.refetch()">
      <ul class="grid" role="list">
        <li v-for="promotion in promotions.data.value" :key="promotion.id" class="promo">
          <span class="tag">{{ promotion.tag }}</span>
          <h2>{{ promotion.title }}</h2>
          <p>{{ promotion.description }}</p>
          <p class="conditions">{{ promotion.conditions }}</p>
          <p class="valid">Vigente desde el {{ formatDate(promotion.validFrom, 'short') }}{{ promotion.validTo ? ` hasta el ${formatDate(promotion.validTo, 'short')}` : '' }}</p>
          <span v-if="!promotion.appliesOnline" class="badge">Solo en taquilla</span>
          <RouterLink v-else to="/cartelera" class="btn btn-small btn-dark">Elegir función</RouterLink>
        </li>
      </ul>
    </StateView>
  </div>
</template>

<style scoped>
.grid { margin-top: 24px; display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 18px; }
.promo { padding: 24px; display: grid; gap: 10px; align-content: start; justify-items: start; border-radius: var(--radius-l); background: radial-gradient(90% 80% at 100% 0%, rgba(124, 92, 255, .45), transparent 60%), var(--grad-blue); color: #fff; box-shadow: var(--shadow-card); transition: transform .3s var(--ease), box-shadow .3s; }
.promo:hover { transform: translateY(-4px); box-shadow: 0 0 0 1px var(--accent), 0 18px 40px rgba(23, 78, 166, .35); }
.tag { padding: 4px 10px; border-radius: 999px; background: var(--gold); color: #3a2600; font: 800 12px var(--font-title); text-transform: uppercase; letter-spacing: .08em; }
.promo h2 { font: 800 24px var(--font-title); }
.promo p { color: #e3ebf8; }
.conditions, .valid { font-size: 13px; }
</style>
