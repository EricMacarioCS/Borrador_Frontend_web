<script setup lang="ts">
/**
 * Arte provisional sin imágenes: degradado con el color de la película y su título.
 * Cuando existan carteles, `src` lo reemplaza sin cambiar el tamaño ni el diseño.
 */
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  title: string
  accent: string
  rating?: string
  src?: string | null
  variant?: 'poster' | 'wide'
  decorative?: boolean
}>(), { rating: undefined, src: null, variant: 'poster', decorative: false })

const initials = computed(() => props.title.split(/\s+/).filter(word => word.length > 2).slice(0, 2).map(word => word[0]).join('').toUpperCase())
</script>

<template>
  <div class="art" :class="variant" :style="{ '--art': accent }" :role="decorative ? undefined : 'img'" :aria-label="decorative ? undefined : `Cartel de ${title}`" :aria-hidden="decorative || undefined">
    <img v-if="src" :src="src" alt="" loading="lazy" />
    <template v-else>
      <span class="glow" />
      <span class="initials" aria-hidden="true">{{ initials }}</span>
      <span class="title" aria-hidden="true">{{ title }}</span>
    </template>
    <span v-if="rating" class="rating" aria-hidden="true">{{ rating }}</span>
  </div>
</template>

<style scoped>
.art {
  position: relative;
  overflow: hidden;
  isolation: isolate;
  border-radius: 10px;
  background:
    radial-gradient(120% 80% at 20% 10%, color-mix(in srgb, var(--art) 70%, transparent), transparent 60%),
    radial-gradient(90% 70% at 90% 100%, color-mix(in srgb, var(--art) 45%, #3b2cff), transparent 70%),
    linear-gradient(160deg, #142747, #060b1a);
  color: #fff;
}
.poster { aspect-ratio: 2 / 3; }
.wide { aspect-ratio: 16 / 9; }
img { width: 100%; height: 100%; object-fit: cover; }
.glow {
  position: absolute;
  inset: 18% 12%;
  border-radius: 50%;
  background: var(--art);
  filter: blur(42px);
  opacity: .35;
  z-index: -1;
}
.initials {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font: 800 clamp(40px, 9cqi, 120px) var(--font-title);
  color: color-mix(in srgb, var(--art) 40%, transparent);
  letter-spacing: -.04em;
}
.art { container-type: inline-size; }
.title {
  position: absolute;
  left: 8%;
  right: 8%;
  bottom: 9%;
  font: 800 clamp(8px, 11cqi, 30px)/1.05 var(--font-title);
  overflow-wrap: anywhere;
  text-transform: uppercase;
  text-shadow: 0 2px 12px rgba(0, 0, 0, .55);
}
.wide .title { font-size: clamp(16px, 6cqi, 42px); }
.rating {
  position: absolute;
  top: 8px;
  left: 8px;
  padding: 2px 7px;
  border-radius: 6px;
  background: rgba(255, 255, 255, .92);
  color: var(--ink);
  font: 800 12px var(--font-title);
}
</style>
