/**
 * Selector de cines. Se pueden elegir varios complejos de una misma ciudad, o ninguno.
 * Al marcar un cine de otra ciudad, la selección cambia a esa ciudad.
 * Está en `App` para abrirse desde cualquier vista (barra, buscador o al elegir una película).
 */
import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { Check, MapPin, Search, X } from 'lucide-react'
import BaseDialog from '@/shared/ui/BaseDialog'
import { useAppStore } from '@/app/stores/app'
import { normalizeText } from '@/shared/lib/text'
import { cx } from '@/shared/lib/cx'
import type { Complex } from '@/domain/models'
import styles from './ComplexPicker.module.css'

export default function ComplexPicker() {
  const open = useAppStore(state => state.pickerOpen)
  const complexes = useAppStore(state => state.complexes)
  const selectedComplexIds = useAppStore(state => state.selectedComplexIds)
  const selectedCity = useAppStore(state => state.selectedCity)
  const pendingPath = useAppStore(state => state.pendingPath)
  const { complexById, selectComplexes, closePicker } = useAppStore(state => state)
  const navigate = useNavigate()
  const searchInput = useRef<HTMLInputElement>(null)

  const [draft, setDraft] = useState<string[]>([])
  const [term, setTerm] = useState('')
  const [switchedTo, setSwitchedTo] = useState<string | null>(null)
  /** Ciudad que va primero en la lista. Se fija al abrir para que la lista no se mueva mientras se elige. */
  const [firstCity, setFirstCity] = useState<string | null>(null)

  // Al abrir, el borrador parte de la selección actual.
  const [wasOpen, setWasOpen] = useState(false)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setDraft([...selectedComplexIds])
      setFirstCity(selectedCity)
      setTerm('')
      setSwitchedTo(null)
    }
  }

  const draftCity = complexById(draft[0] ?? '')?.city ?? null

  /** Ciudades con sus cines que coinciden con la búsqueda (por nombre del cine o de la ciudad). La ciudad ya elegida va primero. */
  const cities = useMemo(() => {
    const query = normalizeText(term)
    const groups = new Map<string, Complex[]>()
    for (const complex of complexes) {
      if (query && !normalizeText(`${complex.name} ${complex.city}`).includes(query)) continue
      groups.set(complex.city, [...(groups.get(complex.city) ?? []), complex])
    }
    return [...groups].sort(([a], [b]) => Number(b === firstCity) - Number(a === firstCity))
  }, [complexes, term, firstCity])

  function toggle(complex: Complex, checked: boolean) {
    if (!checked) {
      setDraft(draft.filter(id => id !== complex.id))
      return
    }
    if (draftCity && draftCity !== complex.city) {
      setDraft([complex.id])
      setSwitchedTo(complex.city)
      return
    }
    setDraft([...draft, complex.id])
  }

  function selectCity(list: Complex[]) {
    if (draftCity !== list[0]?.city) setSwitchedTo(draftCity ? list[0]?.city ?? null : null)
    setDraft(list.map(complex => complex.id))
  }

  const continuing = Boolean(pendingPath)
  const applyLabel = !draft.length
    ? (continuing ? 'Elige al menos un cine' : 'Ver todos los cines')
    : (continuing ? 'Ver horarios' : 'Aplicar')

  function apply() {
    if (continuing && !draft.length) return
    const then = pendingPath
    selectComplexes(draft)
    closePicker()
    if (then && draft.length) void navigate(then)
  }

  return (
    <BaseDialog open={open} label="Elige tus cines" onClose={closePicker} header={<h2>Elige tus cines</h2>}
      footer={(
        <div className={styles.footer}>
          <p className={styles.status}>
            {draft.length
              ? <><Check size={16} aria-hidden="true" /> {draft.length} {draft.length === 1 ? 'cine' : 'cines'} en {draftCity}</>
              : 'Sin cines elegidos'}
          </p>
          {draft.length > 0 && (
            <button type="button" className="btn btn-ghost btn-small" onClick={() => { setDraft([]); setSwitchedTo(null) }}>Quitar todos</button>
          )}
          <button type="button" className="btn btn-primary" disabled={continuing && !draft.length} onClick={apply}>{applyLabel}</button>
        </div>
      )}>
      <div className={styles.searchArea}>
        <label className={styles.search}>
          <Search size={19} aria-hidden="true" />
          <span className="visually-hidden">Buscar por cine o ciudad</span>
          <input ref={searchInput} value={term} onChange={event => setTerm(event.target.value)} type="search" placeholder="Busca por cine o ciudad" autoComplete="off" />
          {term && (
            <button type="button" className={styles.clear} aria-label="Borrar búsqueda" onClick={() => { setTerm(''); searchInput.current?.focus() }}><X size={16} /></button>
          )}
        </label>
        {continuing
          ? <p className="notice">Elige dónde quieres verla para mostrarte los horarios.</p>
          : <p className={styles.help}>Puedes elegir varios cines de una misma ciudad para comparar horarios.</p>}
        {switchedTo && <p className="notice notice-warning" role="status">Cambiamos a {switchedTo}: solo puedes elegir cines de una ciudad a la vez.</p>}
      </div>

      {!cities.length && <p className={`muted ${styles.empty}`}>No encontramos cines ni ciudades con «{term}».</p>}
      {cities.map(([city, list]) => (
        <fieldset key={city} className={cx(styles.city, city === draftCity && styles.current)}>
          <legend>
            <MapPin size={15} aria-hidden="true" /> {city}
            {list.length > 1 && <button type="button" className={styles.all} onClick={() => selectCity(list)}>Elegir todos</button>}
          </legend>
          {list.map(complex => (
            <label key={complex.id} className={cx(styles.option, draft.includes(complex.id) && styles.checked)}>
              <input type="checkbox" checked={draft.includes(complex.id)} onChange={event => toggle(complex, event.target.checked)} />
              <span className={styles.copy}>
                <strong>{complex.name}</strong>
                {complex.formats.length > 0 && (
                  <span className={styles.formats}>
                    {complex.formats.map(format => <span key={format.code} className={styles.format}>{format.name}</span>)}
                  </span>
                )}
              </span>
              {draftCity && city !== draftCity && <small className={styles.switch}>Cambiar a esta ciudad</small>}
            </label>
          ))}
        </fieldset>
      ))}
    </BaseDialog>
  )
}
