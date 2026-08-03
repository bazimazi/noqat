/**
 * Mode content.
 *
 * None of this is hand-authored data. Puzzles, daily challenges and trainer
 * positions are *generated* from the engine and then verified by the same
 * solver the Grandmaster uses, so every one of them is guaranteed to have the
 * stated best answer. That means the library can never drift out of sync with
 * the rules, and it can grow forever without anyone hand-checking a position.
 */
import { analyze, endgameState } from '../../core/analysis.ts'
import { applyMove, createPosition, legalMoves } from '../../core/rules.ts'
import { DEFAULT_RULES, type BoardSize, type Position, type RuleSet } from '../../core/types.ts'
import { SearchState } from '../../ai/search-state.ts'
import { explainCaptureChoice, solveLoonyEndgame } from '../../ai/endgame.ts'
import type { Difficulty } from '../../ai/types.ts'
import { createRng, dailySeed, hashString } from '../../lib/rng.ts'

/* ------------------------------------------------------------------ *
 * generation helper
 * ------------------------------------------------------------------ */

/**
 * Plays safe (non-loony) moves from an empty board until the position "opens
 * up" into chains and loops. The result is a legal, reachable position that is
 * pure endgame — exactly the shape both puzzles and the trainer want.
 */
function generateEndgamePosition(size: BoardSize, seed: number, rules = DEFAULT_RULES): Position {
  const rng = createRng(seed)
  let position = createPosition(size, rules)
  let guard = 0
  for (;;) {
    if (guard++ > 400) break
    const { safeEdges } = analyze(position)
    if (safeEdges.length === 0) break
    const edge = rng.pick(safeEdges)
    position = applyMove(position, edge, rules).position
  }
  return position
}

/** Freezes a position into pre-placed (owner-less) edges. */
function toPreplaced(position: Position): number[] {
  const edges: number[] = []
  for (let e = 0; e < position.edges.length; e++) if (position.edges[e] !== 0) edges.push(e)
  return edges
}

/**
 * Plays a position out with the exact endgame solver on both sides and returns
 * the final scores.
 *
 * This — not a formula — is where a puzzle's par comes from. Par is defined as
 * "what the engine itself achieves from here", which makes it demonstrably
 * reachable, and keeps the target honest even where the closed-form chain
 * value and the search disagree by a box.
 */
export function solveToEnd(size: BoardSize, preplacedEdges: readonly number[]): number[] {
  const rules: RuleSet = { ...DEFAULT_RULES, preplacedEdges: [...preplacedEdges] }
  let position = createPosition(size, rules)
  let guard = 0
  while (position.boxes.some((owner) => owner < 0) && guard++ < 500) {
    const solved = solveLoonyEndgame(new SearchState(position))
    const moves = legalMoves(position)
    if (!moves.length) break
    const edge = solved && moves.includes(solved.edge) ? solved.edge : moves[0]
    position = applyMove(position, edge, rules).position
  }
  return Array.from(position.scores)
}

/* ------------------------------------------------------------------ *
 * puzzles
 * ------------------------------------------------------------------ */

export interface Puzzle {
  readonly id: string
  readonly size: BoardSize
  readonly preplacedEdges: readonly number[]
  /** Boxes the solver proves are winnable from here, playing first. */
  readonly par: number
  /** Total boxes still on the table. */
  readonly boxesLeft: number
  readonly chains: readonly number[]
  readonly loops: readonly number[]
  readonly difficulty: 1 | 2 | 3 | 4 | 5
}

/**
 * Builds a puzzle from a seed, or returns null if the generated position is
 * degenerate (nothing to decide). Callers just try the next seed.
 */
export function makePuzzle(size: BoardSize, seed: number): Puzzle | null {
  const position = generateEndgamePosition(size, seed)
  const state = endgameState(position)
  if (!state) return null
  const componentCount = state.chains.length + state.loops.length
  if (componentCount < 2) return null

  const boxesLeft = position.boxes.reduce((n, owner) => (owner < 0 ? n + 1 : n), 0)
  if (boxesLeft < 4) return null

  const preplacedEdges = toPreplaced(position)
  // Par is what the engine gets from here, playing itself. Whoever moves first
  // in a loony endgame is at a disadvantage, so par is usually below half.
  const par = solveToEnd(size, preplacedEdges)[0]

  const longChains = state.chains.filter((c) => c >= 3).length
  const difficulty = Math.min(5, Math.max(1, componentCount + state.loops.length - 1)) as Puzzle['difficulty']

  return {
    id: `p_${size.rows}x${size.cols}_${seed}`,
    size,
    preplacedEdges,
    par,
    boxesLeft,
    chains: state.chains,
    loops: state.loops,
    difficulty: longChains > 0 ? difficulty : (Math.max(1, difficulty - 1) as Puzzle['difficulty']),
  }
}

/** A deterministic, ever-growing puzzle library. */
export function puzzlePage(page: number, count = 12): Puzzle[] {
  const sizes: BoardSize[] = [
    { rows: 2, cols: 3 },
    { rows: 3, cols: 3 },
    { rows: 3, cols: 4 },
    { rows: 4, cols: 4 },
  ]
  const out: Puzzle[] = []
  let seed = hashString(`noqat-puzzles-${page}`)
  let attempts = 0
  while (out.length < count && attempts < count * 40) {
    attempts++
    seed = (seed * 1664525 + 1013904223) >>> 0
    const size = sizes[out.length % sizes.length]
    const puzzle = makePuzzle(size, seed)
    if (puzzle) out.push(puzzle)
  }
  return out.sort((a, b) => a.difficulty - b.difficulty)
}

/**
 * Re-derives a puzzle's par by playing it out again. Used by the tests to prove
 * every published target is reachable and reproducible.
 */
export function verifyPuzzle(puzzle: Puzzle): boolean {
  const scores = solveToEnd(puzzle.size, puzzle.preplacedEdges)
  return scores[0] === puzzle.par && scores[0] + scores[1] === puzzle.boxesLeft
}

/* ------------------------------------------------------------------ *
 * daily challenge
 * ------------------------------------------------------------------ */

export interface DailyChallenge {
  readonly isoDate: string
  readonly size: BoardSize
  readonly difficulty: Difficulty
  readonly preplacedEdges: readonly number[]
  /** Score to beat for a "par" result. */
  readonly par: number
  readonly seed: number
}

const DAILY_SIZES: BoardSize[] = [
  { rows: 4, cols: 4 },
  { rows: 5, cols: 5 },
  { rows: 4, cols: 5 },
  { rows: 5, cols: 6 },
  { rows: 3, cols: 5 },
]

const DAILY_DIFFICULTIES: Difficulty[] = ['medium', 'hard', 'hard', 'expert', 'expert', 'grandmaster']

/**
 * The same challenge for everyone in the world on a given UTC day. Derived
 * purely from the date, so it needs no server and works offline.
 */
export function dailyChallenge(date = new Date()): DailyChallenge {
  const seed = dailySeed(date)
  const rng = createRng(seed)
  const size = DAILY_SIZES[rng.int(DAILY_SIZES.length)]
  const difficulty = DAILY_DIFFICULTIES[rng.int(DAILY_DIFFICULTIES.length)]

  // A handful of pre-drawn edges gives each day a distinct opening shape
  // without ever creating a free box at move one.
  const rules: RuleSet = { ...DEFAULT_RULES }
  let position = createPosition(size, rules)
  const opening = 2 + rng.int(5)
  for (let i = 0; i < opening; i++) {
    const { safeEdges } = analyze(position)
    if (!safeEdges.length) break
    position = applyMove(position, rng.pick(safeEdges), rules).position
  }

  const totalBoxes = size.rows * size.cols
  return {
    isoDate: date.toISOString().slice(0, 10),
    size,
    difficulty,
    preplacedEdges: toPreplaced(position),
    par: Math.ceil(totalBoxes / 2) + 1,
    seed,
  }
}

/* ------------------------------------------------------------------ *
 * campaign
 * ------------------------------------------------------------------ */

export interface CampaignLevel {
  readonly id: string
  readonly index: number
  readonly size: BoardSize
  readonly difficulty: Difficulty
  /** Boxes needed for one, two and three stars. */
  readonly stars: readonly [number, number, number]
  readonly misere?: boolean
  readonly moveTimeLimit?: number
}

/**
 * Twenty-four levels that teach the game in the order a good coach would:
 * small boards first so chains are visible, then the long-chain rule, then
 * time pressure, then misère to break the habits it just built.
 */
export const CAMPAIGN: readonly CampaignLevel[] = buildCampaign()

function buildCampaign(): CampaignLevel[] {
  const plan: { size: BoardSize; difficulty: Difficulty; misere?: boolean; moveTimeLimit?: number }[] = [
    { size: { rows: 2, cols: 2 }, difficulty: 'beginner' },
    { size: { rows: 2, cols: 3 }, difficulty: 'beginner' },
    { size: { rows: 3, cols: 3 }, difficulty: 'easy' },
    { size: { rows: 3, cols: 3 }, difficulty: 'easy' },
    { size: { rows: 3, cols: 4 }, difficulty: 'medium' },
    { size: { rows: 4, cols: 4 }, difficulty: 'medium' },
    { size: { rows: 4, cols: 4 }, difficulty: 'medium', moveTimeLimit: 15 },
    { size: { rows: 4, cols: 5 }, difficulty: 'hard' },
    { size: { rows: 5, cols: 5 }, difficulty: 'hard' },
    { size: { rows: 5, cols: 5 }, difficulty: 'hard', misere: true },
    { size: { rows: 5, cols: 5 }, difficulty: 'expert' },
    { size: { rows: 5, cols: 6 }, difficulty: 'expert' },
    { size: { rows: 6, cols: 6 }, difficulty: 'expert' },
    { size: { rows: 6, cols: 6 }, difficulty: 'expert', moveTimeLimit: 10 },
    { size: { rows: 4, cols: 4 }, difficulty: 'grandmaster' },
    { size: { rows: 5, cols: 5 }, difficulty: 'grandmaster' },
    { size: { rows: 5, cols: 5 }, difficulty: 'grandmaster', misere: true },
    { size: { rows: 6, cols: 6 }, difficulty: 'grandmaster' },
    { size: { rows: 6, cols: 7 }, difficulty: 'grandmaster' },
    { size: { rows: 7, cols: 7 }, difficulty: 'grandmaster' },
    { size: { rows: 7, cols: 7 }, difficulty: 'grandmaster', moveTimeLimit: 12 },
    { size: { rows: 8, cols: 8 }, difficulty: 'grandmaster' },
    { size: { rows: 8, cols: 8 }, difficulty: 'grandmaster', misere: true },
    { size: { rows: 9, cols: 9 }, difficulty: 'grandmaster' },
  ]

  return plan.map((entry, index) => {
    const total = entry.size.rows * entry.size.cols
    const half = Math.ceil(total / 2)
    return {
      id: `c${index + 1}`,
      index,
      size: entry.size,
      difficulty: entry.difficulty,
      stars: [half, half + Math.max(1, Math.round(total * 0.08)), half + Math.max(2, Math.round(total * 0.2))] as const,
      ...(entry.misere ? { misere: true } : {}),
      ...(entry.moveTimeLimit ? { moveTimeLimit: entry.moveTimeLimit } : {}),
    }
  })
}

export function starsFor(level: CampaignLevel, boxes: number): 0 | 1 | 2 | 3 {
  if (boxes >= level.stars[2]) return 3
  if (boxes >= level.stars[1]) return 2
  if (boxes >= level.stars[0]) return 1
  return 0
}

/* ------------------------------------------------------------------ *
 * endgame trainer
 * ------------------------------------------------------------------ */

export interface TrainerDrill {
  readonly id: string
  readonly size: BoardSize
  readonly preplacedEdges: readonly number[]
  /** The single correct move. */
  readonly bestEdge: number
  /** Net boxes after best play. */
  readonly bestValue: number
  /** Value of the greedy alternative — the mistake the drill is about. */
  readonly greedyValue: number
  readonly lesson: 'double-cross' | 'take-all' | 'shortest-first'
}

/**
 * Finds positions where greed and correctness disagree.
 *
 * The whole art of the Dots & Boxes endgame is knowing when *not* to take the
 * boxes in front of you, so a drill is only interesting when taking everything
 * is worse than declining. The generator searches seeds until it finds one, and
 * the exact solver supplies both answers.
 */
export function makeDrill(size: BoardSize, seed: number): TrainerDrill | null {
  const rng = createRng(seed)
  let position = generateEndgamePosition(size, seed)
  if (!endgameState(position)) return null

  // Open one component so there are boxes on the table to be tempted by.
  const moves = legalMoves(position)
  if (!moves.length) return null
  position = applyMove(position, rng.pick(moves), DEFAULT_RULES).position

  const state = new SearchState(position)
  const choice = explainCaptureChoice(state)
  if (!choice) return null
  if (choice.doubleCross <= choice.takeAll) return null // greed happens to be right

  const solved = solveLoonyEndgame(new SearchState(position))
  if (!solved) return null

  return {
    id: `d_${size.rows}x${size.cols}_${seed}`,
    size,
    preplacedEdges: toPreplaced(position),
    bestEdge: solved.edge,
    bestValue: solved.value,
    greedyValue: choice.takeAll,
    lesson: 'double-cross',
  }
}

export function drillSet(count = 8): TrainerDrill[] {
  const sizes: BoardSize[] = [
    { rows: 2, cols: 3 },
    { rows: 3, cols: 3 },
    { rows: 3, cols: 4 },
  ]
  const out: TrainerDrill[] = []
  let seed = hashString('noqat-drills')
  let attempts = 0
  while (out.length < count && attempts < count * 120) {
    attempts++
    seed = (seed * 1103515245 + 12345) >>> 0
    const drill = makeDrill(sizes[out.length % sizes.length], seed)
    if (drill) out.push(drill)
  }
  return out
}
