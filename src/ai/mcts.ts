/**
 * Monte-Carlo Tree Search with UCT.
 *
 * Alpha-beta is the right tool once the board has thinned out, but on a fresh
 * 6x6 board the tree is far too wide for a fixed-depth search to say anything
 * useful. MCTS covers that gap: it samples full games with a cheap but
 * *knowledgeable* playout policy (take free boxes, avoid loony moves, otherwise
 * play randomly), which is exactly how a decent human reasons about the opening.
 */
import type { Rng } from '../lib/rng.ts'
import type { SearchState } from './search-state.ts'

interface Node {
  readonly edge: number
  readonly parent: number
  /** Whether the side to move at this node is the root's side. */
  readonly rootToMove: boolean
  visits: number
  /** Accumulated net-box result from the root player's perspective. */
  total: number
  children: number[] | null
  untried: number[]
}

const EXPLORATION = 1.2

export interface MctsResult {
  readonly edge: number
  /** Mean net-box outcome for the root player. */
  readonly value: number
  readonly playouts: number
}

export function mctsBestMove(
  state: SearchState,
  playouts: number,
  deadline: number,
  rng: Rng,
): MctsResult | null {
  const rootMoves: number[] = []
  const scratch: number[] = []
  state.generateMoves(rootMoves, scratch)
  if (rootMoves.length === 0) return null
  if (rootMoves.length === 1) return { edge: rootMoves[0], value: 0, playouts: 0 }

  const nodes: Node[] = [
    {
      edge: -1,
      parent: -1,
      rootToMove: true,
      visits: 0,
      total: 0,
      children: null,
      untried: rng.shuffle(rootMoves),
    },
  ]

  const path: number[] = []
  const undo: number[] = []
  let done = 0

  for (; done < playouts; done++) {
    if ((done & 0x3f) === 0 && performance.now() > deadline) break

    path.length = 0
    undo.length = 0
    let current = 0
    let rootToMove = true

    // ---- selection -------------------------------------------------------
    for (;;) {
      const node = nodes[current]
      if (node.untried.length > 0 || node.children === null) break
      if (node.children.length === 0) break
      let bestChild = -1
      let bestScore = -Infinity
      const logN = Math.log(Math.max(1, node.visits))
      for (const childIndex of node.children) {
        const child = nodes[childIndex]
        if (child.visits === 0) {
          bestChild = childIndex
          break
        }
        // Child values are stored from the root player's perspective, so the
        // sign flips when the opponent is choosing.
        const mean = child.total / child.visits
        const oriented = node.rootToMove ? mean : -mean
        const score = oriented / 8 + EXPLORATION * Math.sqrt(logN / child.visits)
        if (score > bestScore) {
          bestScore = score
          bestChild = childIndex
        }
      }
      if (bestChild < 0) break
      const child = nodes[bestChild]
      const captured = state.make(child.edge)
      undo.push(child.edge)
      path.push(bestChild)
      rootToMove = captured > 0 ? node.rootToMove : !node.rootToMove
      current = bestChild
      if (state.freeEdges === 0) break
    }

    // ---- expansion -------------------------------------------------------
    const node = nodes[current]
    if (state.freeEdges > 0 && node.untried.length > 0) {
      const edge = node.untried.pop() as number
      const captured = state.make(edge)
      undo.push(edge)
      const childToMove = captured > 0 ? node.rootToMove : !node.rootToMove
      const childMoves: number[] = []
      const childScratch: number[] = []
      state.generateMoves(childMoves, childScratch)
      const child: Node = {
        edge,
        parent: current,
        rootToMove: childToMove,
        visits: 0,
        total: 0,
        children: null,
        untried: rng.shuffle(childMoves),
      }
      nodes.push(child)
      const childIndex = nodes.length - 1
      if (node.children === null) node.children = []
      node.children.push(childIndex)
      path.push(childIndex)
      current = childIndex
      rootToMove = childToMove
      if (node.untried.length === 0 && node.children.length === 0) node.children = []
    } else if (node.children === null) {
      node.children = []
    }

    // ---- simulation ------------------------------------------------------
    const result = playout(state, rootToMove, rng, undo)

    // ---- backpropagation -------------------------------------------------
    nodes[0].visits++
    nodes[0].total += result
    for (const index of path) {
      nodes[index].visits++
      nodes[index].total += result
    }

    for (let i = undo.length - 1; i >= 0; i--) state.unmake(undo[i])
  }

  const root = nodes[0]
  if (!root.children || root.children.length === 0) {
    return { edge: rootMoves[0], value: 0, playouts: done }
  }
  let bestEdge = rootMoves[0]
  let bestVisits = -1
  let bestValue = 0
  for (const childIndex of root.children) {
    const child = nodes[childIndex]
    if (child.visits > bestVisits) {
      bestVisits = child.visits
      bestEdge = child.edge
      bestValue = child.visits > 0 ? child.total / child.visits : 0
    }
  }
  return { edge: bestEdge, value: bestValue, playouts: done }
}

/**
 * Plays the position out to the end and returns the net box difference from the
 * root player's perspective.
 *
 * The policy is deliberately shallow but not blind: free boxes are always
 * taken, loony moves are avoided while safe ones remain, and the opening move
 * of a chain is chosen at random. Pure random playouts are close to worthless
 * in this game because they hand over chains constantly.
 */
function playout(state: SearchState, rootToMoveIn: boolean, rng: Rng, undo: number[]): number {
  let net = 0
  let rootToMove = rootToMoveIn
  const free: number[] = []
  const safe: number[] = []

  while (state.freeEdges > 0) {
    free.length = 0
    safe.length = 0
    let capture = -1
    for (let e = 0; e < state.drawn.length; e++) {
      if (state.drawn[e] !== 0) continue
      if (capture < 0 && state.capturesFor(e) > 0) capture = e
      free.push(e)
      if (!state.isLoony(e)) safe.push(e)
    }

    let edge: number
    if (capture >= 0) {
      edge = capture
    } else if (safe.length > 0) {
      edge = rng.pick(safe)
    } else {
      edge = rng.pick(free)
    }

    const captured = state.make(edge)
    undo.push(edge)
    if (captured > 0) net += rootToMove ? captured : -captured
    else rootToMove = !rootToMove
  }
  return net
}
