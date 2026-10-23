/**
 * Compact, versioned serialization for saves, replays, share links and the
 * online protocol. Positions are never stored directly — a move list plus the
 * board size is smaller, replayable and self-validating.
 */
import { createPosition, applyMove, isLegalMove } from './rules.ts'
import { clampBoardSize } from './board.ts'
import { DEFAULT_RULES, type BoardSize, type Move, type Position, type RuleSet } from './types.ts'

export const REPLAY_VERSION = 1

export interface SerializedGame {
  readonly v: number
  readonly rows: number
  readonly cols: number
  readonly rules: RuleSet
  /** Edge ids in play order. */
  readonly moves: readonly number[]
  /** Optional per-move deliberation times, aligned with `moves`. */
  readonly times?: readonly number[]
  readonly seed?: number
  readonly startedAt?: number
}

export function serializeMoves(size: BoardSize, rules: RuleSet, moves: readonly Move[]): SerializedGame {
  return {
    v: REPLAY_VERSION,
    rows: size.rows,
    cols: size.cols,
    rules,
    moves: moves.map((m) => m.edge),
    times: moves.map((m) => m.thinkMs ?? 0),
  }
}

export interface DeserializedGame {
  readonly size: BoardSize
  readonly rules: RuleSet
  readonly positions: readonly Position[]
  readonly moves: readonly Move[]
}

/**
 * Rebuilds the full position timeline from a serialized game, validating every
 * move. Invalid tails are truncated rather than thrown away, so a corrupt save
 * still restores as much as possible.
 */
export function deserializeGame(data: SerializedGame): DeserializedGame {
  const size = clampBoardSize({ rows: data.rows, cols: data.cols })
  const rules: RuleSet = { ...DEFAULT_RULES, ...data.rules }
  const positions: Position[] = [createPosition(size, rules)]
  const moves: Move[] = []
  for (let i = 0; i < data.moves.length; i++) {
    const edge = data.moves[i]
    const head = positions[positions.length - 1]
    if (!isLegalMove(head, edge)) break
    const result = applyMove(head, edge, rules, { thinkMs: data.times?.[i] })
    positions.push(result.position)
    moves.push(result.move)
  }
  return { size, rules, positions, moves }
}

/* ------------------------------------------------------------------ *
 * URL-safe share codes
 * ------------------------------------------------------------------ */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
const SHARE_CODE_VERSION = 2

/** Variable-length base64url encoding of non-negative integers. */
function encodeVarint(value: number, out: string[]): void {
  let v = value
  do {
    let chunk = v & 0x1f
    v >>>= 5
    if (v > 0) chunk |= 0x20
    out.push(ALPHABET[chunk])
  } while (v > 0)
}

function decodeVarint(input: string, cursor: { i: number }): number {
  let value = 0
  let shift = 0
  for (;;) {
    const ch = input[cursor.i++]
    if (ch === undefined) throw new Error('Truncated share code')
    const idx = ALPHABET.indexOf(ch)
    if (idx < 0) throw new Error('Bad character in share code')
    value |= (idx & 0x1f) << shift
    if ((idx & 0x20) === 0) return value >>> 0
    shift += 5
    if (shift >= 35) throw new Error('Share code integer is too large')
  }
}

/** Encodes a game into a short, URL-safe string suitable for share links. */
export function encodeShareCode(game: SerializedGame): string {
  const out: string[] = []
  encodeVarint(SHARE_CODE_VERSION, out)
  encodeVarint(game.rows, out)
  encodeVarint(game.cols, out)
  encodeVarint((game.rules.misere ? 1 : 0) | (game.rules.extraTurnOnCapture ? 0 : 2), out)
  encodeVarint(game.rules.playerCount, out)
  encodeVarint(game.rules.moveTimeLimit, out)
  encodeVarint(game.rules.gameTimeLimit, out)
  encodeVarint(game.rules.preplacedEdges.length, out)
  for (const edge of game.rules.preplacedEdges) encodeVarint(edge, out)
  encodeVarint(game.moves.length, out)
  for (const edge of game.moves) encodeVarint(edge, out)
  return out.join('')
}

export function decodeShareCode(code: string): SerializedGame {
  const cursor = { i: 0 }
  const wireVersion = decodeVarint(code, cursor)
  if (wireVersion !== 1 && wireVersion !== SHARE_CODE_VERSION) throw new Error(`Unsupported share code version ${wireVersion}`)
  const rows = decodeVarint(code, cursor)
  const cols = decodeVarint(code, cursor)
  const flags = decodeVarint(code, cursor)
  let rules: RuleSet = { ...DEFAULT_RULES, misere: (flags & 1) !== 0 }
  if (wireVersion >= 2) {
    const playerCount = decodeVarint(code, cursor)
    const moveTimeLimit = decodeVarint(code, cursor)
    const gameTimeLimit = decodeVarint(code, cursor)
    const terrainCount = decodeVarint(code, cursor)
    const preplacedEdges: number[] = []
    for (let i = 0; i < terrainCount; i++) preplacedEdges.push(decodeVarint(code, cursor))
    rules = { ...rules, extraTurnOnCapture: (flags & 2) === 0, playerCount, moveTimeLimit, gameTimeLimit, preplacedEdges }
  }
  const count = decodeVarint(code, cursor)
  const moves: number[] = []
  for (let i = 0; i < count; i++) moves.push(decodeVarint(code, cursor))
  return {
    v: REPLAY_VERSION,
    rows,
    cols,
    rules,
    moves,
  }
}

/** Stable hash of a position, used for transposition tables and puzzle ids. */
export function hashPosition(position: Position): string {
  let h1 = 0x811c9dc5
  let h2 = 0x01000193
  for (let i = 0; i < position.edges.length; i++) {
    const v = position.edges[i] === 0 ? 0 : 1
    h1 = ((h1 ^ (v + i)) * 0x01000193) >>> 0
    h2 = ((h2 + v * (i + 7)) * 0x85ebca6b) >>> 0
  }
  return `${h1.toString(36)}${h2.toString(36)}`
}
