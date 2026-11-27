import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { ConfigContext } from '@/app/services'
import type { AppConfig } from '@/app/config'
import PaymentForm from './PaymentForm'

function renderForm(apiMode: AppConfig['apiMode']) {
  const config = { apiMode, features: { realtimeSeats: true, onlinePayments: true, accounts: true } } as AppConfig
  return render(
    <ConfigContext value={config}>
      <MemoryRouter>
        <PaymentForm initialEmail={null} />
      </MemoryRouter>
    </ConfigContext>
  )
}

const radios = (container: HTMLElement) => [...container.querySelectorAll<HTMLInputElement>('input[type="radio"]')].map(input => input.value)

afterEach(cleanup)

describe('formulario de pago', () => {
  it('el simulador muestra el bloque de modo de prueba', () => {
    const { container } = renderForm('mock')
    expect(container.textContent).toContain('Modo de prueba: elige el resultado del pago')
    expect(radios(container)).toEqual(['simulated-approve', 'simulated-decline'])
  })

  it('con el API real no aparece ninguna opción de prueba', () => {
    const { container } = renderForm('http')
    expect(container.textContent).not.toMatch(/prueba|simula|Aprobar|Rechazar/i)
    expect(radios(container)).toEqual(['card'])
  })

  it('marca los obligatorios desde el inicio y muestra cada error al salir de su campo', () => {
    const { container } = renderForm('mock')
    expect(container.textContent).toContain('Todos los campos son obligatorios')
    expect(container.querySelectorAll('input[required]')).toHaveLength(4)
    const errors = () => [...container.querySelectorAll('.field-error')].map(item => item.textContent).filter(Boolean)
    expect(errors()).toEqual([])

    fireEvent.blur(container.querySelector('input[autocomplete="given-name"]')!)
    expect(errors()).toEqual(['Escribe tu nombre.'])
  })
})
