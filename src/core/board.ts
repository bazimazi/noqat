/**
 * Board geometry: the pure, allocation-light mapping between boxes, edges and
 * dots. Every lookup table for a given size is built once and memoised, because
 * the AI walks these tables millions of times per search.
 */
import type { BoardSize, BoxId, EdgeGeometry, EdgeId, EdgeOrientation } from './types.ts'

export const MIN_BOARD = 2
export const MAX_BOARD = 12

export function boardKey(size: BoardSize): string {
  return `${size.rows}x${size.cols}`
}

export function horizontalEdgeCount(size: BoardSize): number {
  return (size.rows + 1) * size.cols
}

export function verticalEdgeCount(size: BoardSize): number {
  return size.rows * (size.cols + 1)
}

export function edgeCount(size: BoardSize): number {
  return horizontalEdgeCount(size) + verticalEdgeCount(size)
}

export function boxCount(size: BoardSize): number {
  return size.rows * size.cols
}

/** Horizontal edge on the dot-row `row` (0..rows) spanning box column `col`. */
export function hEdge(size: BoardSize, row: number, col: number): EdgeId {
  return row * size.cols + col
}

/** Vertical edge in box-row `row` (0..rows-1) at dot-column `col` (0..cols). */
export function vEdge(size: BoardSize, row: number, col: number): EdgeId {
  return horizontalEdgeCount(size) + row * (size.cols + 1) + col
}

export function isHorizontal(size: BoardSize, edge: EdgeId): boolean {
  return edge < horizontalEdgeCount(size)
}

export function boxAt(size: BoardSize, row: number, col: number): BoxId {
  return row * size.cols + col
}

export function boxRow(size: BoardSize, box: BoxId): number {
  return Math.floor(box / size.cols)
}

export function boxCol(size: BoardSize, box: BoxId): number {
  return box % size.cols
}

export interface BoardTables {
  readonly size: BoardSize
  readonly edgeCount: number
  readonly boxCount: number
  /** `boxEdges[box * 4 + k]` — top, bottom, left, right. */
  readonly boxEdges: Int32Array
  /** `edgeBoxes[edge * 2 + k]` — the up-to-two adjacent boxes, `-1` when absent. */
  readonly edgeBoxes: Int32Array
  /** Number of real (non `-1`) neighbours of each edge: 1 on the border, else 2. */
  readonly edgeDegree: Uint8Array
  readonly geometry: readonly EdgeGeometry[]
}

const tableCache = new Map<string, BoardTables>()

/** Builds (and memoises) the lookup tables for a board size. */
export function tablesFor(size: BoardSize): BoardTables {
  const key = boardKey(size)
  const cached = tableCache.get(key)
  if (cached) return cached

  const nEdges = edgeCount(size)
  const nBoxes = boxCount(size)
  const boxEdges = new Int32Array(nBoxes * 4)
  const edgeBoxes = new Int32Array(nEdges * 2).fill(-1)
  const edgeDegree = new Uint8Array(nEdges)
  const geometry: EdgeGeometry[] = new Array(nEdges)

  for (let r = 0; r < size.rows; r++) {
    for (let c = 0; c < size.cols; c++) {
      const box = boxAt(size, r, c)
      boxEdges[box * 4 + 0] = hEdge(size, r, c)
      boxEdges[box * 4 + 1] = hEdge(size, r + 1, c)
      boxEdges[box * 4 + 2] = vEdge(size, r, c)
      boxEdges[box * 4 + 3] = vEdge(size, r, c + 1)
    }
  }

  for (let box = 0; box < nBoxes; box++) {
    for (let k = 0; k < 4; k++) {
      const edge = boxEdges[box * 4 + k]
      const slot = edgeDegree[edge]++
      edgeBoxes[edge * 2 + slot] = box
    }
  }

  const hCount = horizontalEdgeCount(size)
  for (let edge = 0; edge < nEdges; edge++) {
    const orientation: EdgeOrientation = edge < hCount ? 'h' : 'v'
    const local = orientation === 'h' ? edge : edge - hCount
    const stride = orientation === 'h' ? size.cols : size.cols + 1
    const boxes: BoxId[] = []
    for (let k = 0; k < 2; k++) {
      const b = edgeBoxes[edge * 2 + k]
      if (b >= 0) boxes.push(b)
    }
    geometry[edge] = {
      id: edge,
      orientation,
      row: Math.floor(local / stride),
      col: local % stride,
      boxes,
    }
  }

  const tables: BoardTables = {
    size,
    edgeCount: nEdges,
    boxCount: nBoxes,
    boxEdges,
    edgeBoxes,
    edgeDegree,
    geometry,
  }
  tableCache.set(key, tables)
  return tables
}

/**
 * Endpoint dot coordinates of an edge, in dot-grid units. Rendering multiplies
 * these by the cell pitch; the engine uses them for hit-testing and a11y labels.
 */
export function edgeEndpoints(
  size: BoardSize,
  edge: EdgeId,
): { x1: number; y1: number; x2: number; y2: number } {
  const geo = tablesFor(size).geometry[edge]
  if (geo.orientation === 'h') {
    return { x1: geo.col, y1: geo.row, x2: geo.col + 1, y2: geo.row }
  }
  return { x1: geo.col, y1: geo.row, x2: geo.col, y2: geo.row + 1 }
}

export function clampBoardSize(size: BoardSize): BoardSize {
  const clamp = (n: number) => Math.max(MIN_BOARD, Math.min(MAX_BOARD, Math.round(n) || MIN_BOARD))
  return { rows: clamp(size.rows), cols: clamp(size.cols) }
}
