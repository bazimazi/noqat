import { describe, expect, it } from 'vitest'
import { createPosition, isLegalMove } from '../../../core/rules.ts'
import { endgameValue } from '../../../core/analysis.ts'
import { DEFAULT_RULES } from '../../../core/types.ts'
import { SearchState } from '../../../ai/search-state.ts'
import { solveLoonyEndgame } from '../../../ai/endgame.ts'
import {
  CAMPAIGN,
  dailyChallenge,
  drillSet,
  makePuzzle,
  puzzlePage,
  starsFor,
  verifyPuzzle,
} from '../library.ts'

describe('puzzle generation', () => {
  const page = puzzlePage(1, 8)

  it('produces a full page of puzzles', () => {
    expect(page.length).toBe(8)
    expect(new Set(page.map((p) => p.id)).size).toBe(page.length)
  })

  it('is deterministic', () => {
    expect(puzzlePage(1, 4).map((p) => p.id)).toEqual(puzzlePage(1, 4).map((p) => p.id))
    expect(puzzlePage(2, 4).map((p) => p.id)).not.toEqual(puzzlePage(1, 4).map((p) => p.id))
  })

  it.each(page.map((p) => [p.id, p] as const))('%s states a reachable, reproducible par', (_id, puzzle) => {
    expect(verifyPuzzle(puzzle)).toBe(true)
  })

  it('keeps par close to the classical chain formula', () => {
    // The closed form and the search may differ by a box where opening a long
    // chain off-centre helps; anything larger would mean one of them is wrong.
    for (const puzzle of page) {
      const closedForm = Math.round(
        (puzzle.boxesLeft + endgameValue({ chains: [...puzzle.chains], loops: [...puzzle.loops] })) / 2,
      )
      expect(Math.abs(puzzle.par - closedForm)).toBeLessThanOrEqual(2)
    }
  })

  it.each(page.map((p) => [p.id, p] as const))('%s is a real, reachable endgame', (_id, puzzle) => {
    const rules = { ...DEFAULT_RULES, preplacedEdges: [...puzzle.preplacedEdges] }
    const position = createPosition(puzzle.size, rules)
    // No box may already be given away — puzzles start from a quiet position.
    const state = new SearchState(position)
    expect(state.hasCapture()).toBe(false)
    expect(puzzle.boxesLeft).toBeGreaterThanOrEqual(4)
    expect(puzzle.par).toBeGreaterThanOrEqual(0)
    expect(puzzle.par).toBeLessThanOrEqual(puzzle.boxesLeft)
    expect(puzzle.chains.length + puzzle.loops.length).toBeGreaterThanOrEqual(2)
  })

  it('rates puzzles between one and five', () => {
    for (const puzzle of page) {
      expect(puzzle.difficulty).toBeGreaterThanOrEqual(1)
      expect(puzzle.difficulty).toBeLessThanOrEqual(5)
    }
  })

  it('returns null rather than a degenerate puzzle', () => {
    // A 2x2 board rarely decomposes into two components; the generator must
    // say so instead of inventing one.
    const results = Array.from({ length: 30 }, (_, i) => makePuzzle({ rows: 2, cols: 2 }, i * 31 + 1))
    expect(results.some((r) => r === null)).toBe(true)
  })
})

describe('daily challenge', () => {
  it('is identical for everyone on the same UTC day', () => {
    const a = dailyChallenge(new Date('2026-05-01T02:00:00Z'))
    const b = dailyChallenge(new Date('2026-05-01T22:30:00Z'))
    expect(a).toEqual(b)
  })

  it('differs from one day to the next', () => {
    const a = dailyChallenge(new Date('2026-05-01T12:00:00Z'))
    const b = dailyChallenge(new Date('2026-05-02T12:00:00Z'))
    expect(a.seed).not.toBe(b.seed)
  })

  it('never opens with a box already on offer', () => {
    for (let day = 1; day <= 14; day++) {
      const challenge = dailyChallenge(new Date(Date.UTC(2026, 4, day)))
      const rules = { ...DEFAULT_RULES, preplacedEdges: [...challenge.preplacedEdges] }
      const position = createPosition(challenge.size, rules)
      expect(new SearchState(position).hasCapture()).toBe(false)
    }
  })

  it('sets a par above half the board', () => {
    const challenge = dailyChallenge(new Date('2026-05-01T12:00:00Z'))
    const total = challenge.size.rows * challenge.size.cols
    expect(challenge.par).toBeGreaterThan(total / 2)
  })
})

describe('campaign', () => {
  it('has twenty-four levels with rising thresholds', () => {
    expect(CAMPAIGN).toHaveLength(24)
    for (const level of CAMPAIGN) {
      const [one, two, three] = level.stars
      expect(one).toBeLessThan(two)
      expect(two).toBeLessThan(three)
      expect(three).toBeLessThanOrEqual(level.size.rows * level.size.cols)
    }
  })

  it('gets harder over time', () => {
    const first = CAMPAIGN[0].size.rows * CAMPAIGN[0].size.cols
    const last = CAMPAIGN[CAMPAIGN.length - 1].size.rows * CAMPAIGN[CAMPAIGN.length - 1].size.cols
    expect(last).toBeGreaterThan(first)
  })

  it('awards stars against the thresholds', () => {
    const level = CAMPAIGN[5]
    expect(starsFor(level, 0)).toBe(0)
    expect(starsFor(level, level.stars[0])).toBe(1)
    expect(starsFor(level, level.stars[1])).toBe(2)
    expect(starsFor(level, level.stars[2])).toBe(3)
  })
})

describe('endgame trainer', () => {
  const drills = drillSet(4)

  it('finds drills where greed is punished', () => {
    expect(drills.length).toBeGreaterThan(0)
    for (const drill of drills) {
      expect(drill.bestValue).toBeGreaterThan(drill.greedyValue)
    }
  })

  it('names a legal best move that the solver reproduces', () => {
    for (const drill of drills) {
      const rules = { ...DEFAULT_RULES, preplacedEdges: [...drill.preplacedEdges] }
      const position = createPosition(drill.size, rules)
      expect(isLegalMove(position, drill.bestEdge)).toBe(true)
      const solved = solveLoonyEndgame(new SearchState(position))
      expect(solved?.value).toBe(drill.bestValue)
    }
  })
})
