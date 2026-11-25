import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { ConfigKey } from '@/app/services'
import type { AppConfig } from '@/app/config'
import PaymentForm from './PaymentForm.vue'

function render(apiMode: AppConfig['apiMode']) {
  const config = { apiMode, features: { realtimeSeats: true, onlinePayments: true, accounts: true } } as AppConfig
  return mount(PaymentForm, { props: { initialEmail: null }, global: { provide: { [ConfigKey as symbol]: config }, stubs: { RouterLink: true } } })
}

describe('formulario de pago', () => {
  it('el simulador muestra el bloque de modo de prueba', () => {
    const form = render('mock')
    expect(form.text()).toContain('Modo de prueba: elige el resultado del pago')
    expect(form.findAll('input[type="radio"]').map(input => input.attributes('value'))).toEqual(['simulated-approve', 'simulated-decline'])
  })

  it('con el API real no aparece ninguna opción de prueba', () => {
    const form = render('http')
    expect(form.text()).not.toMatch(/prueba|simula|Aprobar|Rechazar/i)
    expect(form.findAll('input[type="radio"]').map(input => input.attributes('value'))).toEqual(['card'])
  })

  it('marca los obligatorios desde el inicio y muestra cada error al salir de su campo', async () => {
    const form = render('mock')
    expect(form.text()).toContain('Todos los campos son obligatorios')
    expect(form.findAll('input[required]')).toHaveLength(4)
    const errors = () => form.findAll('.field-error').map(item => item.text()).filter(Boolean)
    expect(errors()).toEqual([])

    await form.find('input[autocomplete="given-name"]').trigger('blur')
    expect(errors()).toEqual(['Escribe tu nombre.'])
  })
})
