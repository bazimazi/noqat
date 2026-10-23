import { describe, expect, it } from 'vitest'
import { applyMove, createPosition, isComplete, legalMoves } from '../../core/rules.ts'
import { DEFAULT_RULES, type Position, type RuleSet } from '../../core/types.ts'
import { createRng } from '../../lib/rng.ts'
import { chooseMove } from '../engine.ts'
import { DIFFICULTIES } from '../types.ts'

const VARIANTS = [
  { name: 'Reverse', rules: { ...DEFAULT_RULES, misere: true } },
  { name: 'One Line', rules: { ...DEFAULT_RULES, extraTurnOnCapture: false } },
  { name: 'Reverse with alternating turns', rules: { ...DEFAULT_RULES, misere: true, extraTurnOnCapture: false } },
]

/** Independent exhaustive reference using real positions and rule transitions. */
function exactValue(position: Position, rules: RuleSet, player: number): number {
  if (isComplete(position)) return (rules.misere ? -1 : 1) * (position.scores[player] - position.scores[1 - player])
  const values = legalMoves(position).map((edge) => exactValue(applyMove(position, edge, rules).position, rules, player))
  return position.current === player ? Math.max(...values) : Math.min(...values)
}

describe.each(VARIANTS)('$name AI', ({ rules }) => {
  it('matches an exhaustive reference on varied endgames', () => {
    for (let seed = 1; seed <= 4; seed++) {
      const rng = createRng(seed)
      let position = createPosition({ rows: 2, cols: 2 }, rules)
      while (legalMoves(position).length > 7) position = applyMove(position, rng.pick(legalMoves(position)), rules).position
      const response = chooseMove({ id: seed, position, rules, difficulty: 'grandmaster', seed, timeBudgetMs: 500 })
      const expected = exactValue(position, rules, position.current)
      const actual = exactValue(applyMove(position, response.edge, rules).position, rules, position.current)
      expect(actual).toBe(expected)
      expect(response.method).toBe('search')
      // Request snapshots must remain untouched by make/unmake and deadlines.
      expect(legalMoves(position)).toHaveLength(7)
    }
  })

  it.each(DIFFICULTIES)('%s completes a legal game under a short budget', (difficulty) => {
    let position = createPosition({ rows: 2, cols: 2 }, rules)
    let ply = 0
    while (!isComplete(position) && ply++ < 13) {
      const response = chooseMove({ id: ply, position, rules, difficulty, seed: ply, timeBudgetMs: 5 })
      expect(legalMoves(position)).toContain(response.edge)
      position = applyMove(position, response.edge, rules).position
    }
    expect(isComplete(position)).toBe(true)
    expect(position.scores.reduce((total, score) => total + score, 0)).toBe(4)
  })
})
