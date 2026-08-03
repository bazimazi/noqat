/**
 * Difficulty dispatch — the layer that turns three search algorithms into six
 * distinct *opponents*.
 *
 * The strong levels are strong because of what they know (chain theory, exact
 * endgames). The weak levels are weak in a way that reads as human: they take
 * every box they can see and never think about giving one back. That single
 * trait — greed — is the most believable beginner mistake in Dots & Boxes, and
 * it is far more convincing than adding random noise to a strong engine.
 */
import { legalMoves } from '../core/rules.ts'
import { createRng, type Rng } from '../lib/rng.ts'
import { solveLoonyEndgame } from './endgame.ts'
import { evaluate, safeMoveCount } from './heuristics.ts'
import { mctsBestMove } from './mcts.ts'
import { searchBestMove, TranspositionTable } from './minimax.ts'
import { SearchState } from './search-state.ts'
import { DIFFICULTY_PROFILES, type AiRequest, type AiResponse, type Difficulty } from './types.ts'

const tables = new Map<number, TranspositionTable>()

function tableFor(edgeCount: number): TranspositionTable {
  let table = tables.get(edgeCount)
  if (!table) {
    table = new TranspositionTable()
    tables.set(edgeCount, table)
  }
  table.clear()
  return table
}

/** Squashes a net-box evaluation into a 0..1 confidence for the AI avatar. */
export function confidenceFrom(evaluation: number): number {
  return 1 / (1 + Math.exp(-evaluation / 2.2))
}

interface Candidates {
  readonly all: number[]
  readonly capturing: number[]
  readonly safe: number[]
  readonly loony: number[]
}

function classify(state: SearchState): Candidates {
  const all: number[] = []
  const capturing: number[] = []
  const safe: number[] = []
  const loony: number[] = []
  for (let e = 0; e < state.drawn.length; e++) {
    if (state.drawn[e] !== 0) continue
    all.push(e)
    if (state.capturesFor(e) > 0) capturing.push(e)
    else if (state.isLoony(e)) loony.push(e)
    else safe.push(e)
  }
  return { all, capturing, safe, loony }
}

/**
 * The "club player" policy: grab everything on offer, otherwise play a move
 * that gives nothing away, otherwise sacrifice as little as possible.
 * `profile.missCaptureRate` and `profile.blunderRate` decide how often it slips.
 */
function greedyMove(state: SearchState, rng: Rng, blunderRate: number, missRate: number): number {
  const { all, capturing, safe, loony } = classify(state)

  if (capturing.length > 0) {
    if (!rng.bool(missRate)) {
      // Prefer the double-capture when one exists — beginners do spot those.
      const best = capturing.reduce((a, b) => (state.capturesFor(b) > state.capturesFor(a) ? b : a))
      return best
    }
    const alternatives = safe.length ? safe : loony.length ? loony : all
    return rng.pick(alternatives)
  }

  if (safe.length > 0) {
    if (!rng.bool(blunderRate)) return rng.pick(safe)
    return loony.length ? rng.pick(loony) : rng.pick(safe)
  }

  // Everything gives something away: hand over the smallest chain we can find.
  return smallestSacrifice(state, loony.length ? loony : all, rng)
}

/** Among loony moves, opens the component that costs the fewest boxes. */
function smallestSacrifice(state: SearchState, options: number[], rng: Rng): number {
  let best = options[0]
  let bestCost = Infinity
  for (const edge of rng.shuffle(options)) {
    state.make(edge)
    let cost = 0
    // Count how many boxes the opponent could take in one uninterrupted run.
    const visited = new Set<number>()
    for (let b = 0; b < state.degree.length; b++) {
      if (state.degree[b] === 1 && !visited.has(b)) {
        cost += runLength(state, b, visited)
      }
    }
    state.unmake(edge)
    if (cost < bestCost) {
      bestCost = cost
      best = edge
    }
  }
  return best
}

function runLength(state: SearchState, start: number, visited: Set<number>): number {
  const { boxEdges, edgeBoxes } = state.tables
  let count = 0
  const stack = [start]
  while (stack.length) {
    const b = stack.pop() as number
    if (visited.has(b) || state.degree[b] === 0 || state.degree[b] > 2) continue
    visited.add(b)
    count++
    for (let k = 0; k < 4; k++) {
      const e = boxEdges[b * 4 + k]
      if (state.drawn[e] !== 0) continue
      const n0 = edgeBoxes[e * 2 + 0]
      const other = n0 === b ? edgeBoxes[e * 2 + 1] : n0
      if (other >= 0 && state.degree[other] <= 2) stack.push(other)
    }
  }
  return count
}

/** Occasionally swaps the engine's pick for a plausible second choice. */
function maybeBlunder(state: SearchState, best: number, rng: Rng, rate: number): number {
  if (rate <= 0 || !rng.bool(rate)) return best
  const { capturing, safe } = classify(state)
  if (capturing.length > 0) {
    // A strong player's realistic slip: take the box instead of the cleverer
    // sacrifice that was actually correct.
    return rng.pick(capturing)
  }
  if (safe.length > 1) {
    const alternatives = safe.filter((e) => e !== best)
    if (alternatives.length) return rng.pick(alternatives)
  }
  return best
}

export function chooseMove(request: AiRequest): AiResponse {
  const started = performance.now()
  const { position, rules, difficulty, seed } = request
  const profile = DIFFICULTY_PROFILES[difficulty]
  const rng = createRng(seed ^ (position.ply * 0x9e3779b1))
  const budget = request.timeBudgetMs ?? profile.timeBudgetMs
  const deadline = started + budget

  const options = legalMoves(position)
  if (options.length === 0) {
    return {
      id: request.id,
      edge: -1,
      evaluation: 0,
      principalVariation: [],
      nodes: 0,
      elapsedMs: 0,
      confidence: 0.5,
      method: 'random',
    }
  }
  if (options.length === 1) {
    return {
      id: request.id,
      edge: options[0],
      evaluation: 0,
      principalVariation: [options[0]],
      nodes: 1,
      elapsedMs: performance.now() - started,
      confidence: 0.5,
      method: 'greedy',
    }
  }

  const state = new SearchState(position)

  // ---- weak levels: personality, not search -------------------------------
  if (difficulty === 'beginner' || difficulty === 'easy') {
    const edge = greedyMove(state, rng, profile.blunderRate, profile.missCaptureRate)
    return {
      id: request.id,
      edge,
      evaluation: 0,
      principalVariation: [edge],
      nodes: options.length,
      elapsedMs: performance.now() - started,
      confidence: 0.5,
      method: difficulty === 'beginner' ? 'random' : 'greedy',
    }
  }

  // ---- exact loony endgame ------------------------------------------------
  if (profile.usesChainTheory) {
    const solved = solveLoonyEndgame(state)
    if (solved) {
      const edge = maybeBlunder(state, solved.edge, rng, profile.blunderRate)
      return {
        id: request.id,
        edge,
        evaluation: solved.value,
        principalVariation: [edge],
        nodes: solved.nodes,
        elapsedMs: performance.now() - started,
        confidence: confidenceFrom(solved.value),
        method: 'endgame',
      }
    }
  }

  // ---- exact alpha-beta when the board has thinned out --------------------
  if (state.freeEdges <= profile.exactThreshold) {
    const result = searchBestMove(state, {
      maxDepth: state.freeEdges,
      deadline,
      table: tableFor(state.tables.edgeCount),
      extraTurnOnCapture: rules.extraTurnOnCapture,
    })
    if (result.edge >= 0) {
      const edge = maybeBlunder(state, result.edge, rng, profile.blunderRate)
      return {
        id: request.id,
        edge,
        evaluation: result.value,
        principalVariation: result.principalVariation,
        nodes: result.nodes,
        elapsedMs: performance.now() - started,
        confidence: confidenceFrom(result.value),
        method: 'search',
      }
    }
  }

  // ---- opening / midgame --------------------------------------------------
  // Split the budget: alpha-beta first (it is exact where it reaches), then
  // MCTS with whatever time is left if the search stayed shallow.
  const searchDeadline = profile.playouts > 0 ? started + budget * 0.55 : deadline
  const search = searchBestMove(state, {
    maxDepth: profile.depth,
    deadline: searchDeadline,
    table: tableFor(state.tables.edgeCount),
    extraTurnOnCapture: rules.extraTurnOnCapture,
  })

  const shallow = search.depth < 4
  const wideOpen = safeMoveCount(state) > state.drawn.length * 0.5

  if (profile.playouts > 0 && (shallow || wideOpen)) {
    const mcts = mctsBestMove(state, profile.playouts, deadline, rng)
    if (mcts && mcts.edge >= 0) {
      // Trust the exact search when it is deep; trust sampling when it is not.
      const useSearch = search.depth >= 6 && search.edge >= 0
      const edge = maybeBlunder(state, useSearch ? search.edge : mcts.edge, rng, profile.blunderRate)
      return {
        id: request.id,
        edge,
        evaluation: useSearch ? search.value : mcts.value,
        principalVariation: useSearch ? search.principalVariation : [mcts.edge],
        nodes: search.nodes + mcts.playouts,
        elapsedMs: performance.now() - started,
        confidence: confidenceFrom(useSearch ? search.value : mcts.value),
        method: useSearch ? 'search' : 'mcts',
      }
    }
  }

  if (search.edge >= 0) {
    const edge = maybeBlunder(state, search.edge, rng, profile.blunderRate)
    return {
      id: request.id,
      edge,
      evaluation: search.value,
      principalVariation: search.principalVariation,
      nodes: search.nodes,
      elapsedMs: performance.now() - started,
      confidence: confidenceFrom(search.value),
      method: 'search',
    }
  }

  const fallback = greedyMove(state, rng, 0, 0)
  return {
    id: request.id,
    edge: fallback,
    evaluation: evaluate(state),
    principalVariation: [fallback],
    nodes: options.length,
    elapsedMs: performance.now() - started,
    confidence: 0.5,
    method: 'heuristic',
  }
}

export function difficultyElo(difficulty: Difficulty): number {
  return DIFFICULTY_PROFILES[difficulty].elo
}
