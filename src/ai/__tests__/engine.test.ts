import { describe, expect, it } from 'vitest'
import { hEdge, vEdge } from '../../core/board.ts'
import { applyMove, createPosition, isComplete, legalMoves, outcome } from '../../core/rules.ts'
import { DEFAULT_RULES, type BoardSize, type Position } from '../../core/types.ts'
import { chooseMove } from '../engine.ts'
import { SearchState } from '../search-state.ts'
import { solveLoonyEndgame } from '../endgame.ts'
import { DIFFICULTY_PROFILES, type Difficulty } from '../types.ts'

function ask(position: Position, difficulty: Difficulty, seed = 1): number {
  return chooseMove({
    id: 1,
    position,
    rules: DEFAULT_RULES,
    difficulty,
    seed,
  }).edge
}

/** Plays a full game between two difficulties and returns the final position. */
function playGame(size: BoardSize, a: Difficulty, b: Difficulty, seed: number): Position {
  let position = createPosition(size)
  let guard = 0
  while (!isComplete(position) && guard++ < 400) {
    const difficulty = position.current === 0 ? a : b
    const edge = chooseMove({
      id: guard,
      position,
      rules: DEFAULT_RULES,
      difficulty,
      seed: seed + guard,
      timeBudgetMs: 60,
    }).edge
    expect(legalMoves(position)).toContain(edge)
    position = applyMove(position, edge, DEFAULT_RULES).position
  }
  expect(isComplete(position)).toBe(true)
  return position
}

describe('AI move legality', () => {
  const size: BoardSize = { rows: 3, cols: 3 }

  it.each(Object.keys(DIFFICULTY_PROFILES) as Difficulty[])(
    '%s always returns a legal move',
    (difficulty) => {
      let position = createPosition(size)
      let guard = 0
      while (!isComplete(position) && guard++ < 200) {
        const edge = ask(position, difficulty, guard)
        expect(legalMoves(position)).toContain(edge)
        position = applyMove(position, edge, DEFAULT_RULES).position
      }
      expect(isComplete(position)).toBe(true)
    },
  )

  it('handles a board with a single move left', () => {
    let position = createPosition({ rows: 2, cols: 2 })
    const moves = legalMoves(position)
    for (const e of moves.slice(0, moves.length - 1)) {
      position = applyMove(position, e, DEFAULT_RULES).position
    }
    expect(ask(position, 'grandmaster')).toBe(moves[moves.length - 1])
  })
})

describe('AI competence', () => {
  const size: BoardSize = { rows: 2, cols: 2 }

  it('takes a free box when one is available', () => {
    let position = createPosition(size)
    for (const e of [hEdge(size, 0, 0), hEdge(size, 1, 0), vEdge(size, 0, 0)]) {
      position = applyMove(position, e, DEFAULT_RULES).position
    }
    // Box 0 needs only its right edge.
    for (const difficulty of ['medium', 'hard', 'expert', 'grandmaster'] as Difficulty[]) {
      expect(ask(position, difficulty)).toBe(vEdge(size, 0, 1))
    }
  })

  it('does not hand over a box when a safe move exists', () => {
    const size3: BoardSize = { rows: 3, cols: 3 }
    let position = createPosition(size3)
    // Give box 0 two edges, making its remaining two edges loony.
    position = applyMove(position, hEdge(size3, 0, 0), DEFAULT_RULES).position
    position = applyMove(position, vEdge(size3, 0, 0), DEFAULT_RULES).position
    const state = new SearchState(position)
    for (const difficulty of ['hard', 'expert', 'grandmaster'] as Difficulty[]) {
      const edge = ask(position, difficulty)
      expect(state.isLoony(edge)).toBe(false)
    }
  })
})

describe('endgame solver', () => {
  it('solves a two-chain position and keeps control', () => {
    // 1x5 strip with every horizontal edge drawn: one chain of five.
    const size: BoardSize = { rows: 1, cols: 5 }
    const position = createPosition(size)
    const edges = new Uint8Array(position.edges)
    for (let r = 0; r <= 1; r++) for (let c = 0; c < 5; c++) edges[hEdge(size, r, c)] = 1
    const state = new SearchState({ ...position, edges })
    const solved = solveLoonyEndgame(state)
    expect(solved).not.toBeNull()
    // Whoever must open a lone 5-chain loses all five boxes.
    expect(solved!.value).toBe(-5)
  })

  it('returns null while the board still has dense boxes', () => {
    expect(solveLoonyEndgame(new SearchState(createPosition({ rows: 4, cols: 4 })))).toBeNull()
  })
})

describe('AI strength ordering', () => {
  it('grandmaster beats beginner on a 3x3 board', () => {
    let grandmasterBoxes = 0
    let beginnerBoxes = 0
    for (let seed = 0; seed < 4; seed++) {
      // Alternate who starts so the result is not a first-player artefact.
      const gmFirst = seed % 2 === 0
      const final = playGame(
        { rows: 3, cols: 3 },
        gmFirst ? 'grandmaster' : 'beginner',
        gmFirst ? 'beginner' : 'grandmaster',
        seed * 977,
      )
      grandmasterBoxes += gmFirst ? final.scores[0] : final.scores[1]
      beginnerBoxes += gmFirst ? final.scores[1] : final.scores[0]
    }
    expect(grandmasterBoxes).toBeGreaterThan(beginnerBoxes)
  })

  it('expert does not lose to easy across several games', () => {
    let expertWins = 0
    let easyWins = 0
    for (let seed = 0; seed < 4; seed++) {
      const expertFirst = seed % 2 === 0
      const final = playGame(
        { rows: 3, cols: 3 },
        expertFirst ? 'expert' : 'easy',
        expertFirst ? 'easy' : 'expert',
        seed * 613,
      )
      const result = outcome(final)
      if (result.kind === 'win') {
        const expertIndex = expertFirst ? 0 : 1
        if (result.winners[0] === expertIndex) expertWins++
        else easyWins++
      }
    }
    expect(expertWins).toBeGreaterThanOrEqual(easyWins)
  })
})

describe('difficulty profiles', () => {
  it('increase monotonically in rating', () => {
    const order: Difficulty[] = ['beginner', 'easy', 'medium', 'hard', 'expert', 'grandmaster']
    const elos = order.map((d) => DIFFICULTY_PROFILES[d].elo)
    expect(elos).toEqual([...elos].sort((a, b) => a - b))
  })

  it('makes the weakest level genuinely fallible', () => {
    expect(DIFFICULTY_PROFILES.beginner.blunderRate).toBeGreaterThan(0.4)
    expect(DIFFICULTY_PROFILES.grandmaster.blunderRate).toBe(0)
  })
})
