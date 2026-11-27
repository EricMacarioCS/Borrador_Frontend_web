/**
 * Mapa de la sala. Se navega con flechas (un solo punto de tabulación) y cada estado
 * se distingue por color, forma y texto, no solo por color.
 */
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { Accessibility, Armchair, Minus, Plus } from 'lucide-react'
import type { SeatCell, SeatLayout, SeatStatus } from '@/domain/models'
import { cx } from '@/shared/lib/cx'
import styles from './SeatMap.module.css'

interface Props {
  layout: SeatLayout
  statuses: Record<string, SeatStatus>
  /** Asientos que pertenecen a este cliente: su apartado más la selección local. */
  selected: Set<string>
  limitReached: boolean
  onToggle: (seat: SeatCell) => void
}

const ZOOMS = [1, 1.25, 1.5]
type State = 'available' | 'selected' | 'taken'

export default function SeatMap({ layout, statuses, selected, limitReached, onToggle }: Props) {
  const [zoom, setZoom] = useState(0)
  const [focusId, setFocusId] = useState<string | null>(null)
  const grid = useRef<HTMLDivElement>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const pendingFocus = useRef<string | null>(null)

  // Si la sala no cabe completa, se empieza viendo el centro, frente a la pantalla.
  useEffect(() => {
    const el = scroller.current
    if (el && el.scrollWidth > el.clientWidth) el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2
  }, [])

  // El foco se mueve después de que el asiento nuevo recibe tabIndex 0.
  useEffect(() => {
    const id = pendingFocus.current
    if (!id) return
    pendingFocus.current = null
    grid.current?.querySelector<HTMLElement>(`[data-seat="${CSS.escape(id)}"]`)?.focus()
  }, [focusId])

  function stateOf(seat: SeatCell): State {
    if (selected.has(seat.id)) return 'selected'
    return (statuses[seat.id] ?? 'available') === 'available' ? 'available' : 'taken'
  }
  const disabled = (seat: SeatCell) => stateOf(seat) === 'taken' || (stateOf(seat) === 'available' && limitReached)

  // La simbología solo menciona silla de ruedas si el plano tiene esos lugares.
  const hasAccessible = layout.rows.some(row => row.cells.some(cell => cell?.kind === 'accessible'))
  const firstSeat = layout.rows.flatMap(row => row.cells).find(cell => cell && stateOf(cell) !== 'taken') ?? null
  const tabTarget = focusId ?? firstSeat?.id ?? null

  function label(seat: SeatCell) {
    const state = stateOf(seat)
    const kind = seat.kind === 'accessible' ? ', lugar para silla de ruedas' : seat.kind === 'companion' ? ', lugar de acompañante' : ''
    return `${seat.label}${kind}, ${state === 'selected' ? 'seleccionado' : state === 'taken' ? 'ocupado' : 'disponible'}`
  }

  function move(rowIndex: number, cellIndex: number, dRow: number, dCol: number) {
    const rows = layout.rows
    let r = rowIndex
    let c = cellIndex
    for (let guard = 0; guard < 400; guard++) {
      r += dRow
      c += dCol
      if (r < 0 || r >= rows.length) return
      const row = rows[r]!
      if (dRow !== 0) c = Math.min(Math.max(c, 0), row.cells.length - 1)
      if (c < 0 || c >= row.cells.length) return
      // Al bajar o subir se busca el asiento más cercano en esa fila.
      let target = row.cells[c]
      if (!target && dRow !== 0) {
        for (let offset = 1; offset < row.cells.length && !target; offset++) target = row.cells[c - offset] ?? row.cells[c + offset]
      }
      if (target) {
        pendingFocus.current = target.id
        if (target.id === focusId) grid.current?.querySelector<HTMLElement>(`[data-seat="${CSS.escape(target.id)}"]`)?.focus()
        setFocusId(target.id)
        return
      }
    }
  }

  function onKey(event: KeyboardEvent, rowIndex: number, cellIndex: number) {
    const moves: Record<string, [number, number]> = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] }
    const step = moves[event.key]
    if (step) {
      event.preventDefault()
      move(rowIndex, cellIndex, step[0], step[1])
    }
  }

  return (
    <div>
      <div className={styles.toolbar}>
        <ul className={styles.legend} role="list" aria-label="Simbología">
          <li><span className={cx(styles.seat, styles.key, styles.available)} aria-hidden="true"><Armchair /></span> Disponible</li>
          <li><span className={cx(styles.seat, styles.key, styles.selected)} aria-hidden="true"><Armchair /></span> Tu selección</li>
          <li><span className={cx(styles.seat, styles.key, styles.taken)} aria-hidden="true"><Armchair /></span> Ocupado</li>
          {hasAccessible && <li><span className={cx(styles.seat, styles.key, styles.available, styles.accessible)} aria-hidden="true"><Accessibility /></span> Silla de ruedas</li>}
        </ul>
        <div className={styles.zoom} role="group" aria-label="Acercamiento">
          <button type="button" disabled={zoom === 0} aria-label="Alejar" onClick={() => setZoom(zoom - 1)}><Minus size={16} /></button>
          <span aria-live="polite">{Math.round(ZOOMS[zoom]! * 100)} %</span>
          <button type="button" disabled={zoom === ZOOMS.length - 1} aria-label="Acercar" onClick={() => setZoom(zoom + 1)}><Plus size={16} /></button>
        </div>
      </div>
      <div ref={scroller} className={styles.scroller}>
        <div className={styles.room} style={{ '--zoom': ZOOMS[zoom] } as CSSProperties}>
          <div className={styles.screen} aria-hidden="true">PANTALLA</div>
          <div ref={grid} role="grid" aria-label="Asientos de la sala" className={styles.rows}>
            {layout.rows.map((row, rowIndex) => (
              <div key={row.label} role="row" className={styles.row}>
                <span className={styles.rowLabel} role="rowheader">{row.label}</span>
                {row.cells.map((cell, cellIndex) => {
                  if (!cell) return <span key={`${row.label}-gap-${cellIndex}`} className={styles.gap} role="presentation" />
                  const state = stateOf(cell)
                  const off = disabled(cell)
                  const Icon = cell.kind === 'accessible' ? Accessibility : Armchair
                  return (
                    <span key={cell.id} role="gridcell">
                      <button type="button" className={cx(styles.seat, styles[state], styles[cell.kind])} data-seat={cell.id}
                        tabIndex={tabTarget === cell.id ? 0 : -1} aria-label={label(cell)} aria-pressed={state === 'selected'}
                        aria-disabled={off || undefined}
                        onFocus={() => setFocusId(cell.id)} onKeyDown={event => onKey(event, rowIndex, cellIndex)}
                        onClick={() => { if (!off) onToggle(cell) }}>
                        <Icon aria-hidden="true" />
                      </button>
                    </span>
                  )
                })}
                <span className={styles.rowLabel} aria-hidden="true">{row.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
