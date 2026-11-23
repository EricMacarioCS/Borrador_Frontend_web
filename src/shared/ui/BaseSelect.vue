<script setup lang="ts" generic="T extends string | number">
/**
 * Lista desplegable accesible con el estilo de la web v3 (patrón combobox de WAI-ARIA).
 * Se teletransporta al body para no recortarse dentro de contenedores con scroll.
 */
import { computed, nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'
import { Check, ChevronDown } from '@lucide/vue'

export interface SelectOption<V> { value: V; label: string; hint?: string; disabled?: boolean }

const props = withDefaults(defineProps<{
  label: string
  options: SelectOption<T>[]
  placeholder?: string
  disabled?: boolean
  hideLabel?: boolean
  compact?: boolean
}>(), { placeholder: 'Selecciona', disabled: false, hideLabel: false, compact: false })

const model = defineModel<T | null>({ required: true })
const id = useId()
const open = ref(false)
const highlighted = ref(0)
const trigger = ref<HTMLButtonElement>()
const list = ref<HTMLUListElement>()
const position = ref({ top: 0, left: 0, width: 0, maxHeight: 320 })
const selected = computed(() => props.options.find(option => option.value === model.value))
let typed = ''
let typedTimer = 0

function place() {
  const rect = trigger.value?.getBoundingClientRect()
  if (!rect) return
  const below = window.innerHeight - rect.bottom - 12
  const above = rect.top - 12
  const up = below < 220 && above > below
  const maxHeight = Math.min(340, up ? above : below)
  position.value = { top: up ? rect.top - maxHeight - 6 : rect.bottom + 6, left: rect.left, width: rect.width, maxHeight }
}

async function show() {
  if (props.disabled || !props.options.length) return
  place()
  const index = props.options.findIndex(option => option.value === model.value)
  highlighted.value = index >= 0 ? index : props.options.findIndex(option => !option.disabled)
  open.value = true
  await nextTick()
  list.value?.focus()
  scrollToHighlighted()
}

function hide(returnFocus = true) {
  open.value = false
  if (returnFocus) trigger.value?.focus()
}

function choose(index: number) {
  const option = props.options[index]
  if (!option || option.disabled) return
  model.value = option.value
  hide()
}

function move(step: number) {
  const count = props.options.length
  for (let i = 1; i <= count; i++) {
    const next = (highlighted.value + step * i + count) % count
    if (!props.options[next]?.disabled) {
      highlighted.value = next
      break
    }
  }
  scrollToHighlighted()
}

function scrollToHighlighted() {
  void nextTick(() => list.value?.querySelector('.highlighted')?.scrollIntoView({ block: 'nearest' }))
}

function onListKey(event: KeyboardEvent) {
  if (event.key === 'ArrowDown') { event.preventDefault(); move(1) }
  else if (event.key === 'ArrowUp') { event.preventDefault(); move(-1) }
  else if (event.key === 'Home') { event.preventDefault(); highlighted.value = -1; move(1) }
  else if (event.key === 'End') { event.preventDefault(); highlighted.value = props.options.length; move(-1) }
  else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); choose(highlighted.value) }
  else if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); hide() }
  else if (event.key === 'Tab') hide(false)
  else if (event.key.length === 1) {
    // Búsqueda por las primeras letras.
    typed += event.key.toLowerCase()
    clearTimeout(typedTimer)
    typedTimer = window.setTimeout(() => { typed = '' }, 600)
    const match = props.options.findIndex(option => !option.disabled && option.label.toLowerCase().startsWith(typed))
    if (match >= 0) { highlighted.value = match; scrollToHighlighted() }
  }
}

function onTriggerKey(event: KeyboardEvent) {
  if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
    event.preventDefault()
    void show()
  }
}

function onOutside(event: PointerEvent) {
  const target = event.target as Node
  if (!list.value?.contains(target) && !trigger.value?.contains(target)) hide(false)
}

watch(open, value => {
  if (value) {
    document.addEventListener('pointerdown', onOutside, true)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
  } else {
    document.removeEventListener('pointerdown', onOutside, true)
    window.removeEventListener('resize', place)
    window.removeEventListener('scroll', place, true)
  }
})
onBeforeUnmount(() => { open.value = false })
</script>

<template>
  <div class="select" :class="{ compact }">
    <span :id="`${id}-label`" class="field-label" :class="{ 'visually-hidden': hideLabel }">{{ label }}</span>
    <button ref="trigger" type="button" class="select-trigger" :class="{ open }" role="combobox" :disabled="disabled"
      :aria-expanded="open" :aria-controls="`${id}-list`" :aria-labelledby="`${id}-label ${id}-value`" aria-haspopup="listbox"
      @click="open ? hide() : show()" @keydown="onTriggerKey">
      <slot name="icon" />
      <span :id="`${id}-value`" :class="{ placeholder: !selected }">{{ selected?.label ?? placeholder }}</span>
      <ChevronDown :size="18" class="chevron" aria-hidden="true" />
    </button>
    <Teleport to="body">
      <ul v-if="open" :id="`${id}-list`" ref="list" class="select-list" role="listbox" tabindex="-1"
        :aria-labelledby="`${id}-label`" :aria-activedescendant="`${id}-opt-${highlighted}`"
        :style="{ top: `${position.top}px`, left: `${position.left}px`, minWidth: `${position.width}px`, maxHeight: `${position.maxHeight}px` }"
        @keydown="onListKey">
        <li v-for="(option, index) in options" :id="`${id}-opt-${index}`" :key="String(option.value)" role="option"
          :aria-selected="option.value === model" :aria-disabled="option.disabled || undefined"
          :class="{ highlighted: index === highlighted, selected: option.value === model, disabled: option.disabled }"
          @pointermove="!option.disabled && (highlighted = index)" @click="choose(index)">
          <span>{{ option.label }}<small v-if="option.hint">{{ option.hint }}</small></span>
          <Check v-if="option.value === model" :size="18" aria-hidden="true" />
        </li>
      </ul>
    </Teleport>
  </div>
</template>

<style scoped>
.select { display: grid; gap: 6px; min-width: 0; }
.select-trigger {
  width: 100%;
  min-width: 150px;
  height: 46px;
  padding: 0 14px;
  display: flex;
  align-items: center;
  gap: 10px;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-m);
  background: linear-gradient(180deg, #fff, #edf4ff);
  color: var(--ink);
  font: 600 14px var(--font-title);
  text-align: left;
  box-shadow: inset 0 1px 0 #fff;
  transition: border-color .2s, box-shadow .2s;
}
.compact .select-trigger { height: 40px; min-width: 120px; font-size: 13px; }
.select-trigger > span { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.select-trigger .placeholder { color: var(--muted); }
.select-trigger :deep(svg) { flex-shrink: 0; color: var(--blue); }
.select-trigger .chevron { transition: transform .3s var(--ease); }
.select-trigger:hover:not(:disabled), .select-trigger.open { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(56, 189, 248, .22), 0 0 20px rgba(56, 189, 248, .4); }
.select-trigger.open .chevron { transform: rotate(180deg); }
.select-trigger:disabled { opacity: .55; }
.select-list {
  position: fixed;
  z-index: 2000;
  margin: 0;
  overflow-y: auto;
  padding: 7px;
  list-style: none;
  border: 1px solid rgba(120, 170, 255, .38);
  border-radius: 16px;
  background: var(--grad-menu);
  color: #fff;
  box-shadow: 0 22px 50px rgba(2, 8, 25, .5), 0 0 24px rgba(56, 189, 248, .2);
  scrollbar-width: thin;
  scrollbar-color: #35599c transparent;
  animation: list-in .22s var(--ease) both;
}
.select-list:focus { outline: none; }
.select-list li {
  min-height: 44px;
  padding: 9px 12px;
  display: flex;
  align-items: center;
  gap: 10px;
  border-radius: 11px;
  font: 600 14px var(--font-title);
  cursor: pointer;
}
.select-list li > span { flex: 1; min-width: 0; }
.select-list small { display: block; margin-top: 2px; color: #9fc3f5; font: 400 12px var(--font-body); }
.select-list li svg { color: var(--accent); }
.select-list li.selected { background: rgba(56, 189, 248, .14); }
.select-list li.highlighted { background: linear-gradient(100deg, rgba(56, 189, 248, .38), rgba(79, 110, 255, .3)); box-shadow: inset 3px 0 0 var(--accent); }
.select-list li.disabled { opacity: .42; cursor: not-allowed; }
@keyframes list-in { from { opacity: 0; transform: translateY(-6px) scale(.98); } }
</style>
