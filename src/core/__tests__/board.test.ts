import { describe, expect, it } from 'vitest'
import {
  boxAt,
  edgeCount,
  edgeEndpoints,
  hEdge,
  horizontalEdgeCount,
  isHorizontal,
  tablesFor,
  vEdge,
  verticalEdgeCount,
} from '../board.ts'
import type { BoardSize } from '../types.ts'

const size: BoardSize = { rows: 3, cols: 4 }

describe('board geometry', () => {
  it('counts edges correctly', () => {
    expect(horizontalEdgeCount(size)).toBe(4 * 4) // (rows+1) * cols
    expect(verticalEdgeCount(size)).toBe(3 * 5) // rows * (cols+1)
    expect(edgeCount(size)).toBe(31)
  })

  it('assigns unique ids to every edge', () => {
    const seen = new Set<number>()
    for (let r = 0; r <= size.rows; r++) {
      for (let c = 0; c < size.cols; c++) seen.add(hEdge(size, r, c))
    }
    for (let r = 0; r < size.rows; r++) {
      for (let c = 0; c <= size.cols; c++) seen.add(vEdge(size, r, c))
    }
    expect(seen.size).toBe(edgeCount(size))
    expect(Math.max(...seen)).toBe(edgeCount(size) - 1)
  })

  it('separates horizontal and vertical id ranges', () => {
    expect(isHorizontal(size, hEdge(size, 2, 1))).toBe(true)
    expect(isHorizontal(size, vEdge(size, 2, 1))).toBe(false)
  })

  it('links each box to its four edges and back again', () => {
    const tables = tablesFor(size)
    for (let r = 0; r < size.rows; r++) {
      for (let c = 0; c < size.cols; c++) {
        const box = boxAt(size, r, c)
        const edges = [
          tables.boxEdges[box * 4 + 0],
          tables.boxEdges[box * 4 + 1],
          tables.boxEdges[box * 4 + 2],
          tables.boxEdges[box * 4 + 3],
        ]
        expect(new Set(edges).size).toBe(4)
        for (const e of edges) {
          const neighbours = [tables.edgeBoxes[e * 2], tables.edgeBoxes[e * 2 + 1]]
          expect(neighbours).toContain(box)
        }
      }
    }
  })

  it('gives border edges one neighbour and interior edges two', () => {
    const tables = tablesFor(size)
    expect(tables.edgeDegree[hEdge(size, 0, 0)]).toBe(1)
    expect(tables.edgeDegree[hEdge(size, 1, 0)]).toBe(2)
    expect(tables.edgeDegree[vEdge(size, 0, 0)]).toBe(1)
    expect(tables.edgeDegree[vEdge(size, 0, 2)]).toBe(2)
  })

  it('produces unit-length endpoints in dot coordinates', () => {
    expect(edgeEndpoints(size, hEdge(size, 1, 2))).toEqual({ x1: 2, y1: 1, x2: 3, y2: 1 })
    expect(edgeEndpoints(size, vEdge(size, 1, 2))).toEqual({ x1: 2, y1: 1, x2: 2, y2: 2 })
  })

  it('memoises tables per size', () => {
    expect(tablesFor({ rows: 3, cols: 4 })).toBe(tablesFor({ rows: 3, cols: 4 }))
  })
})
