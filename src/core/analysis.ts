/**
 * Dots & Boxes combinatorial analysis.
 *
 * This module is what separates a toy opponent from a real one. It implements
 * the standard theory: the dual graph of undrawn edges, chain/loop
 * decomposition, "loony" move detection, the long-chain parity rule, and an
 * exact solver for the controlled endgame (Berlekamp's double-cross recursion).
 *
 * Terminology
 *  - *degree* of an incomplete box = how many of its four edges are still undrawn.
 *  - *ground* = the region outside the board; border edges connect a box to it.
 *  - *chain*  = a maximal run of degree-2 boxes with both ends on ground.
 *  - *loop*   = a cycle of degree-2 boxes with no ground connection.
 *  - *loony*  = a move that hands the opponent a chain or loop (they choose who
 *               keeps control). Avoiding loony moves is the whole midgame.
 */
import { tablesFor } from './board.ts'
import type { BoxId, EdgeId, Position } from './types.ts'

export interface Component {
  readonly boxes: readonly BoxId[]
  readonly length: number
  readonly isLoop: boolean
}

export interface Analysis {
  /** Boxes with exactly one undrawn edge — free points, right now. */
  readonly capturable: readonly BoxId[]
  /** Edges that immediately complete at least one box. */
  readonly capturingEdges: readonly EdgeId[]
  /** Edges that do not leave any box at degree 1 (i.e. give nothing away). */
  readonly safeEdges: readonly EdgeId[]
  /** Chains and loops among boxes of degree <= 2. */
  readonly components: readonly Component[]
  /** Chains of length >= 3: the currency of the endgame. */
  readonly longChains: number
  readonly loops: number
  readonly shortChains: number
  /** True when no box has degree >= 3 — the position is a pure endgame. */
  readonly isEndgame: boolean
  readonly remainingBoxes: number
}

/** Per-box count of still-undrawn edges (0 for completed boxes). */
export function degrees(position: Position): Uint8Array {
  const { boxEdges } = tablesFor(position.size)
  const n = position.boxes.length
  const out = new Uint8Array(n)
  for (let b = 0; b < n; b++) {
    if (position.boxes[b] >= 0) continue
    let d = 0
    for (let k = 0; k < 4; k++) if (position.edges[boxEdges[b * 4 + k]] === 0) d++
    out[b] = d
  }
  return out
}

/** Edges that complete one or two boxes if played now. */
export function capturingEdges(position: Position): EdgeId[] {
  const tables = tablesFor(position.size)
  const deg = degrees(position)
  const out: EdgeId[] = []
  for (let e = 0; e < position.edges.length; e++) {
    if (position.edges[e] !== 0) continue
    for (let k = 0; k < 2; k++) {
      const b = tables.edgeBoxes[e * 2 + k]
      if (b >= 0 && deg[b] === 1) {
        out.push(e)
        break
      }
    }
  }
  return out
}

/** How many boxes drawing `edge` would close (0..2). */
export function capturesFor(position: Position, edge: EdgeId, deg?: Uint8Array): number {
  const tables = tablesFor(position.size)
  const d = deg ?? degrees(position)
  let n = 0
  for (let k = 0; k < 2; k++) {
    const b = tables.edgeBoxes[edge * 2 + k]
    if (b >= 0 && d[b] === 1) n++
  }
  return n
}

/**
 * A move is *safe* when it leaves no box with a single undrawn edge, so the
 * opponent gains nothing for free.
 */
export function safeEdges(position: Position): EdgeId[] {
  const tables = tablesFor(position.size)
  const deg = degrees(position)
  const out: EdgeId[] = []
  for (let e = 0; e < position.edges.length; e++) {
    if (position.edges[e] !== 0) continue
    let safe = true
    for (let k = 0; k < 2; k++) {
      const b = tables.edgeBoxes[e * 2 + k]
      if (b >= 0 && deg[b] === 2) {
        safe = false
        break
      }
      if (b >= 0 && deg[b] === 1) {
        safe = false
        break
      }
    }
    if (safe) out.push(e)
  }
  return out
}

/**
 * Connected components of the subgraph induced on boxes of degree <= 2, which
 * is exactly the set of chains and loops.
 */
export function components(position: Position): Component[] {
  const tables = tablesFor(position.size)
  const deg = degrees(position)
  const n = position.boxes.length
  const seen = new Uint8Array(n)
  const out: Component[] = []
  const stack: number[] = []

  for (let start = 0; start < n; start++) {
    if (seen[start] || deg[start] === 0 || deg[start] > 2) continue
    const boxes: BoxId[] = []
    let groundEdges = 0
    seen[start] = 1
    stack.push(start)
    while (stack.length) {
      const b = stack.pop() as number
      boxes.push(b)
      for (let k = 0; k < 4; k++) {
        const e = tables.boxEdges[b * 4 + k]
        if (position.edges[e] !== 0) continue
        const other = tables.edgeBoxes[e * 2 + 0] === b
          ? tables.edgeBoxes[e * 2 + 1]
          : tables.edgeBoxes[e * 2 + 0]
        if (other < 0) {
          groundEdges++
          continue
        }
        if (deg[other] > 2) {
          // Attached to the unopened region: behaves like a ground connection.
          groundEdges++
          continue
        }
        if (!seen[other]) {
          seen[other] = 1
          stack.push(other)
        }
      }
    }
    out.push({ boxes, length: boxes.length, isLoop: groundEdges === 0 })
  }
  return out
}

export function analyze(position: Position): Analysis {
  const deg = degrees(position)
  const capturable: BoxId[] = []
  for (let b = 0; b < deg.length; b++) if (deg[b] === 1) capturable.push(b)

  const comps = components(position)
  let longChains = 0
  let shortChains = 0
  let loops = 0
  for (const c of comps) {
    if (c.isLoop) loops++
    else if (c.length >= 3) longChains++
    else shortChains++
  }

  let isEndgame = true
  for (let b = 0; b < deg.length; b++) {
    if (deg[b] > 2) {
      isEndgame = false
      break
    }
  }

  let remainingBoxes = 0
  for (let b = 0; b < position.boxes.length; b++) if (position.boxes[b] < 0) remainingBoxes++

  return {
    capturable,
    capturingEdges: capturingEdges(position),
    safeEdges: safeEdges(position),
    components: comps,
    longChains,
    loops,
    shortChains,
    isEndgame,
    remainingBoxes,
  }
}

/* ------------------------------------------------------------------ *
 * Controlled endgame solver
 * ------------------------------------------------------------------ */

export interface EndgameState {
  /** Chain lengths, ascending. */
  readonly chains: readonly number[]
  /** Loop lengths, ascending. */
  readonly loops: readonly number[]
}

function stateKey(chains: readonly number[], loops: readonly number[]): string {
  return `${chains.join(',')}|${loops.join(',')}`
}

function without(list: readonly number[], index: number): number[] {
  const copy = list.slice()
  copy.splice(index, 1)
  return copy
}

/**
 * Value of a loony endgame for the player *forced to move*, expressed as
 * (my boxes − opponent boxes) over the remainder of the game.
 *
 * Both players are assumed perfect: the opener picks the component that hurts
 * least; the capturer chooses between taking everything (and losing control)
 * and the double-cross — declining the last two boxes of a chain, or the last
 * four of a loop — to keep the opponent on move.
 *
 * This is the classical closed form, and it is exact under the standard model
 * where a component is always opened *as a unit*. Opening a long chain in the
 * middle can occasionally do a shade better than the formula predicts, so
 * `ai/endgame.ts` refines it with a real search over the opening move and uses
 * this function only at quiet leaves. Treat the closed form as a very strong
 * lower bound, not as the last word.
 */
export function endgameValue(state: EndgameState, memo = new Map<string, number>()): number {
  const { chains, loops } = state
  if (chains.length === 0 && loops.length === 0) return 0
  const key = stateKey(chains, loops)
  const cached = memo.get(key)
  if (cached !== undefined) return cached

  let best = -Infinity

  for (let i = 0; i < chains.length; i++) {
    if (i > 0 && chains[i] === chains[i - 1]) continue // identical option
    const len = chains[i]
    const rest: EndgameState = { chains: without(chains, i), loops }
    const restValue = endgameValue(rest, memo)
    // Opponent takes everything, then has to open next.
    const takeAll = -(len + restValue)
    // Opponent declines the last two (double-cross) and keeps control.
    const doubleCross = len >= 2 ? 2 - (len - 2) + restValue : Number.POSITIVE_INFINITY

    // The *half-hearted handout*: a two-box chain opened through its middle
    // edge leaves two independent single-edge boxes rather than a domino, so
    // there is nothing left to double-cross. The opponent is forced to take
    // both and open the next component. This costs two boxes but keeps
    // control, and it is frequently the best move on the board — the closed
    // form is simply wrong without it.
    const value = len === 2 ? Math.max(Math.min(takeAll, doubleCross), takeAll) : Math.min(takeAll, doubleCross)
    if (value > best) best = value
  }

  for (let i = 0; i < loops.length; i++) {
    if (i > 0 && loops[i] === loops[i - 1]) continue
    const len = loops[i]
    const rest: EndgameState = { chains, loops: without(loops, i) }
    const restValue = endgameValue(rest, memo)
    const takeAll = -(len + restValue)
    const doubleCross = len >= 4 ? 4 - (len - 4) + restValue : Number.POSITIVE_INFINITY
    const value = Math.min(takeAll, doubleCross)
    if (value > best) best = value
  }

  // Normalise negative zero: it is arithmetically equal to 0 but not
  // `Object.is`-equal, which surprises callers and test assertions alike.
  const normalised = best === 0 ? 0 : best
  memo.set(key, normalised)
  return normalised
}

/** Extracts the chain/loop multiset from a fully "opened up" position. */
export function endgameState(position: Position): EndgameState | null {
  const a = analyze(position)
  if (!a.isEndgame || a.capturable.length > 0) return null
  const chains: number[] = []
  const loops: number[] = []
  for (const c of a.components) (c.isLoop ? loops : chains).push(c.length)
  chains.sort((x, y) => x - y)
  loops.sort((x, y) => x - y)
  return { chains, loops }
}

/**
 * The long-chain rule: on a board with an even number of dots the first player
 * wants an *odd* number of long chains; with an odd number of dots, an even
 * number. Returns `true` when the given player is on the right side of parity.
 *
 * This is the single most valuable midgame heuristic — it decides most games
 * between strong players long before the first box is taken.
 */
export function hasChainParity(position: Position, player: number, longChains: number): boolean {
  const dots = (position.size.rows + 1) * (position.size.cols + 1)
  // Player 0 is "first player". Parity flips for the second player.
  const wantOdd = dots % 2 === 0
  const isOdd = longChains % 2 === 1
  const firstPlayerFavoured = wantOdd === isOdd
  return player === 0 ? firstPlayerFavoured : !firstPlayerFavoured
}
