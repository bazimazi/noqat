import { describe, expect, it } from 'vitest'
import { hEdge, tablesFor, vEdge } from '../../../core/board.ts'
import { applyMove, boxEdgeCount, createPosition, isComplete, legalMoves, NEUTRAL_OWNER, outcome } from '../../../core/rules.ts'
import { DEFAULT_RULES } from '../../../core/types.ts'
import { deserializeGame, serializeMoves } from '../../../core/serialization.ts'
import { useGame } from '../../../state/gameStore.ts'
import { gardenOpening, getVariantCopy, VARIANT_MODES } from '../variants.ts'

describe('Persian garden openings', () => {
  it('is reproducible, varied, mirrored and never offers a free box', () => {
    for (const size of [{ rows: 2, cols: 2 }, { rows: 3, cols: 5 }, { rows: 5, cols: 5 }, { rows: 12, cols: 12 }]) {
      const patterns = new Set<string>()
      for (let seed = 1; seed <= 12; seed++) {
        const edges = gardenOpening(size, seed)
        expect(edges).toEqual(gardenOpening(size, seed))
        expect(edges.length).toBeGreaterThanOrEqual(4)
        expect(new Set(edges).size).toBe(edges.length)
        patterns.add(edges.join(','))
        const rules = { ...DEFAULT_RULES, preplacedEdges: edges }
        const position = createPosition(size, rules)
        expect(position.scores).toEqual([0, 0])
        for (let box = 0; box < position.boxes.length; box++) expect(boxEdgeCount(position, box)).toBeLessThanOrEqual(2)
        for (const id of edges) {
          const edge = tablesFor(size).geometry[id]
          const horizontalMirror = edge.orientation === 'h'
            ? hEdge(size, edge.row, size.cols - 1 - edge.col)
            : vEdge(size, edge.row, size.cols - edge.col)
          const verticalMirror = edge.orientation === 'h'
            ? hEdge(size, size.rows - edge.row, edge.col)
            : vEdge(size, size.rows - 1 - edge.row, edge.col)
          expect(edges).toContain(horizontalMirror)
          expect(edges).toContain(verticalMirror)
          expect(position.edges[id]).toBe(NEUTRAL_OWNER)
        }
      }
      expect(patterns.size).toBeGreaterThan(1)
    }
  })

  it('can be played to completion and serialized without losing terrain', () => {
    const size = { rows: 3, cols: 4 }
    const rules = { ...DEFAULT_RULES, preplacedEdges: gardenOpening(size, 42) }
    let position = createPosition(size, rules)
    const moves = []
    while (!isComplete(position)) {
      const result = applyMove(position, legalMoves(position)[0], rules)
      position = result.position
      moves.push(result.move)
    }
    expect(position.scores.reduce((sum, score) => sum + score, 0)).toBe(12)
    const restored = deserializeGame(serializeMoves(size, rules, moves))
    expect(restored.positions.at(-1)).toEqual(position)
  })
})

describe('variant game presets', () => {
  const size = { rows: 2, cols: 2 }
  const players = [{ kind: 'human' as const, name: 'A' }, { kind: 'human' as const, name: 'B' }]

  it('passes the turn after a capture in One Line', () => {
    useGame.getState().start({ size, players, mode: 'one-line' })
    for (const edge of [hEdge(size, 0, 0), hEdge(size, 1, 0), vEdge(size, 0, 0), vEdge(size, 0, 1)]) useGame.getState().play(edge)
    const state = useGame.getState()
    expect(state.positions.at(-1)?.scores).toEqual([0, 1])
    expect(state.positions.at(-1)?.current).toBe(0)
  })

  it('awards Reverse to the lowest score', () => {
    useGame.getState().start({ size, players, mode: 'misere' })
    while (useGame.getState().status === 'playing') {
      const position = useGame.getState().positions.at(-1)!
      useGame.getState().play(legalMoves(position)[0])
    }
    const state = useGame.getState()
    const final = state.positions.at(-1)!
    expect(state.rules.misere).toBe(true)
    const result = outcome(final, state.rules)
    expect(result.kind).not.toBe('in-progress')
    if (result.kind !== 'in-progress') {
      for (const winner of result.winners) expect(final.scores[winner]).toBe(Math.min(...final.scores))
    }
  })

  it('creates seeded terrain when starting Garden directly', () => {
    useGame.getState().start({ size, players, mode: 'garden', seed: 123 })
    expect(useGame.getState().rules.preplacedEdges).toEqual(gardenOpening(size, 123))
  })

  it('has complete English and Persian rules for every new mode', () => {
    for (const mode of VARIANT_MODES) {
      expect(getVariantCopy(mode, 'en').description.length).toBeGreaterThan(20)
      expect(getVariantCopy(mode, 'fa').rule).toMatch(/[\u0600-\u06ff]/)
    }
  })
})
