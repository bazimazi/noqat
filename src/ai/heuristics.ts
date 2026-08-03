/**
 * Leaf evaluation.
 *
 * Material counting is almost worthless in Dots & Boxes — boxes change hands in
 * bursts at the very end. What actually decides the game is *who is forced to
 * open the first long chain*, so the evaluation is built from tempo and chain
 * structure rather than from the score.
 */
import { endgameValue } from '../core/analysis.ts'
import type { SearchState } from './search-state.ts'

/** Counts free edges that give nothing away. */
export function safeMoveCount(state: SearchState): number {
  let n = 0
  for (let e = 0; e < state.drawn.length; e++) {
    if (state.drawn[e] !== 0) continue
    if (!state.isLoony(e)) n++
  }
  return n
}

const memo = new Map<string, number>()

function cachedEndgameValue(chains: readonly number[], loops: readonly number[]): number {
  if (chains.length === 0 && loops.length === 0) return 0
  const key = `${chains.join(',')}|${loops.join(',')}`
  const hit = memo.get(key)
  if (hit !== undefined) return hit
  const value = endgameValue({ chains, loops })
  if (memo.size > 60_000) memo.clear()
  memo.set(key, value)
  return value
}

/**
 * Net boxes the side to move should expect, positive being good for them.
 *
 * Exact once the board has decomposed into chains and loops; a damped estimate
 * while a dense "unopened" region remains.
 */
export function evaluate(state: SearchState): number {
  const { chains, loops, hasBigRegion } = state.decompose()

  // `endgameValue` is written from the point of view of whoever must open.
  const openerValue = cachedEndgameValue(chains, loops)

  if (!hasBigRegion) {
    const safe = safeMoveCount(state)
    // With no safe moves left the side to move *is* the opener. Otherwise the
    // players burn the safe moves alternately and parity decides who opens.
    const iAmOpener = safe % 2 === 0
    return iAmOpener ? openerValue : -openerValue
  }

  const safe = safeMoveCount(state)
  const iAmOpener = safe % 2 === 0
  const structural = (iAmOpener ? openerValue : -openerValue) * 0.6

  // Long-chain rule: with an even number of dots the first player wants an odd
  // number of long chains. In this frame "the first player" is whoever is *not*
  // going to be the opener, so it reduces to a bonus on chain-count parity.
  let longChains = 0
  for (const c of chains) if (c >= 3) longChains++
  const totalLoopBoxes = loops.reduce((a, b) => a + b, 0)
  const parityFavoursMe = (longChains + loops.length) % 2 === (iAmOpener ? 1 : 0)
  const parityWeight = 0.8 + 0.05 * totalLoopBoxes
  const parity = parityFavoursMe ? parityWeight : -parityWeight

  // Prefer keeping options open: a position with more safe moves is more
  // flexible, and flexibility is what wins the tempo battle.
  const flexibility = Math.min(safe, 12) * 0.02 * (iAmOpener ? -1 : 1)

  return structural + parity + flexibility
}

/**
 * Cheap ordering score used before the transposition move is known.
 * Higher is tried first.
 */
export function moveOrderScore(state: SearchState, edge: number): number {
  const captures = state.capturesFor(edge)
  if (captures > 0) return 100 + captures
  if (state.isLoony(edge)) return -50
  return 0
}
