/**
 * Negamax with alpha-beta pruning, a Zobrist transposition table, iterative
 * deepening and a hard time budget.
 *
 * The Dots & Boxes twist: capturing keeps the turn, so a capture is searched as
 * a *same-side* continuation with the window shifted by the boxes won, and it
 * costs no depth. Only turn-passing moves consume depth. Combined with the
 * chain-aware move generation in `SearchState`, this searches typical endgames
 * to the end within a few hundred milliseconds.
 */
import { evaluate } from './heuristics.ts'
import type { SearchState } from './search-state.ts'

const FLAG_EXACT = 0
const FLAG_LOWER = 1
const FLAG_UPPER = 2

const TT_BITS = 19
const TT_SIZE = 1 << TT_BITS
const TT_MASK = TT_SIZE - 1

export class TranspositionTable {
  private readonly keyLo = new Int32Array(TT_SIZE)
  private readonly keyHi = new Int32Array(TT_SIZE)
  private readonly value = new Float32Array(TT_SIZE)
  private readonly depth = new Int16Array(TT_SIZE)
  private readonly flag = new Uint8Array(TT_SIZE)
  private readonly best = new Int32Array(TT_SIZE)
  private readonly used = new Uint8Array(TT_SIZE)

  clear(): void {
    this.used.fill(0)
  }

  probe(lo: number, hi: number): { value: number; depth: number; flag: number; best: number } | null {
    const i = (lo ^ (hi * 0x9e3779b1)) & TT_MASK
    if (!this.used[i] || this.keyLo[i] !== lo || this.keyHi[i] !== hi) return null
    return { value: this.value[i], depth: this.depth[i], flag: this.flag[i], best: this.best[i] }
  }

  store(lo: number, hi: number, value: number, depth: number, flag: number, best: number): void {
    const i = (lo ^ (hi * 0x9e3779b1)) & TT_MASK
    // Depth-preferred replacement: deep, expensive results survive.
    if (this.used[i] && this.keyLo[i] === lo && this.keyHi[i] === hi && this.depth[i] > depth) return
    this.used[i] = 1
    this.keyLo[i] = lo
    this.keyHi[i] = hi
    this.value[i] = value
    this.depth[i] = depth
    this.flag[i] = flag
    this.best[i] = best
  }
}

export interface SearchOptions {
  readonly maxDepth: number
  readonly deadline: number
  readonly table: TranspositionTable
  /** Classic rule; when false, capturing passes the turn like any other move. */
  readonly extraTurnOnCapture: boolean
}

export interface SearchStats {
  nodes: number
  aborted: boolean
  depthReached: number
}

export class TimeUp extends Error {
  constructor() {
    super('search deadline exceeded')
    this.name = 'TimeUp'
  }
}

const INF = 1e6

function negamax(
  state: SearchState,
  depth: number,
  alphaIn: number,
  betaIn: number,
  opts: SearchOptions,
  stats: SearchStats,
  buffers: number[][],
  ply: number,
): number {
  if (state.freeEdges === 0) return 0

  if ((++stats.nodes & 0x3ff) === 0 && performance.now() > opts.deadline) throw new TimeUp()

  let alpha = alphaIn
  const beta = betaIn
  const lo = state.hashLo
  const hi = state.hashHi

  const entry = opts.table.probe(lo, hi)
  if (entry && entry.depth >= depth) {
    if (entry.flag === FLAG_EXACT) return entry.value
    if (entry.flag === FLAG_LOWER && entry.value > alpha) alpha = entry.value
    else if (entry.flag === FLAG_UPPER && entry.value < beta) return entry.value
    if (alpha >= beta) return entry.value
  }

  // Depth only runs out in quiet positions; forced capture sequences resolve
  // first so the evaluation never fires mid-burst.
  if (depth <= 0 && !state.hasCapture()) return evaluate(state)

  // Two scratch arrays per ply, so recursion never reallocates.
  const moves = buffers[ply * 2] ?? (buffers[ply * 2] = [])
  const scratch = buffers[ply * 2 + 1] ?? (buffers[ply * 2 + 1] = [])
  state.generateMoves(moves, scratch)
  if (moves.length === 0) return 0

  // Try the transposition move first — it is usually still the best.
  if (entry && entry.best >= 0) {
    const idx = moves.indexOf(entry.best)
    if (idx > 0) {
      const tmp = moves[0]
      moves[0] = moves[idx]
      moves[idx] = tmp
    }
  }

  let best = -INF
  let bestMove = -1
  const originalAlpha = alphaIn

  for (let i = 0; i < moves.length; i++) {
    const edge = moves[i]
    const captured = state.make(edge)
    let value: number
    if (captured > 0 && opts.extraTurnOnCapture) {
      value = captured + negamax(state, depth, alpha - captured, beta - captured, opts, stats, buffers, ply + 1)
    } else {
      value = captured - negamax(state, depth - 1, -beta, -alpha, opts, stats, buffers, ply + 1)
    }
    state.unmake(edge)

    if (value > best) {
      best = value
      bestMove = edge
      if (value > alpha) alpha = value
      if (alpha >= beta) break
    }
  }

  const flag =
    best <= originalAlpha ? FLAG_UPPER : best >= beta ? FLAG_LOWER : FLAG_EXACT
  opts.table.store(lo, hi, best, depth, flag, bestMove)
  return best
}

export interface SearchResult {
  readonly edge: number
  readonly value: number
  readonly principalVariation: number[]
  readonly depth: number
  readonly nodes: number
  readonly complete: boolean
}

/**
 * Iterative deepening root search. Always returns the best move found so far,
 * even when the deadline cuts the last iteration short.
 */
export function searchBestMove(
  state: SearchState,
  opts: SearchOptions,
): SearchResult {
  const stats: SearchStats = { nodes: 0, aborted: false, depthReached: 0 }
  const buffers: number[][] = []
  const rootMoves: number[] = []
  const scratch: number[] = []
  state.generateMoves(rootMoves, scratch)

  if (rootMoves.length === 0) {
    return { edge: -1, value: 0, principalVariation: [], depth: 0, nodes: 0, complete: true }
  }

  let bestEdge = rootMoves[0]
  let bestValue = 0
  let completedDepth = 0
  let complete = false

  // Searching to `freeEdges` depth is a proven exact solve — anything deeper is
  // wasted work.
  const ceiling = Math.min(opts.maxDepth, state.freeEdges)

  for (let depth = 1; depth <= ceiling; depth++) {
    let localBest = -INF
    let localEdge = bestEdge
    try {
      let alpha = -INF
      // Root: put the previous best first for a quick, tight window.
      const ordered = rootMoves.slice()
      const prev = ordered.indexOf(bestEdge)
      if (prev > 0) {
        ordered.splice(prev, 1)
        ordered.unshift(bestEdge)
      }
      for (const edge of ordered) {
        const captured = state.make(edge)
        let value: number
        if (captured > 0 && opts.extraTurnOnCapture) {
          value =
            captured +
            negamax(state, depth, alpha - captured, INF, opts, stats, buffers, 1)
        } else {
          value = captured - negamax(state, depth - 1, -INF, -alpha, opts, stats, buffers, 1)
        }
        state.unmake(edge)
        if (value > localBest) {
          localBest = value
          localEdge = edge
          if (value > alpha) alpha = value
        }
      }
      bestEdge = localEdge
      bestValue = localBest
      completedDepth = depth
      if (depth >= state.freeEdges) complete = true
    } catch (err) {
      if (!(err instanceof TimeUp)) throw err
      stats.aborted = true
      // Keep the partial result: a deeper move found before the cut-off is
      // still better than the previous iteration's.
      if (localBest > -INF) {
        bestEdge = localEdge
        bestValue = localBest
      }
      break
    }
    if (performance.now() > opts.deadline) break
  }

  return {
    edge: bestEdge,
    value: bestValue,
    principalVariation: extractPv(state, opts, bestEdge),
    depth: completedDepth,
    nodes: stats.nodes,
    complete,
  }
}

/** Walks the transposition table to reconstruct the expected line. */
function extractPv(state: SearchState, opts: SearchOptions, firstMove: number): number[] {
  const pv: number[] = []
  const played: number[] = []
  let move = firstMove
  for (let i = 0; i < 24 && move >= 0 && state.drawn[move] === 0; i++) {
    pv.push(move)
    played.push(move)
    state.make(move)
    const entry = opts.table.probe(state.hashLo, state.hashHi)
    move = entry ? entry.best : -1
  }
  for (let i = played.length - 1; i >= 0; i--) state.unmake(played[i])
  return pv
}
