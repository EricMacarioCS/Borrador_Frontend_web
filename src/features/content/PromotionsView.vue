<script setup lang="ts">
import { CalendarDays, CreditCard, Store } from '@lucide/vue'
import StateView from '@/shared/ui/StateView.vue'
import { usePromotions } from '@/app/queries'
import { formatDate } from '@/shared/lib/datetime'
import type { Promotion } from '@/domain/models'

const promotions = usePromotions()

/** Acento por tipo de promoción. Un tipo nuevo del catálogo usa el cian. */
const ACCENTS: Record<string, string> = { Martes: 'cyan', Formato: 'violet', Familia: 'gold', Banco: 'green' }
const accent = (promotion: Promotion) => ACCENTS[promotion.tag] ?? 'cyan'
/** Cifra del beneficio (2×1, 20 %) tal como viene en el texto de la promoción, si la trae. */
const figure = (promotion: Promotion) => `${promotion.title} ${promotion.description}`.match(/\d+\s?×\s?\d+|\d+\s?%/)?.[0] ?? null
</script>

<template>
  <div class="container page">
    <p class="eyebrow">Promociones</p>
    <h1 class="page-title">Ahorra en tu próxima función</h1>
    <p class="page-lead">Solo se aplica una promoción por compra. Las condiciones se revisan al calcular tu total.</p>
    <StateView :loading="promotions.isPending.value" :error="promotions.error.value" :empty="!promotions.data.value?.length" skeleton="cards" @retry="promotions.refetch()">
      <ul class="grid" role="list">
        <li v-for="promotion in promotions.data.value" :key="promotion.id" class="promo" :class="`accent-${accent(promotion)}`">
          <span class="tag">{{ promotion.tag }}</span>
          <h2>{{ promotion.title }}</h2>
          <div class="benefit">
            <strong v-if="figure(promotion)" class="figure" aria-hidden="true">{{ figure(promotion) }}</strong>
            <CreditCard v-else class="figure-icon" :size="44" :stroke-width="1.6" aria-hidden="true" />
            <p>{{ promotion.description }}</p>
          </div>
          <p class="conditions">{{ promotion.conditions }}</p>
          <p class="valid">
            <CalendarDays :size="15" aria-hidden="true" />
            Vigente desde el {{ formatDate(promotion.validFrom, 'short') }}{{ promotion.validTo ? ` hasta el ${formatDate(promotion.validTo, 'short')}` : '' }}
          </p>
          <div class="action">
            <RouterLink v-if="promotion.appliesOnline" to="/cartelera" class="btn btn-primary btn-block">Elegir función</RouterLink>
            <p v-else class="box-office"><Store :size="16" aria-hidden="true" /> Solo en taquilla</p>
          </div>
        </li>
      </ul>
    </StateView>
  </div>
</template>

<style scoped>
.grid { margin-top: 36px; display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 330px), 1fr)); gap: 26px; }
/* `--tint` pinta la luz y los bordes; `--deep` es la versión con contraste suficiente para texto. */
.promo {
  --tint: 56, 189, 248;
  --deep: #075985;
  position: relative;
  overflow: hidden;
  padding: 28px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 14px;
  border: 1px solid rgba(var(--tint), .35);
  border-radius: var(--radius-l);
  background: radial-gradient(90% 55% at 100% 0%, rgba(var(--tint), .2), transparent 70%), var(--glass-strong);
  box-shadow: var(--shadow-card);
  transition: transform .35s var(--ease), box-shadow .35s, border-color .35s;
}
.promo::before { content: ''; position: absolute; inset: 0 0 auto; height: 5px; background: linear-gradient(90deg, rgb(var(--tint)), rgba(var(--tint), .15)); }
.promo:hover, .promo:focus-within { transform: translateY(-4px); border-color: rgba(var(--tint), .75); box-shadow: 0 28px 52px -24px rgba(var(--tint), .75); }
.accent-violet { --tint: 124, 92, 255; --deep: #4c2fc4; }
.accent-gold { --tint: 245, 170, 20; --deep: #8a4b00; }
.accent-green { --tint: 16, 160, 120; --deep: #046249; }
.tag { padding: 5px 12px; border: 1px solid rgba(var(--tint), .45); border-radius: var(--radius-pill); background: rgba(var(--tint), .13); color: var(--deep); font: 800 11px var(--font-title); text-transform: uppercase; letter-spacing: .1em; }
.promo h2 { font: 800 24px var(--font-title); letter-spacing: -.02em; }
.benefit { align-self: stretch; padding: 22px; display: grid; justify-items: start; gap: 10px; border: 1px solid rgba(var(--tint), .45); border-radius: var(--radius-m); background: radial-gradient(90% 130% at 100% 0%, rgba(var(--tint), .45), transparent 65%), linear-gradient(145deg, #142a55, #0b1530); color: #fff; }
.figure { font: 800 clamp(48px, 4.4vw, 64px)/1 var(--font-title); letter-spacing: -.04em; text-shadow: 0 0 26px rgba(var(--tint), .85); }
.figure-icon { height: clamp(48px, 4.4vw, 64px); color: #fff; filter: drop-shadow(0 0 14px rgba(var(--tint), .9)); }
.benefit p { color: #e4edfb; font-weight: 600; line-height: 1.45; }
.conditions { color: #44536d; font-size: 13px; line-height: 1.6; }
.valid { margin-top: auto; padding-top: 14px; align-self: stretch; display: flex; align-items: center; gap: 7px; border-top: 1px solid var(--line); color: #44536d; font-size: 13px; }
.valid svg { flex: none; color: var(--deep); }
.action { align-self: stretch; }
.box-office { min-height: 46px; display: flex; align-items: center; justify-content: center; gap: 8px; border: 1px dashed rgba(var(--tint), .65); border-radius: var(--radius-m); color: var(--deep); font: 700 14px var(--font-title); }
</style>
