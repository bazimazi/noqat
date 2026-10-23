import type { Move } from '../../core/types.ts'

export interface MatchHighlights {
  readonly biggestChain: number
  readonly doubleCaptures: number
  readonly scoringMoves: number
}

/** Consecutive captures in one turn form a chain; a quiet move ends it. */
export function matchHighlights(moves: readonly Move[], seat: number): MatchHighlights {
  let biggestChain = 0
  let chain = 0
  let doubleCaptures = 0
  let scoringMoves = 0
  for (const move of moves) {
    if (move.player !== seat || move.captured.length === 0) {
      chain = 0
      continue
    }
    chain += move.captured.length
    biggestChain = Math.max(biggestChain, chain)
    scoringMoves++
    if (move.captured.length === 2) doubleCaptures++
  }
  return { biggestChain, doubleCaptures, scoringMoves }
}

/** The solver's reachable par earns all three stars, even when it loses the match. */
export function puzzleStars(score: number, par: number, completed = true): 0 | 1 | 2 | 3 {
  if (!completed) return 0
  if (score >= par) return 3
  if (score >= Math.max(0, par - 1)) return 2
  if (score >= Math.max(0, par - 2)) return 1
  return 0
}
