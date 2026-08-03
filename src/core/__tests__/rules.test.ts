import { describe, expect, it } from 'vitest'
import { hEdge, vEdge } from '../board.ts'
import {
  applyMove,
  createPosition,
  isComplete,
  isLegalMove,
  isMathematicallyDecided,
  legalMoves,
  outcome,
  remainingEdges,
} from '../rules.ts'
import { DEFAULT_RULES, type BoardSize, type Position, type RuleSet } from '../types.ts'

const size2: BoardSize = { rows: 2, cols: 2 }

function play(position: Position, edges: number[], rules: RuleSet = DEFAULT_RULES): Position {
  return edges.reduce((p, e) => applyMove(p, e, rules).position, position)
}

describe('rules', () => {
  it('starts empty with player 0 to move', () => {
    const p = createPosition(size2)
    expect(p.current).toBe(0)
    expect(p.scores).toEqual([0, 0])
    expect(remainingEdges(p)).toBe(12)
    expect(legalMoves(p)).toHaveLength(12)
    expect(isComplete(p)).toBe(false)
  })

  it('alternates turns when nothing is captured', () => {
    let p = createPosition(size2)
    p = applyMove(p, hEdge(size2, 0, 0)).position
    expect(p.current).toBe(1)
    p = applyMove(p, hEdge(size2, 0, 1)).position
    expect(p.current).toBe(0)
  })

  it('rejects illegal moves', () => {
    const p = applyMove(createPosition(size2), 0).position
    expect(isLegalMove(p, 0)).toBe(false)
    expect(isLegalMove(p, -1)).toBe(false)
    expect(isLegalMove(p, 999)).toBe(false)
    expect(() => applyMove(p, 0)).toThrow(/Illegal move/)
  })

  it('never mutates the input position', () => {
    const p = createPosition(size2)
    const before = Array.from(p.edges)
    applyMove(p, 3)
    expect(Array.from(p.edges)).toEqual(before)
    expect(p.ply).toBe(0)
  })

  it('awards a box and an extra turn when the fourth edge is drawn', () => {
    // Close the top-left box: top, bottom, left, right.
    let p = createPosition(size2)
    p = play(p, [hEdge(size2, 0, 0), hEdge(size2, 1, 0), vEdge(size2, 0, 0)])
    expect(p.current).toBe(1) // plies 0,1,2 played by 0,1,0 -> player 1 is on move
    const result = applyMove(p, vEdge(size2, 0, 1))
    expect(result.move.captured).toHaveLength(1)
    expect(result.repeatTurn).toBe(true)
    expect(result.position.current).toBe(1) // capturer keeps the turn
    expect(result.position.scores).toEqual([0, 1])
  })

  it('can close two boxes with a single edge', () => {
    let p = createPosition(size2)
    // Fill everything except the shared vertical edge between the two top boxes.
    const shared = vEdge(size2, 0, 1)
    const all = legalMoves(p).filter((e) => e !== shared)
    // Play every other edge; ordering does not matter for the final state.
    for (const e of all) p = applyMove(p, e).position
    const result = applyMove(p, shared)
    expect(result.move.captured).toHaveLength(2)
    expect(isComplete(result.position)).toBe(true)
  })

  it('does not grant an extra turn when the rule is disabled', () => {
    const rules: RuleSet = { ...DEFAULT_RULES, extraTurnOnCapture: false }
    let p = createPosition(size2, rules)
    p = play(p, [hEdge(size2, 0, 0), hEdge(size2, 1, 0), vEdge(size2, 0, 0)], rules)
    const result = applyMove(p, vEdge(size2, 0, 1), rules)
    expect(result.repeatTurn).toBe(false)
    expect(result.position.scores).toEqual([0, 1])
    expect(result.position.current).toBe(0) // turn passes despite the capture
  })

  it('conserves boxes: total score always equals boxes closed', () => {
    let p = createPosition({ rows: 3, cols: 3 })
    let guard = 0
    while (!isComplete(p) && guard++ < 100) {
      const moves = legalMoves(p)
      p = applyMove(p, moves[(guard * 7) % moves.length]).position
    }
    expect(isComplete(p)).toBe(true)
    expect(p.scores[0] + p.scores[1]).toBe(9)
  })

  it('reports the winner, and draws on a tie', () => {
    const p = createPosition(size2)
    expect(outcome(p).kind).toBe('in-progress')

    const won = { ...p, boxes: new Int8Array([0, 0, 0, 1]), scores: [3, 1] }
    expect(outcome(won)).toEqual({ kind: 'win', winners: [0] })

    const tied = { ...p, boxes: new Int8Array([0, 0, 1, 1]), scores: [2, 2] }
    expect(outcome(tied)).toEqual({ kind: 'draw', winners: [0, 1] })
  })

  it('inverts the winner under misère rules', () => {
    const p = createPosition(size2)
    const finished = { ...p, boxes: new Int8Array([0, 0, 0, 1]), scores: [3, 1] }
    expect(outcome(finished, { ...DEFAULT_RULES, misere: true })).toEqual({
      kind: 'win',
      winners: [1],
    })
  })

  it('detects a mathematically decided game', () => {
    const p = createPosition({ rows: 3, cols: 3 })
    const decided: Position = { ...p, boxes: new Int8Array(9).fill(-1), scores: [6, 0] }
    decided.boxes.fill(0, 0, 6)
    expect(isMathematicallyDecided(decided, DEFAULT_RULES)).toBe(true)
    const close: Position = { ...p, boxes: new Int8Array(9).fill(-1), scores: [3, 2] }
    close.boxes.fill(0, 0, 3)
    close.boxes.fill(1, 3, 5)
    expect(isMathematicallyDecided(close, DEFAULT_RULES)).toBe(false)
  })

  it('supports three and four player games', () => {
    const rules: RuleSet = { ...DEFAULT_RULES, playerCount: 3 }
    let p = createPosition({ rows: 3, cols: 3 }, rules)
    expect(p.scores).toEqual([0, 0, 0])
    p = applyMove(p, 0, rules).position
    expect(p.current).toBe(1)
    p = applyMove(p, 1, rules).position
    expect(p.current).toBe(2)
    p = applyMove(p, 2, rules).position
    expect(p.current).toBe(0)
  })

  it('honours pre-placed edges without crediting a player', () => {
    const rules: RuleSet = { ...DEFAULT_RULES, preplacedEdges: [0, 1] }
    const p = createPosition(size2, rules)
    expect(isLegalMove(p, 0)).toBe(false)
    expect(p.scores).toEqual([0, 0])
    expect(remainingEdges(p)).toBe(10)
  })
})
