<script setup lang="ts">
/** Personalización de un producto con las reglas del catálogo (mínimo, máximo y opciones). */
import { computed, ref, watch } from 'vue'
import BaseDialog from '@/shared/ui/BaseDialog.vue'
import QuantityStepper from '@/shared/ui/QuantityStepper.vue'
import { formatMoney } from '@/shared/lib/money'
import type { ModifierOption, ModifierRule, Product } from '@/domain/models'
import { defaultChoices, describe, estimateCents, isComplete, ruleProblem, toSelection, type Choices } from './selection'
import type { CartLine } from '@/app/stores/cart'

const props = defineProps<{ product: Product | null }>()
const emit = defineEmits<{ close: []; add: [line: Omit<CartLine, 'key'>] }>()

const choices = ref<Choices>({})
const quantity = ref(1)
const touched = ref(false)

watch(() => props.product, product => {
  if (!product) return
  choices.value = defaultChoices(product)
  quantity.value = 1
  touched.value = false
}, { immediate: true })

const unit = computed(() => props.product ? estimateCents(props.product, choices.value) : 0)
const ready = computed(() => props.product ? isComplete(props.product, choices.value) : false)

const isCombo = computed(() => props.product?.category.code === 'combos' || props.product?.structure === 'combo')
const noun = computed(() => isCombo.value ? 'combo' : 'producto')
const quantityLabel = computed(() => `Cantidad de ${noun.value}s`)
const addLabel = computed(() => `Agregar ${quantity.value} ${noun.value}${quantity.value === 1 ? '' : 's'} · ${formatMoney(unit.value * quantity.value)}`)

const picked = (ruleId: string) => choices.value[ruleId] ?? []
/** Con varias opciones permitidas, al llegar al máximo las demás se bloquean. */
const full = (rule: ModifierRule) => rule.max > 1 && picked(rule.id).length >= rule.max
const blocked = (rule: ModifierRule, option: ModifierOption) => !option.available || (full(rule) && !picked(rule.id).includes(option.id))

function toggle(ruleId: string, optionId: string, max: number) {
  const current = choices.value[ruleId] ?? []
  if (max === 1) choices.value = { ...choices.value, [ruleId]: [optionId] }
  else if (current.includes(optionId)) choices.value = { ...choices.value, [ruleId]: current.filter(id => id !== optionId) }
  else if (current.length < max) choices.value = { ...choices.value, [ruleId]: [...current, optionId] }
}

function add() {
  touched.value = true
  const product = props.product
  if (!product || !ready.value) return
  emit('add', {
    ...toSelection(product, choices.value, quantity.value),
    name: product.name,
    detail: describe(product, choices.value),
    estimateCents: unit.value,
    requiresTicketCode: product.requiresTicketCode
  })
}
</script>

<template>
  <BaseDialog :open="!!product" :label="product ? `Personalizar ${product.name}` : 'Personalizar'" @close="emit('close')">
    <template #header><h2>{{ product?.name }}</h2></template>
    <template v-if="product">
      <div class="banner" aria-hidden="true"><span>{{ product.category.name }}</span></div>
      <p class="description">{{ product.description }}</p>
      <fieldset v-for="rule in product.rules" :key="rule.id" class="rule">
        <legend>
          {{ rule.title }}
          <small>{{ rule.min > 0 ? 'Obligatorio' : 'Opcional' }}{{ rule.max > 1 ? ` · hasta ${rule.max}` : '' }}</small>
        </legend>
        <p v-if="rule.allowSplit" class="hint">Si eliges dos, te servimos mitad y mitad.</p>
        <div class="options">
          <label v-for="option in rule.options" :key="option.id" class="option" :class="{ checked: picked(rule.id).includes(option.id), off: blocked(rule, option) }">
            <input :type="rule.max === 1 ? 'radio' : 'checkbox'" :name="rule.id" :checked="picked(rule.id).includes(option.id)"
              :disabled="blocked(rule, option)" :aria-disabled="blocked(rule, option)" @change="toggle(rule.id, option.id, rule.max)" />
            <span>{{ option.name }}</span>
            <small v-if="option.extraCents">+{{ formatMoney(option.extraCents) }}</small>
            <small v-if="!option.available">Agotado</small>
          </label>
        </div>
        <p v-if="rule.max > 1" class="limit" aria-live="polite">{{ full(rule) ? `Ya elegiste ${rule.max} de ${rule.max}. Quita una opción para elegir otra.` : '' }}</p>
        <p v-if="touched && ruleProblem(rule, choices[rule.id] ?? [])" class="field-error" role="alert">{{ ruleProblem(rule, choices[rule.id] ?? []) }}</p>
      </fieldset>
    </template>
    <template #footer>
      <div class="footer">
        <p class="same">
          {{ quantity > 1 ? `Los ${quantity} ${noun}s llevarán la misma personalización.` : `Si pides varios ${noun}s, todos llevarán la misma personalización.` }}
          Si quieres sabores u opciones distintas, agrega otro {{ noun }} por separado.
        </p>
        <div class="quantity">
          <span aria-hidden="true">{{ quantityLabel }}</span>
          <QuantityStepper v-model="quantity" :label="quantityLabel" :min="1" :max="10" />
        </div>
        <button type="button" class="btn btn-primary add" :disabled="!product?.available" @click="add">{{ addLabel }}</button>
      </div>
    </template>
  </BaseDialog>
</template>

<style scoped>
.banner { height: 120px; margin: -20px -20px 16px; display: grid; place-items: center; background: radial-gradient(70% 90% at 30% 20%, rgba(255, 201, 60, .45), transparent 60%), linear-gradient(140deg, #a98ce8, #5a3fc0); color: #fff; font: 800 28px var(--font-title); }
.description { color: var(--muted); margin-bottom: 8px; }
.rule { margin: 18px 0 0; padding: 0; border: 0; }
.rule legend { display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px; font: 800 16px var(--font-title); }
.rule legend small { color: var(--muted); font: 600 12px var(--font-body); }
.hint { margin-top: 4px; color: var(--muted); font-size: 13px; }
.options { margin-top: 10px; display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; }
.option { min-height: 48px; padding: 10px 12px; display: flex; align-items: center; gap: 10px; border: 1px solid var(--line-strong); border-radius: 12px; background: #fff; cursor: pointer; transition: border-color .2s, box-shadow .2s, background .2s; }
.option:hover:not(.off) { border-color: var(--accent); }
.option.checked { border-color: var(--blue); background: var(--accent-soft); box-shadow: 0 0 0 1px var(--blue); }
.option.off { border-color: #d5dae3; border-style: dashed; background: #e9ecf1; color: #727d90; box-shadow: none; cursor: not-allowed; }
.option.off input { cursor: not-allowed; filter: grayscale(1); opacity: .55; }
.option.off small { color: #727d90; }
.limit { margin-top: 8px; color: var(--blue); font-size: 13px; font-weight: 600; }
.limit:empty { display: none; }
.option input { accent-color: var(--blue); width: 18px; height: 18px; }
.option span { flex: 1; font-weight: 600; }
.option small { color: var(--muted); font-size: 12px; }
.footer { display: flex; flex-wrap: wrap; align-items: end; justify-content: space-between; gap: 12px; }
.same { flex-basis: 100%; color: var(--muted); font-size: 13px; line-height: 1.4; }
.quantity { display: grid; justify-items: start; gap: 6px; }
.quantity > span { color: #485a78; font: 700 12px var(--font-title); }
@media (max-width: 440px) { .add { width: 100%; } }
</style>
