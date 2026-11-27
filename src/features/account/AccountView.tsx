/**
 * Acceso sin contraseña con código de un solo uso al correo (tabla otp_verificacion).
 * Las compras de invitado de este navegador se ven sin iniciar sesión.
 */
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { LogOut, Mail } from 'lucide-react'
import StateView from '@/shared/ui/StateView'
import { useConfig, useServices } from '@/app/services'
import { appStore, useAppStore } from '@/app/stores/app'
import { keys, useMyPurchases } from '@/app/queries'
import { PURCHASE_STATUS_LABELS } from '@/domain/labels'
import { formatDateTime } from '@/shared/lib/datetime'
import { formatMoney } from '@/shared/lib/money'
import { toApiError } from '@/shared/lib/errors'
import { errorMessage } from '@/shared/lib/messages'
import { toast } from '@/shared/feedback'
import styles from './AccountView.module.css'

export default function AccountView() {
  const { account, mode } = useServices()
  const config = useConfig()
  const session = useAppStore(state => state.session)
  const queryClient = useQueryClient()
  const purchases = useMyPurchases()

  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [devCode, setDevCode] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const signedIn = session.kind === 'customer'

  async function requestCode(event: FormEvent) {
    event.preventDefault()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError('Escribe un correo válido.'); return }
    setBusy(true)
    setError('')
    try {
      const result = await account.requestCode(email.trim())
      setDevCode(result.devCode)
      setStep('code')
    } catch (failure) {
      setError(errorMessage(toApiError(failure)))
    } finally {
      setBusy(false)
    }
  }

  async function verify(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      appStore.getState().setSession(await account.verifyCode(email.trim(), code.trim()))
      // La caché de la sesión anterior no debe mostrarse con la nueva.
      queryClient.removeQueries({ queryKey: keys.purchases() })
      toast('Sesión iniciada.')
    } catch (failure) {
      setError(errorMessage(toApiError(failure)))
    } finally {
      setBusy(false)
    }
  }

  async function signOut() {
    appStore.getState().setSession(await account.signOut())
    queryClient.clear()
    setStep('email')
    setCode('')
    toast('Sesión cerrada.', 'info')
  }

  return (
    <div className={`container page ${styles.grid}`}>
      <section className={`card ${styles.access}`}>
        {signedIn
          ? (
            <>
              <p className="eyebrow">Mi cuenta</p>
              <h1>Hola</h1>
              <p className="muted">Sesión iniciada como <strong>{session.email}</strong>.</p>
              <button type="button" className="btn btn-secondary" onClick={() => void signOut()}><LogOut size={18} /> Cerrar sesión</button>
            </>
          )
          : !config.features.accounts
            ? (
              <>
                <p className="eyebrow">Mi cuenta</p>
                <h1>Tus compras</h1>
                <p className="muted">El acceso con correo no está disponible por ahora. Aquí ves las compras hechas desde este navegador; tus boletos también llegan por correo.</p>
              </>
            )
            : (
              <>
                <p className="eyebrow">Mi cuenta</p>
                <h1>Consulta tus compras</h1>
                <p className="muted">Te enviamos un código de un solo uso al correo con el que compraste. No necesitas contraseña.</p>
                {step === 'email'
                  ? (
                    <form className={styles.form} noValidate onSubmit={event => void requestCode(event)}>
                      <label className="field">
                        <span>Correo electrónico</span>
                        <input value={email} onChange={event => setEmail(event.target.value)} className="input" type="email" autoComplete="email" inputMode="email" required aria-invalid={!!error} />
                      </label>
                      <button type="submit" className="btn btn-primary" disabled={busy}><Mail size={18} /> {busy ? 'Enviando…' : 'Enviar código'}</button>
                    </form>
                  )
                  : (
                    <form className={styles.form} noValidate onSubmit={event => void verify(event)}>
                      <p className="muted">Escribe el código de 6 dígitos que enviamos a <strong>{email}</strong>.</p>
                      {mode === 'mock' && devCode && <p className="notice">Simulación: tu código es <strong>{devCode}</strong>.</p>}
                      <label className="field">
                        <span>Código</span>
                        <input value={code} onChange={event => setCode(event.target.value)} className={`input ${styles.code}`} inputMode="numeric" autoComplete="one-time-code"
                          maxLength={6} required aria-invalid={!!error} />
                      </label>
                      <div className={styles.row}>
                        <button type="submit" className="btn btn-primary" disabled={busy || code.length !== 6}>{busy ? 'Verificando…' : 'Entrar'}</button>
                        <button type="button" className="btn btn-ghost" onClick={() => setStep('email')}>Cambiar correo</button>
                      </div>
                    </form>
                  )}
                {error && <p className="field-error" role="alert">{error}</p>}
              </>
            )}
      </section>

      <section className={styles.purchases} aria-labelledby="mis-compras">
        <h2 id="mis-compras">Mis compras</h2>
        {!signedIn && <p className="muted">Se muestran las compras hechas desde este navegador.</p>}
        <StateView loading={purchases.isPending} error={purchases.error} empty={!purchases.data?.length} skeleton="rows"
          emptyTitle="Sin compras" emptyText="Tus boletos y pedidos aparecerán aquí." onRetry={() => void purchases.refetch()}>
          <ul className={styles.list} role="list">
            {purchases.data?.map(purchase => (
              <li key={purchase.id}>
                <Link to={`/compras/${purchase.id}`} className={`card ${styles.item}`}>
                  <span className={styles.title}>{purchase.screening?.movieTitle ?? 'Pedido de dulcería'}</span>
                  <span className="muted">{purchase.complex.name} · {formatDateTime(purchase.screening?.startsAt ?? purchase.createdAt)}</span>
                  <span className={styles.meta}>
                    <span className="badge">{PURCHASE_STATUS_LABELS[purchase.status]}</span>
                    <strong>{formatMoney(purchase.totals.totalCents)}</strong>
                    {purchase.ticketCode && <span className="muted">Folio {purchase.ticketCode}</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </StateView>
      </section>
    </div>
  )
}
