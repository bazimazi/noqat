/**
 * Core domain types for Noqat.
 *
 * The engine is deliberately dependency-free and framework-agnostic: it runs
 * identically in the UI thread, in a Web Worker (AI search) and in Node (the
 * authoritative online server). Nothing in `src/core` may import from the app.
 */

/** Board geometry, expressed in *boxes* (a 5x5 board has 6x6 dots). */
export interface BoardSize {
  readonly rows: number
  readonly cols: number
}

/** Player slot index. Noqat supports 2..4 players. */
export type PlayerIndex = 0 | 1 | 2 | 3

export type EdgeOrientation = 'h' | 'v'

/**
 * Edges are addressed by a single dense integer so positions can live in typed
 * arrays. Horizontal edges come first, then vertical ones:
 *
 *   horizontal (rows+1) x cols   -> index          r * cols + c
 *   vertical   rows x (cols+1)   -> hCount + r * (cols+1) + c
 */
export type EdgeId = number

/** Boxes are addressed row-major: `r * cols + c`. */
export type BoxId = number

/** `0` means "no owner"; otherwise `player + 1`. Stored in a Uint8Array. */
export type EdgeOwner = number

/** Empty boxes are `-1`. Stored in an Int8Array. */
export type BoxOwner = number

export interface Move {
  readonly edge: EdgeId
  readonly player: PlayerIndex
  /** Boxes closed by this move (0..2). */
  readonly captured: readonly BoxId[]
  /** Monotonic move number, starting at 0. */
  readonly ply: number
  /** Milliseconds spent deliberating, when known. */
  readonly thinkMs?: number
  /** Wall-clock timestamp (epoch ms) the move was applied. */
  readonly at?: number
}

/**
 * A full, self-contained game position. Typed arrays are cloned on every
 * mutation-free transition so the AI can search without aliasing bugs, and so
 * React can rely on referential equality for memoisation.
 */
export interface Position {
  readonly size: BoardSize
  readonly playerCount: number
  /** length = edgeCount(size) */
  readonly edges: Uint8Array
  /** length = rows * cols */
  readonly boxes: Int8Array
  readonly scores: readonly number[]
  readonly current: PlayerIndex
  readonly ply: number
}

export type GameOutcome =
  | { readonly kind: 'in-progress' }
  | { readonly kind: 'win'; readonly winners: readonly PlayerIndex[] }
  | { readonly kind: 'draw'; readonly winners: readonly PlayerIndex[] }

/** Optional rule tweaks. The defaults reproduce the classic game exactly. */
export interface RuleSet {
  /** Classic rule: closing a box grants another turn. */
  readonly extraTurnOnCapture: boolean
  /** Misère play: the player with the *fewest* boxes wins. */
  readonly misere: boolean
  /** Per-move time limit in seconds (`0` = unlimited). */
  readonly moveTimeLimit: number
  /** Per-player game clock in seconds (`0` = unlimited). */
  readonly gameTimeLimit: number
  /** Edges pre-drawn at game start (handicaps, puzzles, daily challenges). */
  readonly preplacedEdges: readonly EdgeId[]
  /** Number of players sharing the board. */
  readonly playerCount: number
}

export const DEFAULT_RULES: RuleSet = {
  extraTurnOnCapture: true,
  misere: false,
  moveTimeLimit: 0,
  gameTimeLimit: 0,
  preplacedEdges: [],
  playerCount: 2,
}

export interface EdgeGeometry {
  readonly id: EdgeId
  readonly orientation: EdgeOrientation
  /** Dot-grid coordinates of the edge's two endpoints. */
  readonly row: number
  readonly col: number
  /** Boxes touching this edge (1 on the border, 2 inside). */
  readonly boxes: readonly BoxId[]
}
