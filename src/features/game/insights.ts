import { analyze, capturesFor, degrees } from '../../core/analysis.ts'
import { tablesFor } from '../../core/board.ts'
import type { Move, Position } from '../../core/types.ts'

/** Consecutive scoring moves from one player, including a double capture. */
export function captureRun(moves: readonly Move[]): number {
  const last = moves.at(-1)
  if (!last?.captured.length) return 0
  let boxes = 0
  for (let i = moves.length - 1; i >= 0; i--) {
    const move = moves[i]
    if (move.player !== last.player || move.captured.length === 0) break
    boxes += move.captured.length
  }
  return boxes
}

export function edgeInsight(position: Position, edge: number): 'capture' | 'risk' | 'safe' | null {
  if (!Number.isInteger(edge) || edge < 0 || edge >= position.edges.length || position.edges[edge] !== 0) return null
  const deg = degrees(position)
  if (capturesFor(position, edge, deg) > 0) return 'capture'
  const { edgeBoxes } = tablesFor(position.size)
  for (let k = 0; k < 2; k++) {
    const box = edgeBoxes[edge * 2 + k]
    if (box >= 0 && deg[box] === 2) return 'risk'
  }
  return 'safe'
}

export function boardInsight(position: Position) {
  const analysis = analyze(position)
  return {
    safe: analysis.safeEdges.length,
    captures: analysis.capturingEdges.length,
    claimed: position.boxes.length - analysis.remainingBoxes,
  }
}
