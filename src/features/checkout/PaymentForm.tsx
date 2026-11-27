/**
 * Datos del comprador y método de pago. Nunca se piden datos de tarjeta aquí:
 * con la pasarela real, el pago ocurre en la página o el marco del proveedor.
 */
import { useEffect, useId, useImperativeHandle, useRef, useState, type Ref } from 'react'
import { Link } from 'react-router'
import { FlaskConical, ShieldCheck } from 'lucide-react'
import type { Customer } from '@/domain/models'
import { useConfig } from '@/app/services'
import { cx } from '@/shared/lib/cx'
import styles from './PaymentForm.module.css'

export interface PaymentFormHandle {
  /** Marca todo como tocado, lleva al primer campo con error y devuelve los datos si son válidos. */
  submit(): { customer: Customer; method: string } | null
}

// Los resultados de prueba solo existen en el simulador; con el API real nunca se muestran.
const TEST_OUTCOMES = [
  { value: 'simulated-approve', label: 'Aprobar el pago', hint: 'La compra se confirma en unos segundos.' },
  { value: 'simulated-decline', label: 'Rechazar el pago', hint: 'Sirve para probar qué pasa con un pago rechazado.' }
]
const METHODS = [{ value: 'card', label: 'Tarjeta de crédito o débito', hint: 'Continuarás en la página segura del proveedor de pagos.' }]

type Touched = Record<'firstName' | 'lastName' | 'email' | 'accepted', boolean>

export default function PaymentForm({ initialEmail, ref }: { initialEmail: string | null; ref?: Ref<PaymentFormHandle> }) {
  const config = useConfig()
  const uid = useId()
  const root = useRef<HTMLDivElement>(null)
  const isMock = config.apiMode === 'mock'
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState(initialEmail ?? '')
  const [method, setMethod] = useState(isMock ? 'simulated-approve' : 'card')
  const [accepted, setAccepted] = useState(false)
  const [touched, setTouched] = useState<Touched>({ firstName: false, lastName: false, email: false, accepted: false })
  const [focusError, setFocusError] = useState(0)
  const touch = (key: keyof Touched) => setTouched(current => current[key] ? current : { ...current, [key]: true })

  const errors = {
    firstName: firstName.trim().length < 2 ? 'Escribe tu nombre.' : '',
    lastName: lastName.trim().length < 2 ? 'Escribe tu apellido.' : '',
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? '' : 'Escribe un correo válido.',
    accepted: accepted ? '' : 'Acepta los términos para continuar.'
  }
  const valid = Object.values(errors).every(value => !value)

  // El foco va al primer campo con error después de que se pintan los errores.
  useEffect(() => {
    if (focusError) root.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
  }, [focusError])

  useImperativeHandle(ref, () => ({
    submit() {
      if (!config.features.onlinePayments) return null
      setTouched({ firstName: true, lastName: true, email: true, accepted: true })
      if (!valid) {
        setFocusError(count => count + 1)
        return null
      }
      return { customer: { firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim() }, method }
    }
  }))

  return (
    <div ref={root} className={styles.payment}>
      {!config.features.onlinePayments && (
        <p className="notice notice-warning" role="status">
          Los pagos en línea están suspendidos por el momento. Tus asientos siguen apartados mientras dure el tiempo; también puedes comprar en taquilla.
        </p>
      )}
      <p className={styles.requiredNote}>Todos los campos son obligatorios <span className={styles.required} aria-hidden="true">*</span></p>
      <fieldset className={styles.group}>
        <legend>Tus datos</legend>
        <div className={styles.fields}>
          <div className="field">
            <label htmlFor={`${uid}-nombre`}>Nombre <span className={styles.required} aria-hidden="true">*</span></label>
            <input id={`${uid}-nombre`} value={firstName} onChange={event => setFirstName(event.target.value)} className="input" autoComplete="given-name" required
              aria-invalid={touched.firstName && !!errors.firstName} aria-describedby={`${uid}-nombre-error`} onBlur={() => touch('firstName')} />
            <small id={`${uid}-nombre-error`} className="field-error">{touched.firstName ? errors.firstName : ''}</small>
          </div>
          <div className="field">
            <label htmlFor={`${uid}-apellido`}>Apellido <span className={styles.required} aria-hidden="true">*</span></label>
            <input id={`${uid}-apellido`} value={lastName} onChange={event => setLastName(event.target.value)} className="input" autoComplete="family-name" required
              aria-invalid={touched.lastName && !!errors.lastName} aria-describedby={`${uid}-apellido-error`} onBlur={() => touch('lastName')} />
            <small id={`${uid}-apellido-error`} className="field-error">{touched.lastName ? errors.lastName : ''}</small>
          </div>
          <div className={`field ${styles.wide}`}>
            <label htmlFor={`${uid}-correo`}>Correo electrónico <span className={styles.required} aria-hidden="true">*</span></label>
            <input id={`${uid}-correo`} value={email} onChange={event => setEmail(event.target.value)} className="input" type="email" autoComplete="email" inputMode="email" required
              aria-invalid={touched.email && !!errors.email} aria-describedby={`${uid}-correo-ayuda`} onBlur={() => touch('email')} />
            {touched.email && errors.email
              ? <small id={`${uid}-correo-ayuda`} className="field-error">{errors.email}</small>
              : <small id={`${uid}-correo-ayuda`} className="muted">Ahí enviaremos tu comprobante y podrás consultar tus compras.</small>}
          </div>
        </div>
      </fieldset>
      {!isMock && (
        <fieldset className={styles.group}>
          <legend>Método de pago</legend>
          {METHODS.map(item => (
            <label key={item.value} className={cx(styles.method, method === item.value && styles.checked)}>
              <input type="radio" name={`${uid}-metodo`} value={item.value} checked={method === item.value} onChange={() => setMethod(item.value)} />
              <span><strong>{item.label}</strong><small>{item.hint}</small></span>
            </label>
          ))}
          <p className={styles.secure}><ShieldCheck size={16} aria-hidden="true" /> Este sitio no recibe ni guarda datos de tarjeta.</p>
        </fieldset>
      )}
      <div className={styles.termsBlock}>
        <label className={styles.terms}>
          <input type="checkbox" required checked={accepted} aria-invalid={touched.accepted && !!errors.accepted}
            aria-describedby={`${uid}-terminos-error`} onChange={event => { setAccepted(event.target.checked); touch('accepted') }} onBlur={() => touch('accepted')} />
          <span>Acepto los <Link to="/legal/terminos" target="_blank">términos de uso</Link> y el <Link to="/legal/privacidad" target="_blank">aviso de privacidad</Link>. <span className={styles.required} aria-hidden="true">*</span></span>
        </label>
        <small id={`${uid}-terminos-error`} className="field-error">{touched.accepted ? errors.accepted : ''}</small>
      </div>
      {isMock && (
        <fieldset className={styles.testMode}>
          <legend><FlaskConical size={14} aria-hidden="true" /> Modo de prueba: elige el resultado del pago</legend>
          <p className={styles.testHelp}>Este bloque solo existe en la demostración. No se pide tarjeta ni se hacen cobros.</p>
          <div className={styles.outcomes}>
            {TEST_OUTCOMES.map(outcome => (
              <label key={outcome.value} className={cx(styles.outcome, method === outcome.value && styles.checked)}>
                <input type="radio" name={`${uid}-metodo`} value={outcome.value} checked={method === outcome.value} onChange={() => setMethod(outcome.value)} />
                <span><strong>{outcome.label}</strong><small>{outcome.hint}</small></span>
              </label>
            ))}
          </div>
        </fieldset>
      )}
    </div>
  )
}
