/**
 * Game rules: creating positions, validating and applying moves, and deciding
 * outcomes. All transitions are pure — `applyMove` returns a brand-new
 * `Position` and never mutates its input.
 */
import { boxCount, edgeCount, tablesFor } from './board.ts'
import {
  DEFAULT_RULES,
  type BoardSize,
  type BoxId,
  type EdgeId,
  type GameOutcome,
  type Move,
  type PlayerIndex,
  type Position,
  type RuleSet,
} from './types.ts'

export function createPosition(size: BoardSize, rules: RuleSet = DEFAULT_RULES): Position {
  const playerCount = Math.max(2, Math.min(4, rules.playerCount))
  let position: Position = {
    size,
    playerCount,
    edges: new Uint8Array(edgeCount(size)),
    boxes: new Int8Array(boxCount(size)).fill(-1),
    scores: new Array(playerCount).fill(0),
    current: 0,
    ply: 0,
  }
  // Pre-placed edges belong to nobody: they are terrain, not moves. They are
  // marked with the sentinel owner 255 so `isEdgeDrawn` sees them as taken while
  // no player is credited.
  if (rules.preplacedEdges.length) {
    const edges = new Uint8Array(position.edges)
    for (const edge of rules.preplacedEdges) {
      if (edge >= 0 && edge < edges.length) edges[edge] = NEUTRAL_OWNER
    }
    position = { ...position, edges }
  }
  return position
}

/** Owner value used for edges that exist but were not played by anyone. */
export const NEUTRAL_OWNER = 255

export function isEdgeDrawn(position: Position, edge: EdgeId): boolean {
  return position.edges[edge] !== 0
}

export function isLegalMove(position: Position, edge: EdgeId): boolean {
  return (
    Number.isInteger(edge) &&
    edge >= 0 &&
    edge < position.edges.length &&
    position.edges[edge] === 0 &&
    !isComplete(position)
  )
}

export function legalMoves(position: Position): EdgeId[] {
  const out: EdgeId[] = []
  for (let e = 0; e < position.edges.length; e++) if (position.edges[e] === 0) out.push(e)
  return out
}

export function remainingEdges(position: Position): number {
  let n = 0
  for (let e = 0; e < position.edges.length; e++) if (position.edges[e] === 0) n++
  return n
}

/** How many of a box's four edges are drawn. */
export function boxEdgeCount(position: Position, box: BoxId): number {
  const { boxEdges } = tablesFor(position.size)
  let n = 0
  for (let k = 0; k < 4; k++) if (position.edges[boxEdges[box * 4 + k]] !== 0) n++
  return n
}

export function isComplete(position: Position): boolean {
  for (let b = 0; b < position.boxes.length; b++) if (position.boxes[b] < 0) return false
  return true
}

export interface MoveResult {
  readonly position: Position
  readonly move: Move
  /** True when the mover keeps the turn (classic extra-turn-on-capture rule). */
  readonly repeatTurn: boolean
}

/**
 * Applies `edge` for the position's current player.
 *
 * @throws if the move is illegal — callers that accept untrusted input (the
 * online server, replay loading) should gate on `isLegalMove` first.
 */
export function applyMove(
  position: Position,
  edge: EdgeId,
  rules: RuleSet = DEFAULT_RULES,
  meta?: { thinkMs?: number; at?: number },
): MoveResult {
  if (!isLegalMove(position, edge)) {
    throw new Error(`Illegal move: edge ${edge}`)
  }
  const player = position.current
  const edges = new Uint8Array(position.edges)
  edges[edge] = player + 1

  const tables = tablesFor(position.size)
  const captured: BoxId[] = []
  let boxes = position.boxes
  for (let k = 0; k < 2; k++) {
    const box = tables.edgeBoxes[edge * 2 + k]
    if (box < 0) continue
    let filled = 0
    for (let j = 0; j < 4; j++) if (edges[tables.boxEdges[box * 4 + j]] !== 0) filled++
    if (filled === 4 && boxes[box] < 0) {
      if (boxes === position.boxes) boxes = new Int8Array(position.boxes)
      boxes[box] = player
      captured.push(box)
    }
  }

  const scores = position.scores.slice()
  scores[player] += captured.length

  const repeatTurn = rules.extraTurnOnCapture && captured.length > 0
  const next: Position = {
    ...position,
    edges,
    boxes,
    scores,
    current: repeatTurn
      ? player
      : (((player + 1) % position.playerCount) as PlayerIndex),
    ply: position.ply + 1,
  }

  const move: Move = {
    edge,
    player,
    captured,
    ply: position.ply,
    ...(meta?.thinkMs !== undefined ? { thinkMs: meta.thinkMs } : {}),
    ...(meta?.at !== undefined ? { at: meta.at } : {}),
  }

  return { position: next, move, repeatTurn }
}

/** Replays a move list from an empty board. Used by replays and the server. */
export function replay(
  size: BoardSize,
  moves: readonly { edge: EdgeId }[],
  rules: RuleSet = DEFAULT_RULES,
): Position {
  let position = createPosition(size, rules)
  for (const m of moves) position = applyMove(position, m.edge, rules).position
  return position
}

export function outcome(position: Position, rules: RuleSet = DEFAULT_RULES): GameOutcome {
  if (!isComplete(position)) return { kind: 'in-progress' }
  const scores = position.scores
  const best = rules.misere ? Math.min(...scores) : Math.max(...scores)
  const winners = scores
    .map((s, i) => (s === best ? (i as PlayerIndex) : -1))
    .filter((i): i is PlayerIndex => i >= 0)
  return winners.length === 1 ? { kind: 'win', winners } : { kind: 'draw', winners }
}

/**
 * Maximum number of boxes a player could still reach. Lets the UI declare a
 * mathematically decided game early ("6–2, 3 boxes left" is already over).
 */
export function isMathematicallyDecided(position: Position, rules: RuleSet): boolean {
  if (rules.misere || position.playerCount !== 2) return false
  const left = position.boxes.reduce((n, owner) => (owner < 0 ? n + 1 : n), 0)
  if (left === 0) return false
  const [a, b] = position.scores
  return Math.abs(a - b) > left
}
