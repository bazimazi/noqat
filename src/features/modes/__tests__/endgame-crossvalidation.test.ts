/**
 * Cross-validation between the two independent endgame implementations:
 * the closed-form chain formula in `core/analysis` and the game-tree search in
 * `ai/endgame`. They share no code, so agreement is real evidence that the
 * Dots & Boxes theory is implemented correctly — and a disagreement is exactly
 * how the missing half-hearted handout was found.
 */
import { describe, expect, it } from 'vitest'
import { puzzlePage, solveToEnd } from '../library.ts'
import { endgameState, endgameValue } from '../../../core/analysis.ts'
import { createPosition } from '../../../core/rules.ts'
import { DEFAULT_RULES } from '../../../core/types.ts'
import { SearchState } from '../../../ai/search-state.ts'
import { solveLoonyEndgame } from '../../../ai/endgame.ts'

const puzzles = puzzlePage(1, 8)

describe('endgame cross-validation', () => {
  it.each(puzzles.map((p) => [p.id, p] as const))(
    '%s: closed form and search agree on the value',
    (_id, puzzle) => {
      const rules = { ...DEFAULT_RULES, preplacedEdges: [...puzzle.preplacedEdges] }
      const position = createPosition(puzzle.size, rules)
      const state = endgameState(position)
      expect(state).not.toBeNull()
      const closed = endgameValue(state!)
      const searched = solveLoonyEndgame(new SearchState(position))
      expect(searched).not.toBeNull()
      expect(searched!.value).toBe(closed)
    },
  )

  it.each(puzzles.map((p) => [p.id, p] as const))(
    '%s: self-play reproduces the predicted margin',
    (_id, puzzle) => {
      const scores = solveToEnd(puzzle.size, puzzle.preplacedEdges)
      const rules = { ...DEFAULT_RULES, preplacedEdges: [...puzzle.preplacedEdges] }
      const position = createPosition(puzzle.size, rules)
      const closed = endgameValue(endgameState(position)!)
      expect(scores[0] - scores[1]).toBe(closed)
      expect(scores[0] + scores[1]).toBe(puzzle.boxesLeft)
    },
  )

  it('models the half-hearted handout', () => {
    // A two-box chain plus a seven-box chain. Opening the short chain through
    // its middle forces the opponent to take two and then open the long one,
    // so the mover finishes +5 rather than -5.
    expect(endgameValue({ chains: [2, 7], loops: [] })).toBe(5)
    // With no short chain to hand over, the mover simply loses control.
    expect(endgameValue({ chains: [4, 8], loops: [] })).toBe(-8)
  })
})
