/**
 * Exact loony-endgame solver.
 *
 * Once every box has at most two undrawn edges the board is nothing but chains
 * and loops, and the rest of the game is decided by a small recursion rather
 * than by tree search. This module plays that phase perfectly and instantly,
 * which is why the Grandmaster level cannot be out-played after the opening.
 *
 * The recursion has exactly two shapes:
 *  - *No captures on the table* → the position is a pure chain/loop multiset,
 *    and `endgameValue` gives the answer in closed form.
 *  - *Captures available* → branch over the (very small) set of taking and
 *    double-crossing moves, then recurse.
 */
import { endgameValue } from '../core/analysis.ts'
import type { SearchState } from './search-state.ts'

const NOT_APPLICABLE = Symbol('not-loony')

function solve(
  state: SearchState,
  buffers: number[][],
  ply: number,
  memo: Map<string, number>,
): number | typeof NOT_APPLICABLE {
  if (state.freeEdges === 0) return 0

  if (!state.hasCapture()) {
    const { chains, loops, hasBigRegion } = state.decompose()
    if (hasBigRegion) return NOT_APPLICABLE
    const key = `${chains.join(',')}|${loops.join(',')}`
    const hit = memo.get(key)
    if (hit !== undefined) return hit
    const value = endgameValue({ chains, loops })
    memo.set(key, value)
    return value
  }

  const moves = buffers[ply * 2] ?? (buffers[ply * 2] = [])
  const scratch = buffers[ply * 2 + 1] ?? (buffers[ply * 2 + 1] = [])
  state.generateMoves(moves, scratch)

  let best = -Infinity
  for (let i = 0; i < moves.length; i++) {
    const edge = moves[i]
    const captured = state.make(edge)
    const child = solve(state, buffers, ply + 1, memo)
    state.unmake(edge)
    if (child === NOT_APPLICABLE) return NOT_APPLICABLE
    const value = captured > 0 ? captured + child : -child
    if (value > best) best = value
  }
  return best === -Infinity ? 0 : best
}

export interface EndgameResult {
  readonly edge: number
  readonly value: number
  readonly nodes: number
}

/**
 * Returns the perfect move, or `null` when the position has not decomposed into
 * chains and loops yet (i.e. some box still has three or four open edges).
 */
export function solveLoonyEndgame(state: SearchState): EndgameResult | null {
  const { hasBigRegion } = state.decompose()
  if (hasBigRegion) return null

  const buffers: number[][] = []
  const memo = new Map<string, number>()
  const moves: number[] = []
  const scratch: number[] = []
  state.generateMoves(moves, scratch)
  if (moves.length === 0) return null

  let bestEdge = moves[0]
  let bestValue = -Infinity
  let nodes = 0

  for (const edge of moves) {
    const captured = state.make(edge)
    nodes++
    const child = solve(state, buffers, 1, memo)
    state.unmake(edge)
    if (child === NOT_APPLICABLE) return null
    const value = captured > 0 ? captured + child : -child
    if (value > bestValue) {
      bestValue = value
      bestEdge = edge
    }
  }

  // `-child` yields -0 when the remainder is level; normalise for callers.
  return { edge: bestEdge, value: bestValue === 0 ? 0 : bestValue, nodes: nodes + memo.size }
}

/**
 * When boxes are free, should the engine take them all or hand two back?
 * Exposed separately so the Endgame Trainer can explain the decision to the
 * player instead of just playing it.
 */
export function explainCaptureChoice(
  state: SearchState,
): { takeAll: number; doubleCross: number } | null {
  if (!state.hasCapture()) return null
  const { hasBigRegion } = state.decompose()
  if (hasBigRegion) return null

  const buffers: number[][] = []
  const memo = new Map<string, number>()
  const moves: number[] = []
  const scratch: number[] = []
  state.generateMoves(moves, scratch)

  let takeAll = -Infinity
  let doubleCross = -Infinity
  for (const edge of moves) {
    const captured = state.make(edge)
    const child = solve(state, buffers, 1, memo)
    state.unmake(edge)
    if (child === NOT_APPLICABLE) return null
    const value = captured > 0 ? captured + child : -child
    if (captured > 0) takeAll = Math.max(takeAll, value)
    else doubleCross = Math.max(doubleCross, value)
  }
  if (takeAll === -Infinity || doubleCross === -Infinity) return null
  return { takeAll, doubleCross }
}
