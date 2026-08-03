import type { Position, RuleSet } from '../core/types.ts'

export const DIFFICULTIES = [
  'beginner',
  'easy',
  'medium',
  'hard',
  'expert',
  'grandmaster',
] as const

export type Difficulty = (typeof DIFFICULTIES)[number]

export interface DifficultyProfile {
  readonly id: Difficulty
  /** Nominal Elo, shown in the UI and used for rating changes in casual play. */
  readonly elo: number
  /** Probability of picking a deliberately sub-optimal move. */
  readonly blunderRate: number
  /** Probability of failing to notice a free box. */
  readonly missCaptureRate: number
  /** Nominal search depth for the alpha-beta stage. */
  readonly depth: number
  /** Free edges at or below which the engine solves exactly. */
  readonly exactThreshold: number
  /** Monte-Carlo playouts (0 disables MCTS for this level). */
  readonly playouts: number
  /** Soft wall-clock budget in milliseconds. */
  readonly timeBudgetMs: number
  /** Artificial minimum "thinking" time, so strong levels feel deliberate. */
  readonly minThinkMs: number
  /** Whether the loony-endgame solver and chain parity are consulted. */
  readonly usesChainTheory: boolean
}

export const DIFFICULTY_PROFILES: Record<Difficulty, DifficultyProfile> = {
  beginner: {
    id: 'beginner',
    elo: 600,
    blunderRate: 0.55,
    missCaptureRate: 0.35,
    depth: 1,
    exactThreshold: 0,
    playouts: 0,
    timeBudgetMs: 120,
    minThinkMs: 450,
    usesChainTheory: false,
  },
  easy: {
    id: 'easy',
    elo: 900,
    blunderRate: 0.3,
    missCaptureRate: 0.12,
    depth: 2,
    exactThreshold: 6,
    playouts: 0,
    timeBudgetMs: 180,
    minThinkMs: 420,
    usesChainTheory: false,
  },
  medium: {
    id: 'medium',
    elo: 1200,
    blunderRate: 0.14,
    missCaptureRate: 0.02,
    depth: 4,
    exactThreshold: 10,
    playouts: 600,
    timeBudgetMs: 400,
    minThinkMs: 380,
    usesChainTheory: true,
  },
  hard: {
    id: 'hard',
    elo: 1550,
    blunderRate: 0.05,
    missCaptureRate: 0,
    depth: 7,
    exactThreshold: 15,
    playouts: 2500,
    timeBudgetMs: 900,
    minThinkMs: 340,
    usesChainTheory: true,
  },
  expert: {
    id: 'expert',
    elo: 1900,
    blunderRate: 0.012,
    missCaptureRate: 0,
    depth: 11,
    exactThreshold: 19,
    playouts: 6000,
    timeBudgetMs: 1600,
    minThinkMs: 300,
    usesChainTheory: true,
  },
  grandmaster: {
    id: 'grandmaster',
    elo: 2350,
    blunderRate: 0,
    missCaptureRate: 0,
    depth: 64,
    exactThreshold: 23,
    playouts: 14000,
    timeBudgetMs: 2600,
    minThinkMs: 260,
    usesChainTheory: true,
  },
}

/** Structured-cloneable snapshot sent to the worker. */
export interface AiRequest {
  readonly id: number
  readonly position: Position
  readonly rules: RuleSet
  readonly difficulty: Difficulty
  readonly seed: number
  /** Overrides the profile budget (used by Blitz and Speed modes). */
  readonly timeBudgetMs?: number
}

export interface AiResponse {
  readonly id: number
  readonly edge: number
  /** Net boxes the engine expects to win by, from its own perspective. */
  readonly evaluation: number
  /** Best line found, as edge ids. */
  readonly principalVariation: readonly number[]
  readonly nodes: number
  readonly elapsedMs: number
  /** 0..1 — drives the "AI is confident / worried" avatar reactions. */
  readonly confidence: number
  /** Which stage produced the move, for the debug overlay. */
  readonly method: 'random' | 'greedy' | 'heuristic' | 'mcts' | 'search' | 'endgame'
}

export type AiWorkerMessage =
  | { readonly kind: 'move'; readonly payload: AiResponse }
  | { readonly kind: 'error'; readonly id: number; readonly message: string }
  | { readonly kind: 'progress'; readonly id: number; readonly depth: number; readonly nodes: number }
