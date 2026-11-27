/**
 * Buscador de películas, cines y formatos (combobox WAI-ARIA con lista de sugerencias).
 * Sin texto muestra las 5 películas más populares y los formatos de todos los complejos.
 * `popover`: campo del encabezado con lista flotante. `panel`: dentro de una ventana, lista siempre visible.
 */
import { useId, useMemo, useRef, useState, type FocusEvent, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router'
import { MapPin, Search, X } from 'lucide-react'
import PosterArt from '@/shared/ui/PosterArt'
import { useMovies, usePopularMovies } from '@/app/queries'
import { useAppStore } from '@/app/stores/app'
import { toast } from '@/shared/feedback'
import { normalizeText } from '@/shared/lib/text'
import { cx } from '@/shared/lib/cx'
import { STAGE_LABELS } from '@/domain/labels'
import type { Complex, ComplexFormat, Movie } from '@/domain/models'
import styles from './SearchBox.module.css'

type Option =
  | { kind: 'movie'; key: string; movie: Movie; rank: number | null }
  | { kind: 'complex'; key: string; complex: Complex }
  | { kind: 'format'; key: string; format: ComplexFormat }
interface Group { key: string; title: string; options: Option[] }

interface Props {
  mode?: 'popover' | 'panel'
  className?: string
  onDone?: () => void
}

const movieOption = (movie: Movie, rank: number | null): Option => ({ kind: 'movie', key: `m-${movie.id}`, movie, rank })
const formatOption = (format: ComplexFormat): Option => ({ kind: 'format', key: `f-${format.code}`, format })
const complexFormats = (complex: Complex) => complex.formats.map(format => format.name).join(' · ')

export default function SearchBox({ mode = 'popover', className, onDone }: Props) {
  const complexes = useAppStore(state => state.complexes)
  const selectedComplexIds = useAppStore(state => state.selectedComplexIds)
  const allFormats = useAppStore(state => state.allFormats)
  const addComplex = useAppStore(state => state.addComplex)
  const navigate = useNavigate()
  const listId = useId()
  const [term, setTermState] = useState('')
  const [open, setOpen] = useState(mode === 'panel')
  const [active, setActive] = useState(-1)
  const root = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)

  const movies = useMovies(selectedComplexIds)
  const popular = usePopularMovies(selectedComplexIds, 5)

  /** Cambiar el texto reinicia la opción resaltada. */
  function setTerm(value: string) {
    setTermState(value)
    setActive(-1)
  }

  const query = normalizeText(term)
  const searching = query.length >= 2

  const groups = useMemo<Group[]>(() => {
    if (!searching) {
      return [
        { key: 'popular', title: 'Las más populares', options: (popular.data ?? []).slice(0, 5).map((movie, i) => movieOption(movie, i + 1)) },
        { key: 'formats', title: 'Formatos en nuestros cines', options: allFormats.map(formatOption) }
      ].filter(group => group.options.length)
    }
    const foundMovies = (movies.data ?? [])
      .filter(movie => normalizeText(`${movie.title} ${movie.genres.join(' ')} ${movie.cast.map(person => person.name).join(' ')}`).includes(query))
      .slice(0, 6)
    const foundComplexes = complexes.filter(complex => normalizeText(`${complex.name} ${complex.city}`).includes(query)).slice(0, 6)
    const foundFormats = allFormats.filter(format => normalizeText(format.name).includes(query))
    return [
      { key: 'movies', title: 'Películas', options: foundMovies.map(movie => movieOption(movie, null)) },
      { key: 'complexes', title: 'Cines', options: foundComplexes.map((complex): Option => ({ kind: 'complex', key: `c-${complex.id}`, complex })) },
      { key: 'formats', title: 'Formatos', options: foundFormats.map(formatOption) }
    ].filter(group => group.options.length)
  }, [searching, query, popular.data, movies.data, complexes, allFormats])

  const flat = groups.flatMap(group => group.options)
  const optionId = (option: Option) => `${listId}-${option.key}`
  const activeOption = flat[active]
  const showPanel = open && (flat.length > 0 || searching)

  function close() {
    if (mode === 'popover') setOpen(false)
    setActive(-1)
  }

  function finish() {
    setTerm('')
    close()
    if (mode === 'popover') input.current?.blur()
    onDone?.()
  }

  function run(option: Option) {
    if (option.kind === 'movie') {
      void navigate(`/peliculas/${option.movie.slug}`)
    } else if (option.kind === 'complex') {
      const change = addComplex(option.complex.id)
      if (change === 'switched-city') toast(`Cambiamos tus cines a ${option.complex.name}, en ${option.complex.city}.`)
      else if (change === 'added') toast(`Agregamos ${option.complex.name} a tus cines.`)
      void navigate('/cartelera')
    } else {
      const param = option.format.kind === 'projection' ? 'proyeccion' : 'sala'
      void navigate({ pathname: '/cartelera', search: `?${new URLSearchParams({ [param]: option.format.code })}` })
    }
    finish()
  }

  function onKey(event: KeyboardEvent<HTMLInputElement>) {
    const count = flat.length
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setOpen(true)
      if (!count) return
      const step = event.key === 'ArrowDown' ? 1 : -1
      setActive(active < 0 ? (step > 0 ? 0 : count - 1) : (active + step + count) % count)
    } else if (event.key === 'Enter') {
      const option = flat[active] ?? (searching ? flat[0] : undefined)
      if (option) {
        event.preventDefault()
        run(option)
      }
    } else if (event.key === 'Escape') {
      if (term) {
        event.preventDefault()
        event.stopPropagation()
        setTerm('')
      } else if (mode === 'popover' && open) {
        event.preventDefault()
        close()
      }
    }
  }

  function onBlur(event: FocusEvent) {
    if (mode === 'popover' && !root.current?.contains(event.relatedTarget)) close()
  }

  return (
    <div ref={root} className={cx(styles.searchBox, styles[`mode-${mode}`], className)} onBlur={onBlur}>
      <label className={cx('field', styles.field)}>
        <Search size={19} aria-hidden="true" />
        <span className="visually-hidden">Buscar películas, cines o formatos</span>
        <input ref={input} value={term} type="search" role="combobox" placeholder="Busca películas o cines" autoComplete="off" spellCheck={false}
          aria-autocomplete="list" aria-expanded={showPanel} aria-controls={listId} aria-activedescendant={activeOption ? optionId(activeOption) : undefined}
          onChange={event => { setTerm(event.target.value); setOpen(true) }} onFocus={() => setOpen(true)} onClick={() => setOpen(true)} onKeyDown={onKey} />
        {term && <button type="button" className={styles.clear} aria-label="Borrar búsqueda" onClick={() => { setTerm(''); input.current?.focus() }}><X size={16} /></button>}
      </label>

      <div className={styles.suggestions} hidden={!showPanel}>
        <p className="visually-hidden" role="status">{searching ? `${flat.length} sugerencias` : ''}</p>
        <ul id={listId} role="listbox" aria-label="Sugerencias" className={styles.groups}>
          {groups.map(group => (
            <li key={group.key} role="group" aria-labelledby={`${listId}-${group.key}`} className={cx(styles.group, styles[group.key])}>
              <span id={`${listId}-${group.key}`} role="presentation" className={styles.groupTitle}>{group.title}</span>
              <ul role="presentation" className={styles.options}>
                {group.options.map(option => {
                  const index = flat.indexOf(option)
                  return (
                    <li key={option.key} id={optionId(option)} role="option" className={cx(styles.option, styles[option.kind], index === active && styles.active)}
                      aria-selected={index === active} onMouseDown={event => event.preventDefault()} onMouseMove={() => setActive(index)} onClick={() => run(option)}>
                      {option.kind === 'movie' && (
                        <>
                          {option.rank && <span className={styles.rank} aria-hidden="true">{option.rank}</span>}
                          <PosterArt title={option.movie.title} accent={option.movie.accent} src={option.movie.posterUrl} decorative />
                          <span className={styles.text}>
                            <strong>{option.movie.title}</strong>
                            <small>{option.movie.rating.code} · {option.movie.genres.join(', ')} · {option.movie.isSpecialEvent ? 'Evento especial' : STAGE_LABELS[option.movie.stage]}</small>
                          </span>
                        </>
                      )}
                      {option.kind === 'complex' && (
                        <>
                          <span className={styles.pin} aria-hidden="true"><MapPin size={18} /></span>
                          <span className={styles.text}>
                            <small className={styles.city}>{option.complex.city}</small>
                            <strong>{option.complex.name}{selectedComplexIds.includes(option.complex.id) && <span className="badge">Elegido</span>}</strong>
                            {option.complex.formats.length > 0 && (
                              <span className={styles.complexFormats}>
                                {option.complex.formats.map(format => <span key={format.code}>{format.name}</span>)}
                              </span>
                            )}
                            <span className="visually-hidden">Formatos: {complexFormats(option.complex)}</span>
                          </span>
                        </>
                      )}
                      {option.kind === 'format' && option.format.name}
                    </li>
                  )
                })}
              </ul>
            </li>
          ))}
        </ul>
        {searching && !flat.length && <p className={styles.empty}>No encontramos películas, cines ni formatos con «{term}».</p>}
      </div>
    </div>
  )
}
