import { describe, expect, it } from 'vitest'
import type { Move } from '../../../core/types.ts'
import { matchHighlights, puzzleStars } from '../progression.ts'

function move(player: 0 | 1, captured: number[]): Move {
  return { edge: 0, player, captured, ply: 0 }
}

describe('puzzle targets', () => {
  it('awards mastery at the solver target, even when that is below half the board', () => {
    expect(puzzleStars(4, 4)).toBe(3)
    expect(puzzleStars(5, 4)).toBe(3)
    expect(puzzleStars(3, 4)).toBe(2)
    expect(puzzleStars(2, 4)).toBe(1)
    expect(puzzleStars(1, 4)).toBe(0)
  })

  it('requires finishing the board, including for zero-par puzzles', () => {
    expect(puzzleStars(0, 0, true)).toBe(3)
    expect(puzzleStars(4, 4, false)).toBe(0)
  })
})

describe('match highlights', () => {
  it('counts boxes in a capture chain and keeps double captures separate', () => {
    const moves = [move(0, [0]), move(0, [1, 2]), move(0, [3]), move(0, []), move(1, [4]), move(0, [5])]
    expect(matchHighlights(moves, 0)).toEqual({ biggestChain: 4, doubleCaptures: 1, scoringMoves: 4 })
  })

  it('breaks chains when another player moves and isolates the chosen player', () => {
    const moves = [move(0, [0, 1]), move(1, [2, 3]), move(0, [4, 5])]
    expect(matchHighlights(moves, 0)).toEqual({ biggestChain: 2, doubleCaptures: 2, scoringMoves: 2 })
    expect(matchHighlights([], 1)).toEqual({ biggestChain: 0, doubleCaptures: 0, scoringMoves: 0 })
  })
})
