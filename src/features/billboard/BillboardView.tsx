import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { LayoutGrid, List, MapPin, SlidersHorizontal, X } from 'lucide-react'
import DateStrip from './DateStrip'
import ShowtimeGroups from './ShowtimeGroups'
import { CATEGORIES, DAYPARTS, FILTER_GROUPS, facetOptions, matchesCategory, matchesFilters, useQueryList, useQueryParam, type FilterGroup, type FilterOption, type ScreeningFilters } from './filters'
import { useScheduleDays } from './dates'
import PosterArt from '@/shared/ui/PosterArt'
import StateView from '@/shared/ui/StateView'
import { useMovies, useScreenings } from '@/app/queries'
import { useAppStore } from '@/app/stores/app'
import { STAGE_LABELS, durationLabel } from '@/domain/labels'
import { formatDate } from '@/shared/lib/datetime'
import { cx } from '@/shared/lib/cx'
import type { Screening } from '@/domain/models'
import styles from './BillboardView.module.css'

export default function BillboardView() {
  const selectedComplexes = useAppStore(state => state.selectedComplexes)
  const selectedComplexIds = useAppStore(state => state.selectedComplexIds)
  const allFormats = useAppStore(state => state.allFormats)
  const askForComplexes = useAppStore(state => state.askForComplexes)
  const navigate = useNavigate()
  const [, setParams] = useSearchParams()
  const { today, days, timeZone } = useScheduleDays()

  const [date, setDate] = useQueryParam('fecha', today)
  const [category, setCategory] = useQueryParam('categoria', 'todas')
  const [view, setView] = useQueryParam('vista', 'lista')
  const [roomTypes, setRoomTypes] = useQueryList('sala')
  const [projections, setProjections] = useQueryList('proyeccion')
  const [languages, setLanguages] = useQueryList('idioma')
  const [dayparts, setDayparts] = useQueryList('horario')
  const setters: Record<FilterGroup, (values: string[]) => void> = { roomTypes: setRoomTypes, projections: setProjections, languages: setLanguages, dayparts: setDayparts }
  const [showFilters, setShowFilters] = useState(false)

  const movies = useMovies(selectedComplexIds)
  const screenings = useScreenings(selectedComplexIds, date)

  const comingSoon = category === 'coming-soon'
  const needsComplex = !comingSoon && !selectedComplexIds.length
  const filters = useMemo<ScreeningFilters>(() => ({ roomTypes, projections, languages, dayparts }),
    // Las listas se recrean en cada render; se comparan por contenido.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [roomTypes.join(), projections.join(), languages.join(), dayparts.join()])
  const activeCount = FILTER_GROUPS.reduce((sum, group) => sum + filters[group.key].length, 0)

  const categoryMovies = useMemo(() => (movies.data ?? []).filter(movie => matchesCategory(movie, category)), [movies.data, category])
  /** Funciones del día de las películas de la categoría: sobre ellas se cuentan las opciones de filtro. */
  const daily = useMemo(() => {
    const ids = new Set(categoryMovies.map(movie => movie.id))
    return (screenings.data ?? []).filter(item => ids.has(item.movieId))
  }, [categoryMovies, screenings.data])

  const rows = useMemo(() => {
    if (comingSoon) return categoryMovies.map(movie => ({ movie, screenings: [] as Screening[] }))
    return categoryMovies
      .map(movie => ({ movie, screenings: daily.filter(item => item.movieId === movie.id && matchesFilters(item, filters, timeZone)) }))
      .filter(row => row.screenings.length > 0)
  }, [comingSoon, categoryMovies, daily, filters, timeZone])

  const formatName = (code: string) => allFormats.find(format => format.code === code)?.name ?? code
  const facets = Object.fromEntries(FILTER_GROUPS.map(group => [group.key, facetOptions(daily, filters, group.key, timeZone, formatName)])) as Record<FilterGroup, FilterOption[]>

  const activeChips = FILTER_GROUPS.flatMap(group => filters[group.key].map(value => ({
    group: group.key,
    value,
    label: group.key === 'dayparts'
      ? DAYPARTS.find(part => part.value === value)?.label ?? value
      : facets[group.key].find(option => option.value === value)?.label ?? formatName(value)
  })))

  function toggle(group: FilterGroup, value: string, checked: boolean) {
    const current = filters[group]
    setters[group](checked ? [...current, value] : current.filter(item => item !== value))
  }
  function clearFilters() {
    const next = new URLSearchParams()
    if (date !== today) next.set('fecha', date)
    if (category !== 'todas') next.set('categoria', category)
    if (view !== 'lista') next.set('vista', view)
    setParams(next, { replace: true, preventScrollReset: true })
  }
  const pick = (screening: Screening) => { void navigate(`/compra/${screening.id}`) }
  const loading = movies.isPending || (!comingSoon && screenings.isPending)
  const error = movies.error ?? screenings.error
  function retry() {
    void movies.refetch()
    void screenings.refetch()
  }
  const withFilters = !comingSoon && !needsComplex

  return (
    <div className="container page">
      <p className="eyebrow">Cartelera</p>
      <h1 className="page-title">Elige tu función</h1>
      {selectedComplexes.length > 0 && (
        <p className={`page-lead ${styles.where}`}><MapPin size={16} aria-hidden="true" /> {selectedComplexes.map(complex => complex.name).join(' · ')}</p>
      )}

      <div className={cx(styles.layout, withFilters && styles.withFilters)}>
        {withFilters && (
          <aside id="filtros" className={cx(styles.sidebar, showFilters && styles.open)} aria-label="Filtros">
            <div className={`card ${styles.filters}`}>
              <div className={styles.filtersHead}>
                <h2><SlidersHorizontal size={18} aria-hidden="true" /> Filtros</h2>
                {activeCount > 0 && <button type="button" className="btn btn-ghost btn-small" onClick={clearFilters}>Quitar todos</button>}
              </div>
              <p className={styles.filtersHelp}>Marca varias opciones a la vez.</p>
              {FILTER_GROUPS.map(group => (
                <fieldset key={group.key} className={styles.group}>
                  <legend>{group.title}</legend>
                  {facets[group.key].map(option => {
                    const checked = filters[group.key].includes(option.value)
                    const off = !option.count && !checked
                    return (
                      <label key={option.value} className={cx(styles.check, checked && styles.checked, off && styles.off)}>
                        <input type="checkbox" checked={checked} disabled={off} onChange={event => toggle(group.key, option.value, event.target.checked)} />
                        <span className={styles.text}>{option.label}{option.hint && <small>{option.hint}</small>}</span>
                        <span className={styles.count} aria-label={`${option.count} funciones`}>{option.count}</span>
                      </label>
                    )
                  })}
                  {!facets[group.key].length && <p className={`muted ${styles.none}`}>Sin opciones este día.</p>}
                </fieldset>
              ))}
            </div>
          </aside>
        )}

        <div className={styles.main}>
          <div className={`card ${styles.tools}`}>
            {withFilters && <DateStrip value={date} onChange={setDate} days={days} today={today} />}
            <div className="chip-row" role="group" aria-label="Categoría">
              {CATEGORIES.map(item => (
                <button key={item.value} type="button" className="chip" aria-pressed={category === item.value} onClick={() => setCategory(item.value)}>{item.label}</button>
              ))}
            </div>
            {withFilters && (
              <div className={styles.bottom}>
                <button type="button" className={`btn btn-small btn-secondary ${styles.filtersToggle}`} aria-expanded={showFilters} aria-controls="filtros" onClick={() => setShowFilters(!showFilters)}>
                  <SlidersHorizontal size={16} /> Filtros{activeCount > 0 && <span> ({activeCount})</span>}
                </button>
                <span className="muted">{formatDate(date)} · {rows.length} {rows.length === 1 ? 'película' : 'películas'}</span>
                <div className={styles.viewToggle} role="group" aria-label="Vista">
                  <button type="button" aria-pressed={view === 'lista'} aria-label="Vista de lista" onClick={() => setView('lista')}><List size={18} /></button>
                  <button type="button" aria-pressed={view === 'cuadricula'} aria-label="Vista de cuadrícula" onClick={() => setView('cuadricula')}><LayoutGrid size={18} /></button>
                </div>
              </div>
            )}
            {activeChips.length > 0 && !needsComplex && (
              <ul className={styles.active} role="list" aria-label="Filtros aplicados">
                {activeChips.map(chip => (
                  <li key={`${chip.group}-${chip.value}`}>
                    <button type="button" className={styles.activeChip} aria-label={`Quitar filtro ${chip.label}`} onClick={() => toggle(chip.group, chip.value, false)}>{chip.label} <X size={14} /></button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {needsComplex
            ? (
              <div className={`card ${styles.choose}`}>
                <MapPin size={32} aria-hidden="true" />
                <h2>Elige tus cines para ver los horarios</h2>
                <p className="muted">Puedes elegir uno o varios cines de una misma ciudad.</p>
                <button type="button" className="btn btn-primary" onClick={() => askForComplexes()}>Elegir cines</button>
              </div>
            )
            : (
              <StateView loading={loading} error={error} empty={!rows.length} skeleton="rows" onRetry={retry}
                emptyTitle={activeCount ? 'Ninguna función cumple estos filtros' : 'No hay funciones con estos criterios'}
                emptyText={activeCount ? 'Desmarca algún filtro o prueba con otra fecha.' : 'Prueba con otra fecha, otra categoría u otros cines.'}>
                <ul className={cx(styles.movies, styles[view])} role="list">
                  {rows.map(({ movie, screenings: items }) => (
                    <li key={movie.id} className={`card ${styles.movie}`}>
                      <Link to={`/peliculas/${movie.slug}`} className={styles.posterLink} aria-label={`Ver ${movie.title}`}>
                        <PosterArt title={movie.title} accent={movie.accent} rating={movie.rating.code} src={movie.posterUrl} decorative />
                      </Link>
                      <div className={styles.info}>
                        <span className="badge">{movie.isSpecialEvent ? 'Evento especial' : STAGE_LABELS[movie.stage]}</span>
                        <h2><Link to={`/peliculas/${movie.slug}`}>{movie.title}</Link></h2>
                        <p className={styles.meta}>
                          <span className="badge badge-rating">{movie.rating.code}</span>
                          {movie.genres.join(', ')} · {durationLabel(movie.durationMinutes)}
                        </p>
                        {view === 'lista' && <p className={styles.synopsis}>{movie.synopsis}</p>}
                        {!items.length
                          ? <p className="notice">Estreno el {formatDate(movie.releaseDate)}. La venta aún no inicia.</p>
                          : view === 'lista'
                            ? <ShowtimeGroups screenings={items} showLegend={false} onPick={pick} />
                            : <Link to={`/peliculas/${movie.slug}?fecha=${date}`} className="btn btn-small btn-secondary">{items.length} horarios</Link>}
                      </div>
                    </li>
                  ))}
                </ul>
              </StateView>
            )}
        </div>
      </div>
    </div>
  )
}
