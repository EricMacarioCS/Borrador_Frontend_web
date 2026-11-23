<script setup lang="ts">
/** Buscador en ventana para pantallas angostas. Usa el mismo componente que el encabezado. */
import BaseDialog from '@/shared/ui/BaseDialog.vue'
import SearchBox from './SearchBox.vue'

defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <BaseDialog :open="open" label="Buscar películas o cines" @close="emit('close')">
    <template #header><h2>Buscar</h2></template>
    <SearchBox v-if="open" mode="panel" @done="emit('close')" />
  </BaseDialog>
</template>
