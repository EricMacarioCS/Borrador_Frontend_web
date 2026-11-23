<script setup lang="ts">
import { computed } from 'vue'
import { occupancyPercent, occupancyTone } from '@/domain/occupancy'

const props = defineProps<{ unavailable: number; capacity: number; mini?: boolean }>()
const percent = computed(() => occupancyPercent(props.unavailable, props.capacity))
</script>

<template>
  <span class="ring" :class="[`tone-${occupancyTone(percent)}`, { mini }]" :style="{ '--fill': percent }" role="img"
    :aria-label="`${percent}% de asientos ocupados`">
    <b v-if="!mini" aria-hidden="true">{{ percent }}%</b>
  </span>
</template>

<style scoped>
.ring {
  --tone: var(--occ-low);
  position: relative;
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: conic-gradient(var(--tone) calc(var(--fill) * 1%), #e2e9f4 0);
  box-shadow: 0 0 12px color-mix(in srgb, var(--tone) 45%, transparent);
}
.ring::after { content: ''; position: absolute; inset: 5px; border-radius: 50%; background: #fff; }
.ring b { position: relative; z-index: 1; color: var(--ink); font: 700 10px var(--font-title); }
.mini { width: 14px; height: 14px; box-shadow: none; }
.mini::after { inset: 3px; }
.tone-low { --tone: var(--occ-low); }
.tone-medium { --tone: var(--occ-medium); }
.tone-high { --tone: var(--occ-high); }
.tone-full { --tone: var(--occ-full); }
</style>
