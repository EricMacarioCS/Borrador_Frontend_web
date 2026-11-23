<script setup lang="ts">
/** Personalización de un producto con las reglas del catálogo (mínimo, máximo y opciones). */
import { computed, ref, watch } from 'vue'
import BaseDialog from '@/shared/ui/BaseDialog.vue'
import QuantityStepper from '@/shared/ui/QuantityStepper.vue'
import { formatMoney } from '@/shared/lib/money'
import type { Product } from '@/domain/models'
import { defaultChoices, describe, estimateCents, isComplete, ruleProblem, toSelection, type Choices } from './selection'
import type { CartLine } from '@/app/stores/cart'

const props = defineProps<{ product: Product | null; actionLabel?: string }>()
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
          <label v-for="option in rule.options" :key="option.id" class="option" :class="{ checked: (choices[rule.id] ?? []).includes(option.id), off: !option.available }">
            <input :type="rule.max === 1 ? 'radio' : 'checkbox'" :name="rule.id" :checked="(choices[rule.id] ?? []).includes(option.id)"
              :disabled="!option.available || (rule.max > 1 && !(choices[rule.id] ?? []).includes(option.id) && (choices[rule.id] ?? []).length >= rule.max)"
              @change="toggle(rule.id, option.id, rule.max)" />
            <span>{{ option.name }}</span>
            <small v-if="option.extraCents">+{{ formatMoney(option.extraCents) }}</small>
            <small v-if="!option.available">Agotado</small>
          </label>
        </div>
        <p v-if="touched && ruleProblem(rule, choices[rule.id] ?? [])" class="field-error" role="alert">{{ ruleProblem(rule, choices[rule.id] ?? []) }}</p>
      </fieldset>
    </template>
    <template #footer>
      <div class="footer">
        <QuantityStepper v-model="quantity" :label="product?.name ?? 'Cantidad'" :min="1" :max="10" />
        <button type="button" class="btn btn-primary" :disabled="!product?.available" @click="add">
          {{ actionLabel ?? 'Agregar' }} · {{ formatMoney(unit * quantity) }}
        </button>
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
.option:hover { border-color: var(--accent); }
.option.checked { border-color: var(--blue); background: var(--accent-soft); box-shadow: 0 0 0 1px var(--blue); }
.option.off { opacity: .5; cursor: not-allowed; }
.option input { accent-color: var(--blue); width: 18px; height: 18px; }
.option span { flex: 1; font-weight: 600; }
.option small { color: var(--muted); font-size: 12px; }
.footer { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; }
</style>
