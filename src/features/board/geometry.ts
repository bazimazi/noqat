/**
 * Screen geometry for the board, plus the lattice model that keyboard
 * navigation walks.
 *
 * The board is drawn in "dot units": one unit is the distance between two
 * neighbouring dots, and the SVG viewBox does the scaling. That keeps every
 * theme's stroke widths and insets expressible as plain fractions.
 */
import { tablesFor } from '../../core/board.ts'
import type { BoardSize, EdgeId } from '../../core/types.ts'

export interface EdgeLayout {
  readonly id: EdgeId
  readonly orientation: 'h' | 'v'
  readonly x1: number
  readonly y1: number
  readonly x2: number
  readonly y2: number
  readonly cx: number
  readonly cy: number
  /** Dot-grid row/col, used for accessible labels. */
  readonly row: number
  readonly col: number
}

export interface BoxLayout {
  readonly id: number
  readonly x: number
  readonly y: number
  readonly row: number
  readonly col: number
}

export interface BoardLayout {
  readonly size: BoardSize
  readonly padding: number
  readonly width: number
  readonly height: number
  readonly viewBox: string
  readonly edges: readonly EdgeLayout[]
  readonly boxes: readonly BoxLayout[]
  readonly dots: readonly { x: number; y: number }[]
}

const cache = new Map<string, BoardLayout>()

export function layoutFor(size: BoardSize, padding = 0.55): BoardLayout {
  const key = `${size.rows}x${size.cols}@${padding}`
  const cached = cache.get(key)
  if (cached) return cached

  const tables = tablesFor(size)
  const edges: EdgeLayout[] = tables.geometry.map((geo) => {
    const horizontal = geo.orientation === 'h'
    const x1 = horizontal ? geo.col : geo.col
    const y1 = horizontal ? geo.row : geo.row
    const x2 = horizontal ? geo.col + 1 : geo.col
    const y2 = horizontal ? geo.row : geo.row + 1
    return {
      id: geo.id,
      orientation: geo.orientation,
      x1,
      y1,
      x2,
      y2,
      cx: (x1 + x2) / 2,
      cy: (y1 + y2) / 2,
      row: geo.row,
      col: geo.col,
    }
  })

  const boxes: BoxLayout[] = []
  for (let r = 0; r < size.rows; r++) {
    for (let c = 0; c < size.cols; c++) {
      boxes.push({ id: r * size.cols + c, x: c, y: r, row: r, col: c })
    }
  }

  const dots: { x: number; y: number }[] = []
  for (let r = 0; r <= size.rows; r++) {
    for (let c = 0; c <= size.cols; c++) dots.push({ x: c, y: r })
  }

  const layout: BoardLayout = {
    size,
    padding,
    width: size.cols,
    height: size.rows,
    viewBox: `${-padding} ${-padding} ${size.cols + padding * 2} ${size.rows + padding * 2}`,
    edges,
    boxes,
    dots,
  }
  cache.set(key, layout)
  return layout
}

/* ------------------------------------------------------------------ *
 * keyboard lattice
 * ------------------------------------------------------------------ */

/**
 * Keyboard navigation walks an interleaved lattice of size
 * `(2*rows+1) x (2*cols+1)`:
 *
 *   even row, odd col  → horizontal edge
 *   odd row, even col  → vertical edge
 *   even row, even col → dot        (skipped)
 *   odd row, odd col   → box centre (skipped)
 *
 * Arrow keys step by one and keep stepping until they land on an edge, which
 * makes movement feel like "next line in that direction" rather than "next
 * cell", and never strands focus on something you cannot play.
 */
export interface LatticePoint {
  readonly i: number
  readonly j: number
}

export function edgeToLattice(size: BoardSize, edge: EdgeId): LatticePoint {
  const geo = tablesFor(size).geometry[edge]
  return geo.orientation === 'h'
    ? { i: geo.row * 2, j: geo.col * 2 + 1 }
    : { i: geo.row * 2 + 1, j: geo.col * 2 }
}

export function latticeToEdge(size: BoardSize, point: LatticePoint): EdgeId | null {
  const { i, j } = point
  if (i < 0 || j < 0 || i > size.rows * 2 || j > size.cols * 2) return null
  const tables = tablesFor(size)
  if (i % 2 === 0 && j % 2 === 1) {
    const row = i / 2
    const col = (j - 1) / 2
    return row * size.cols + col
  }
  if (i % 2 === 1 && j % 2 === 0) {
    const row = (i - 1) / 2
    const col = j / 2
    return tables.edgeCount - size.rows * (size.cols + 1) + row * (size.cols + 1) + col
  }
  return null
}

export type Direction = 'up' | 'down' | 'left' | 'right'

const STEP: Record<Direction, [number, number]> = {
  up: [-1, 0],
  down: [1, 0],
  left: [0, -1],
  right: [0, 1],
}

/**
 * Moves from `edge` one step in `direction`, returning the next playable edge
 * or `null` when there is nowhere to go.
 *
 * Two moves, in priority order:
 *
 *  1. **Along the grain** — two lattice cells in the arrow's direction, which
 *     always lands on an edge of the *same* orientation. This is what people
 *     expect: pressing Right on a horizontal edge walks along the row.
 *  2. **Across the grain** — if step 1 runs off the board, one cell diagonally,
 *     which lands on the *perpendicular* family.
 *
 * The fallback is not a nicety. Walking only along the grain partitions the
 * board into two components a keyboard user can never cross, leaving the whole
 * bottom row and last column unreachable; the connectivity test in
 * `Board.test.tsx` exists to keep that from creeping back.
 *
 * `rtl` mirrors the horizontal axis so "left" always means "towards the start
 * of the line" for the reader.
 */
export function stepEdge(
  size: BoardSize,
  edge: EdgeId,
  direction: Direction,
  rtl = false,
): EdgeId | null {
  const effective: Direction =
    rtl && direction === 'left' ? 'right' : rtl && direction === 'right' ? 'left' : direction

  const { i, j } = edgeToLattice(size, edge)
  const maxI = size.rows * 2
  const maxJ = size.cols * 2
  const [di, dj] = STEP[effective]

  const at = (ni: number, nj: number): EdgeId | null => {
    if (ni < 0 || nj < 0 || ni > maxI || nj > maxJ) return null
    return latticeToEdge(size, { i: ni, j: nj })
  }

  const alongGrain = at(i + di * 2, j + dj * 2)
  if (alongGrain !== null) return alongGrain

  // Across the grain: prefer the neighbour on the reader's leading side.
  const lead = rtl ? 1 : -1
  if (di !== 0) {
    return at(i + di, j + lead) ?? at(i + di, j - lead)
  }
  return at(i - 1, j + dj) ?? at(i + 1, j + dj)
}

/** The first free edge at or after `from`, scanning in play order. */
export function nextFreeEdge(
  edges: Uint8Array,
  from: EdgeId,
  step: 1 | -1 = 1,
): EdgeId | null {
  const n = edges.length
  for (let k = 1; k <= n; k++) {
    const index = (((from + step * k) % n) + n) % n
    if (edges[index] === 0) return index
  }
  return null
}
