import { describe, expect, it } from 'vitest'
import { hEdge, vEdge } from '../board.ts'
import { applyMove, createPosition } from '../rules.ts'
import {
  analyze,
  capturingEdges,
  degrees,
  endgameState,
  endgameValue,
  safeEdges,
} from '../analysis.ts'
import type { BoardSize, Position } from '../types.ts'

function draw(position: Position, edges: number[]): Position {
  // Bypasses turn order — these fixtures care only about board shape.
  const next = new Uint8Array(position.edges)
  for (const e of edges) next[e] = 1
  const boxes = new Int8Array(position.boxes)
  return { ...position, edges: next, boxes }
}

describe('degrees and captures', () => {
  const size: BoardSize = { rows: 2, cols: 2 }

  it('counts undrawn edges per box', () => {
    const p = createPosition(size)
    expect(Array.from(degrees(p))).toEqual([4, 4, 4, 4])
    const after = applyMove(p, hEdge(size, 0, 0)).position
    expect(degrees(after)[0]).toBe(3)
  })

  it('finds the edge that closes a box', () => {
    const p = draw(createPosition(size), [hEdge(size, 0, 0), hEdge(size, 1, 0), vEdge(size, 0, 0)])
    expect(capturingEdges(p)).toEqual([vEdge(size, 0, 1)])
  })

  it('treats every move as unsafe once a box has two edges left', () => {
    const p = draw(createPosition(size), [hEdge(size, 0, 0), hEdge(size, 1, 0)])
    // Box 0 now sits at degree 2: its remaining edges are loony.
    expect(safeEdges(p)).not.toContain(vEdge(size, 0, 0))
  })
})

describe('chain and loop decomposition', () => {
  it('finds a single long chain', () => {
    const size: BoardSize = { rows: 1, cols: 3 }
    // Draw every horizontal edge: three boxes joined in a row, both ends grounded.
    const horizontals = [0, 1, 2, 3, 4, 5].map((i) => hEdge(size, Math.floor(i / 3), i % 3))
    const p = draw(createPosition(size), horizontals)

    const a = analyze(p)
    expect(a.isEndgame).toBe(true)
    expect(a.capturable).toHaveLength(0)
    expect(a.components).toHaveLength(1)
    expect(a.components[0]).toMatchObject({ length: 3, isLoop: false })
    expect(a.longChains).toBe(1)
    expect(a.loops).toBe(0)
    expect(a.safeEdges).toHaveLength(0) // every remaining move is loony
  })

  it('finds a four-box loop', () => {
    const size: BoardSize = { rows: 2, cols: 2 }
    const border = [
      hEdge(size, 0, 0), hEdge(size, 0, 1),
      hEdge(size, 2, 0), hEdge(size, 2, 1),
      vEdge(size, 0, 0), vEdge(size, 1, 0),
      vEdge(size, 0, 2), vEdge(size, 1, 2),
    ]
    const p = draw(createPosition(size), border)

    const a = analyze(p)
    expect(a.isEndgame).toBe(true)
    expect(a.components).toHaveLength(1)
    expect(a.components[0]).toMatchObject({ length: 4, isLoop: true })
    expect(a.loops).toBe(1)
    expect(endgameState(p)).toEqual({ chains: [], loops: [4] })
  })

  it('reports no endgame while boxes still have three or four open edges', () => {
    const a = analyze(createPosition({ rows: 3, cols: 3 }))
    expect(a.isEndgame).toBe(false)
    expect(a.components).toHaveLength(0)
    expect(a.safeEdges.length).toBe(24) // nothing can be given away yet
  })
})

describe('controlled endgame solver', () => {
  it('is zero on an empty state', () => {
    expect(endgameValue({ chains: [], loops: [] })).toBe(0)
  })

  it('gives away a lone chain entirely', () => {
    // The opener must open; the opponent simply takes all three boxes.
    expect(endgameValue({ chains: [3], loops: [] })).toBe(-3)
  })

  it('rewards the double-cross with two chains', () => {
    // Opponent takes 1, declines 2, and the opener has to open the second chain.
    expect(endgameValue({ chains: [3, 3], loops: [] })).toBe(-2)
  })

  it('values a lone loop at its full length', () => {
    expect(endgameValue({ chains: [], loops: [4] })).toBe(-4)
  })

  it('prefers the least damaging component to open', () => {
    // Opening the loop concedes 4-3; opening the chain concedes 5-2.
    expect(endgameValue({ chains: [3], loops: [4] })).toBe(-1)
  })

  it('lets short chains keep the opener alive', () => {
    // A 1-box chain is a free tempo move: give it up, then take the long chain.
    expect(endgameValue({ chains: [1, 5], loops: [] })).toBe(4)
  })

  it('never exceeds the number of boxes on the table', () => {
    const state = { chains: [2, 3, 5], loops: [6] }
    const total = 2 + 3 + 5 + 6
    const value = endgameValue(state)
    expect(Math.abs(value)).toBeLessThanOrEqual(total)
    expect((total - value) % 2).toBe(0) // value and total share parity
  })
})
