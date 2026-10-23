/** Mirrored paths inspired by the four-part layout of a Persian garden. */
import { hEdge, tablesFor, vEdge } from './board.ts'
import type { BoardSize } from './types.ts'
import { createRng } from '../lib/rng.ts'

/**
 * Creates a seeded opening with horizontal and vertical reflection symmetry.
 * Every box has at most two sides, so neither player receives a free capture.
 * Complete symmetry orbits are accepted together, preserving the pattern even
 * on rectangular and very small boards.
 */
export function gardenOpening(size: BoardSize, seed: number): number[] {
  const tables = tablesFor(size)
  const seen = new Set<number>()
  const orbits: number[][] = []
  for (const edge of tables.geometry) {
    if (seen.has(edge.id)) continue
    const reflected = edge.orientation === 'h'
      ? [
          hEdge(size, edge.row, edge.col),
          hEdge(size, size.rows - edge.row, edge.col),
          hEdge(size, edge.row, size.cols - 1 - edge.col),
          hEdge(size, size.rows - edge.row, size.cols - 1 - edge.col),
        ]
      : [
          vEdge(size, edge.row, edge.col),
          vEdge(size, size.rows - 1 - edge.row, edge.col),
          vEdge(size, edge.row, size.cols - edge.col),
          vEdge(size, size.rows - 1 - edge.row, size.cols - edge.col),
        ]
    const orbit = [...new Set(reflected)]
    orbit.forEach((id) => seen.add(id))
    orbits.push(orbit)
  }

  const sides = new Uint8Array(tables.boxCount)
  const opening: number[] = []
  const target = Math.max(4, Math.round(tables.edgeCount * 0.22))
  for (const orbit of createRng(seed).shuffle(orbits)) {
    const added = new Uint8Array(tables.boxCount)
    for (const edge of orbit) {
      for (let k = 0; k < 2; k++) {
        const box = tables.edgeBoxes[edge * 2 + k]
        if (box >= 0) added[box]++
      }
    }
    if (sides.some((count, box) => count + added[box] > 2)) continue
    opening.push(...orbit)
    added.forEach((count, box) => { sides[box] += count })
    if (opening.length >= target) break
  }
  return opening.sort((a, b) => a - b)
}
