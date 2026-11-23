<script setup lang="ts">
import { computed } from 'vue'
import { QR_SIZE, qrPath } from '@/shared/lib/qr'

const props = defineProps<{ value: string; label: string }>()
const path = computed(() => qrPath(props.value))
const box = QR_SIZE + 8
</script>

<template>
  <svg class="qr" :viewBox="`0 0 ${box} ${box}`" role="img" :aria-label="label" shape-rendering="crispEdges">
    <rect :width="box" :height="box" fill="#fff" />
    <path :d="path" fill="#000" />
  </svg>
</template>

<style scoped>
.qr { width: 100%; height: auto; aspect-ratio: 1; border-radius: 8px; }
</style>
