<script setup lang="ts">
import { watch } from 'vue'
import StateView from '@/shared/ui/StateView.vue'
import { usePage } from '@/app/queries'

const props = defineProps<{ slug: string }>()
const page = usePage(() => props.slug)
watch(() => page.data.value?.title, title => { if (title) document.title = `${title} · Cinépolis` })
</script>

<template>
  <div class="container page narrow">
    <StateView :loading="page.isPending.value" :error="page.error.value" skeleton="rows" @retry="page.refetch()">
      <template v-if="page.data.value">
        <h1 class="page-title">{{ page.data.value.title }}</h1>
        <p v-for="(paragraph, index) in page.data.value.paragraphs" :key="index" class="paragraph">{{ paragraph }}</p>
      </template>
    </StateView>
  </div>
</template>

<style scoped>
.narrow { max-width: 820px; }
.paragraph { margin-top: 14px; color: var(--muted); font-size: 17px; }
</style>
