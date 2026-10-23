/** Rule-aware search for variants where classic chain pruning is invalid. */
import { createRng } from '../lib/rng.ts'
import { SearchState } from './search-state.ts'
import { DIFFICULTY_PROFILES, type AiRequest, type AiResponse } from './types.ts'

interface Entry {
  depth: number
  value: number
  flag: 'exact' | 'lower' | 'upper'
}

/**
 * Unlike the classic solver, this considers every legal edge. Taking a box
 * may be bad in Reverse, and declining a capture far away can be the best move
 * when captures pass the turn. Rewards and turn changes follow the real rules.
 */
export function chooseVariantMove(request: AiRequest, started: number): AiResponse {
  const { rules, position, difficulty } = request
  const profile = DIFFICULTY_PROFILES[difficulty]
  const rng = createRng(request.seed ^ (position.ply * 0x9e3779b1))
  const state = new SearchState(position)
  const sign = rules.misere ? -1 : 1
  const deadline = started + Math.max(0, request.timeBudgetMs ?? profile.timeBudgetMs)
  const table = new Map<string, Entry>()
  let nodes = 0
  const timeout = Symbol('variant-search-timeout')

  const movesFor = (): number[] => {
    const moves: number[] = []
    for (let edge = 0; edge < state.drawn.length; edge++) {
      if (!state.drawn[edge]) moves.push(edge)
    }
    return moves.sort((a, b) => {
      const priority = (edge: number) => sign * (100 * state.capturesFor(edge) - (state.isLoony(edge) ? 10 : 0))
      return priority(b) - priority(a)
    })
  }

  const search = (depth: number, alphaIn: number, betaIn: number): number => {
    if (state.freeEdges === 0) return 0
    if ((++nodes & 0x7f) === 0 && performance.now() >= deadline) throw timeout
    const moves = movesFor()
    if (depth === 0) {
      // Only immediate opportunities are assumed. Classic chain parity has no
      // valid interpretation under these rules and must never drive a leaf.
      return 0.6 * Math.max(...moves.map((edge) => sign * state.capturesFor(edge)))
    }
    const key = `${state.hashLo}:${state.hashHi}`
    const hit = table.get(key)
    let alpha = alphaIn
    let beta = betaIn
    if (hit && hit.depth >= depth) {
      if (hit.flag === 'exact') return hit.value
      if (hit.flag === 'lower') alpha = Math.max(alpha, hit.value)
      else beta = Math.min(beta, hit.value)
      if (alpha >= beta) return hit.value
    }
    let best = -Infinity
    for (const edge of moves) {
      const captured = state.make(edge)
      const gain = sign * captured
      let value: number
      try {
        value = captured > 0 && rules.extraTurnOnCapture
          ? gain + search(depth - 1, alpha - gain, beta - gain)
          : gain - search(depth - 1, gain - beta, gain - alpha)
      } finally {
        state.unmake(edge)
      }
      best = Math.max(best, value)
      alpha = Math.max(alpha, value)
      if (alpha >= beta) break
    }
    if (table.size > 100_000) table.clear()
    table.set(key, {
      depth,
      value: best,
      flag: best <= alphaIn ? 'upper' : best >= betaIn ? 'lower' : 'exact',
    })
    return best
  }

  // Shuffle ties once so each seed has its own opening personality.
  const rootMoves = rng.shuffle(movesFor()).sort((a, b) => sign * (state.capturesFor(b) - state.capturesFor(a)))
  let edge = rootMoves[0]
  let evaluation = sign * state.capturesFor(edge)
  let completedDepth = 0
  const maxDepth = Math.min(state.freeEdges, state.freeEdges <= profile.exactThreshold ? state.freeEdges : profile.depth)
  for (let depth = 1; depth <= maxDepth && performance.now() < deadline; depth++) {
    let best = -Infinity
    let bestEdge = edge
    try {
      // Previous iteration's choice first improves cutoffs and time to answer.
      const ordered = [edge, ...rootMoves.filter((move) => move !== edge)]
      for (const candidate of ordered) {
        const captured = state.make(candidate)
        const gain = sign * captured
        let value: number
        try {
          value = captured > 0 && rules.extraTurnOnCapture
            ? gain + search(depth - 1, best - gain, Infinity)
            : gain - search(depth - 1, -Infinity, gain - best)
        } finally {
          state.unmake(candidate)
        }
        if (value > best) {
          best = value
          bestEdge = candidate
        }
      }
    } catch (error) {
      if (error !== timeout) throw error
      break
    }
    edge = bestEdge
    evaluation = best
    completedDepth = depth
  }

  if (rng.bool(profile.blunderRate)) {
    const alternatives = rootMoves.filter((move) => move !== edge)
    if (alternatives.length) edge = rng.pick(alternatives)
  }

  return {
    id: request.id,
    edge,
    evaluation,
    principalVariation: [edge],
    nodes,
    elapsedMs: performance.now() - started,
    confidence: 1 / (1 + Math.exp(-evaluation / 2.2)),
    method: completedDepth ? 'search' : 'heuristic',
  }
}
