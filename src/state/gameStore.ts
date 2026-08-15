/**
 * The game store.
 *
 * It keeps the *whole* position timeline rather than a single current state.
 * That one decision gives undo, redo, replay scrubbing, spectating and
 * post-game analysis for free, and it costs almost nothing: a position is two
 * small typed arrays, so a finished 6x6 game is a few kilobytes.
 *
 * The store is deliberately dumb about *who* moves next. Driving the AI,
 * running clocks and talking to the network are the jobs of controllers that
 * sit above it, which keeps this file testable without any of them.
 */
import { create } from 'zustand'
import {
  applyMove,
  createPosition,
  isComplete,
  isLegalMove,
  isMathematicallyDecided,
  outcome,
} from '../core/rules.ts'
import { DEFAULT_RULES, type BoardSize, type Move, type Position, type RuleSet } from '../core/types.ts'
import { analyze } from '../core/analysis.ts'
import { serializeMoves, type SerializedGame } from '../core/serialization.ts'
import { deserializeGame } from '../core/serialization.ts'
import type { Difficulty } from '../ai/types.ts'

export type PlayerKind = 'human' | 'ai' | 'remote'

export interface PlayerConfig {
  readonly kind: PlayerKind
  readonly name: string
  readonly difficulty?: Difficulty
  readonly avatar?: string
  /** Stable id for online play. */
  readonly remoteId?: string
}

export const GAME_MODES = [
  'classic',
  'speed',
  'blitz',
  'puzzle',
  'daily',
  'campaign',
  'trainer',
  'online',
] as const

export type GameMode = (typeof GAME_MODES)[number]

export type GameStatus = 'idle' | 'playing' | 'paused' | 'finished'

/**
 * What a mode needs to know at the end of the game to pay out progress.
 * The store carries it verbatim; only the result screen interprets it.
 */
export interface GameContext {
  readonly campaignLevelId?: string
  readonly puzzleId?: string
  /** ISO day of the daily challenge this game is an attempt at. */
  readonly dailyDate?: string
  /** Score the mode considers a pass. */
  readonly par?: number
}

export interface StartConfig {
  readonly size: BoardSize
  readonly players: readonly PlayerConfig[]
  readonly mode?: GameMode
  readonly rules?: Partial<RuleSet>
  readonly seed?: number
  readonly themeId?: string
  /** Restores a game rather than starting a fresh one. */
  readonly resume?: SerializedGame
  readonly id?: string
  readonly context?: GameContext
  /**
   * Marks the game as already paid out — used for replays of *other people's*
   * games, which must never touch this player's statistics.
   */
  readonly resultRecorded?: boolean
}

export interface CaptureEvent {
  readonly player: number
  readonly boxes: readonly number[]
  readonly edge: number
  /** Bumped on every capture so animations can key off it. */
  readonly nonce: number
}

export interface GameStoreState {
  id: string
  size: BoardSize
  rules: RuleSet
  mode: GameMode
  players: readonly PlayerConfig[]
  themeId: string
  seed: number

  /** positions[i] is the state *before* moves[i]. Always at least one entry. */
  positions: Position[]
  moves: Move[]
  /** Which position is being shown. Equals `positions.length - 1` when live. */
  cursor: number
  /** True while the replay is walking the cursor forward on its own. */
  replaying: boolean

  status: GameStatus
  startedAt: number
  finishedAt: number | null
  /** Remaining milliseconds per player; Infinity when untimed. */
  clocks: number[]
  /** Epoch ms by which the current player must move, or null. */
  moveDeadline: number | null

  thinking: boolean
  hintEdge: number | null
  lastCapture: CaptureEvent | null
  /** Human-readable line for the screen-reader live region. */
  announcement: string
  resignedBy: number | null
  /** Player whose clock ran out, if the game ended that way. */
  flaggedBy: number | null
  context: GameContext
  /**
   * True once the result screen has paid this game out. Guards against XP and
   * statistics being counted twice when the result screen is revisited.
   */
  resultRecorded: boolean

  start: (config: StartConfig) => void
  markResultRecorded: () => void
  play: (edge: number, meta?: { thinkMs?: number }) => boolean
  undo: () => boolean
  redo: () => boolean
  pause: () => void
  resume: () => void
  finish: () => void
  resign: (player: number) => void
  setThinking: (thinking: boolean) => void
  setHint: (edge: number | null) => void
  scrub: (cursor: number) => void
  goLive: () => void
  /** Rewinds to the opening position and starts playing the game back. */
  watchReplay: () => void
  setReplaying: (replaying: boolean) => void
  /** One step of playback; stops itself on the last position. */
  advanceReplay: () => void
  tick: (elapsedMs: number) => void
  announce: (message: string) => void
  reset: () => void
  serialize: () => SerializedGame
}

const CLOCK_PRESETS: Record<GameMode, Partial<RuleSet>> = {
  classic: {},
  speed: { moveTimeLimit: 10 },
  blitz: { gameTimeLimit: 180 },
  puzzle: {},
  daily: {},
  campaign: {},
  trainer: {},
  online: { moveTimeLimit: 45, gameTimeLimit: 600 },
}

function makeId(): string {
  return `g_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function initialClocks(rules: RuleSet, playerCount: number): number[] {
  const total = rules.gameTimeLimit > 0 ? rules.gameTimeLimit * 1000 : Number.POSITIVE_INFINITY
  return new Array(playerCount).fill(total)
}

function deadlineFor(rules: RuleSet, now: number): number | null {
  return rules.moveTimeLimit > 0 ? now + rules.moveTimeLimit * 1000 : null
}

export const useGame = create<GameStoreState>()((set, get) => ({
  id: '',
  size: { rows: 5, cols: 5 },
  rules: DEFAULT_RULES,
  mode: 'classic',
  players: [],
  themeId: 'persian',
  seed: 1,
  positions: [createPosition({ rows: 5, cols: 5 })],
  moves: [],
  cursor: 0,
  replaying: false,
  status: 'idle',
  startedAt: 0,
  finishedAt: null,
  clocks: [],
  moveDeadline: null,
  thinking: false,
  hintEdge: null,
  lastCapture: null,
  announcement: '',
  resignedBy: null,
  flaggedBy: null,
  context: {},
  resultRecorded: false,

  markResultRecorded: () => set({ resultRecorded: true }),

  start: (config) => {
    const mode = config.mode ?? 'classic'
    const rules: RuleSet = {
      ...DEFAULT_RULES,
      ...CLOCK_PRESETS[mode],
      ...config.rules,
      playerCount: config.players.length,
    }
    const now = Date.now()

    if (config.resume) {
      const restored = deserializeGame(config.resume)
      set({
        id: config.id ?? makeId(),
        size: restored.size,
        rules: restored.rules,
        mode,
        players: config.players,
        themeId: config.themeId ?? 'persian',
        seed: config.seed ?? now,
        positions: restored.positions as Position[],
        moves: restored.moves as Move[],
        cursor: restored.positions.length - 1,
        replaying: false,
        status: isComplete(restored.positions[restored.positions.length - 1]) ? 'finished' : 'playing',
        startedAt: now,
        finishedAt: null,
        clocks: initialClocks(restored.rules, config.players.length),
        moveDeadline: deadlineFor(restored.rules, now),
        thinking: false,
        hintEdge: null,
        lastCapture: null,
        announcement: '',
        resignedBy: null,
        flaggedBy: null,
        context: config.context ?? {},
        resultRecorded: config.resultRecorded ?? false,
      })
      return
    }

    set({
      id: config.id ?? makeId(),
      size: config.size,
      rules,
      mode,
      players: config.players,
      themeId: config.themeId ?? 'persian',
      seed: config.seed ?? now,
      positions: [createPosition(config.size, rules)],
      moves: [],
      cursor: 0,
      replaying: false,
      status: 'playing',
      startedAt: now,
      finishedAt: null,
      clocks: initialClocks(rules, config.players.length),
      moveDeadline: deadlineFor(rules, now),
      thinking: false,
      hintEdge: null,
      lastCapture: null,
      announcement: '',
      resignedBy: null,
      flaggedBy: null,
      context: config.context ?? {},
      resultRecorded: config.resultRecorded ?? false,
    })
  },

  play: (edge, meta) => {
    const state = get()
    if (state.status !== 'playing') return false
    // Playing from a scrubbed-back position would fork history; jump live first.
    const live = state.positions[state.positions.length - 1]
    if (!isLegalMove(live, edge)) return false

    const now = Date.now()
    const result = applyMove(live, edge, state.rules, { thinkMs: meta?.thinkMs, at: now })
    const positions = [...state.positions, result.position]
    const moves = [...state.moves, result.move]
    const complete = isComplete(result.position)

    const lastCapture: CaptureEvent | null = result.move.captured.length
      ? {
          player: result.move.player,
          boxes: result.move.captured,
          edge,
          nonce: (state.lastCapture?.nonce ?? 0) + 1,
        }
      : null

    set({
      positions,
      moves,
      cursor: positions.length - 1,
      hintEdge: null,
      lastCapture: lastCapture ?? state.lastCapture,
      status: complete ? 'finished' : 'playing',
      finishedAt: complete ? now : null,
      moveDeadline: complete ? null : deadlineFor(state.rules, now),
    })
    return true
  },

  /**
   * Steps back to the local player's previous decision. In a game against the
   * AI that means unwinding the AI's reply too — undoing only your own move
   * would leave the opponent on move, which is not what anyone means by undo.
   */
  undo: () => {
    const state = get()
    if (state.moves.length === 0) return false
    if (state.mode === 'online' || state.mode === 'daily') return false

    const humanIndices = state.players
      .map((p, i) => (p.kind === 'human' ? i : -1))
      .filter((i) => i >= 0)
    if (humanIndices.length === 0) return false

    let positions = state.positions.slice()
    let moves = state.moves.slice()

    // Drop moves until we have removed at least one human move and the next
    // player to move is human again.
    let removedHuman = false
    while (moves.length > 0) {
      const last = moves[moves.length - 1]
      moves.pop()
      positions.pop()
      if (humanIndices.includes(last.player)) removedHuman = true
      const nextToMove = positions[positions.length - 1].current
      if (removedHuman && humanIndices.includes(nextToMove)) break
    }
    if (!removedHuman) {
      positions = state.positions.slice()
      moves = state.moves.slice()
      return false
    }

    set({
      positions,
      moves,
      cursor: positions.length - 1,
      replaying: false,
      status: 'playing',
      finishedAt: null,
      lastCapture: null,
      hintEdge: null,
      resignedBy: null,
      flaggedBy: null,
      resultRecorded: false,
      moveDeadline: deadlineFor(state.rules, Date.now()),
    })
    return true
  },

  redo: () => false,

  pause: () => {
    if (get().status === 'playing') set({ status: 'paused', moveDeadline: null })
  },

  resume: () => {
    const state = get()
    if (state.status !== 'paused') return
    set({ status: 'playing', moveDeadline: deadlineFor(state.rules, Date.now()) })
  },

  finish: () => set({ status: 'finished', finishedAt: Date.now(), moveDeadline: null }),

  resign: (player) =>
    set({ status: 'finished', finishedAt: Date.now(), resignedBy: player, moveDeadline: null }),

  setThinking: (thinking) => set({ thinking }),
  setHint: (hintEdge) => set({ hintEdge }),

  // Taking hold of the timeline by hand stops the playback: the viewer is
  // steering now.
  scrub: (cursor) => {
    const { positions } = get()
    set({ cursor: Math.max(0, Math.min(positions.length - 1, cursor)), replaying: false })
  },

  goLive: () => set((state) => ({ cursor: state.positions.length - 1, replaying: false })),

  watchReplay: () => set({ cursor: 0, replaying: true }),

  setReplaying: (replaying) => set({ replaying }),

  advanceReplay: () =>
    set((state) => {
      const last = state.positions.length - 1
      const cursor = Math.min(last, state.cursor + 1)
      return { cursor, replaying: cursor < last }
    }),

  /**
   * Advances the clock for whoever is on move. Returns silently when the game
   * is untimed — `Infinity - n` stays `Infinity`, so no branching is needed.
   */
  tick: (elapsedMs) => {
    const state = get()
    if (state.status !== 'playing') return
    const current = state.positions[state.positions.length - 1].current
    if (!Number.isFinite(state.clocks[current])) return
    const clocks = state.clocks.slice()
    clocks[current] = Math.max(0, clocks[current] - elapsedMs)
    const flagged = clocks[current] === 0
    set({
      clocks,
      // Running out of time loses the game; without recording *who* flagged, the
      // position is still incomplete and `outcome` would report no winner at all.
      ...(flagged
        ? { status: 'finished' as const, finishedAt: Date.now(), flaggedBy: current, moveDeadline: null }
        : {}),
    })
  },

  announce: (announcement) => set({ announcement }),

  reset: () =>
    set({
      status: 'idle',
      positions: [createPosition({ rows: 5, cols: 5 })],
      moves: [],
      cursor: 0,
      replaying: false,
      lastCapture: null,
      hintEdge: null,
      resignedBy: null,
      flaggedBy: null,
      resultRecorded: false,
      context: {},
      announcement: '',
    }),

  serialize: () => {
    const { size, rules, moves } = get()
    return serializeMoves(size, rules, moves)
  },
}))

/* ------------------------------------------------------------------ *
 * selectors
 * ------------------------------------------------------------------ */

/** The position currently *displayed* (may be historical while scrubbing). */
export function selectVisiblePosition(state: GameStoreState): Position {
  return state.positions[state.cursor]
}

/** The authoritative latest position, regardless of scrubbing. */
export function selectLivePosition(state: GameStoreState): Position {
  return state.positions[state.positions.length - 1]
}

export function selectIsLive(state: GameStoreState): boolean {
  return state.cursor === state.positions.length - 1
}

export function selectCurrentPlayer(state: GameStoreState): number {
  return selectLivePosition(state).current
}

export function selectIsHumanTurn(state: GameStoreState): boolean {
  if (state.status !== 'playing') return false
  return state.players[selectCurrentPlayer(state)]?.kind === 'human'
}

export function selectOutcome(state: GameStoreState) {
  // Resigning and flagging both end the game on an incomplete board, where the
  // position alone says "in progress" — the forfeit decides it instead.
  const forfeited = state.resignedBy ?? state.flaggedBy
  if (forfeited !== null) {
    const winners = state.players.map((_, i) => i).filter((i) => i !== forfeited)
    return { kind: 'win' as const, winners }
  }
  return outcome(selectLivePosition(state), state.rules)
}

export function selectDecided(state: GameStoreState): boolean {
  return isMathematicallyDecided(selectLivePosition(state), state.rules)
}

/**
 * How tense the position is, 0..1. Drives the adaptive soundtrack and the AI
 * avatar's expression: a close game with long chains on the table is the most
 * exciting state this game has.
 */
export function selectTension(state: GameStoreState): number {
  const position = selectLivePosition(state)
  const total = position.boxes.length
  if (total === 0) return 0
  const claimed = position.scores.reduce((a, b) => a + b, 0)
  const progress = claimed / total
  const [a = 0, b = 0] = position.scores
  const closeness = 1 - Math.min(1, Math.abs(a - b) / Math.max(1, total * 0.35))
  const { longChains, loops } = analyze(position)
  const structure = Math.min(1, (longChains + loops * 1.5) / 4)
  return Math.max(0, Math.min(1, progress * 0.4 + closeness * 0.35 + structure * 0.25))
}
