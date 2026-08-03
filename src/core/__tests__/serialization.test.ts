import { describe, expect, it } from 'vitest'
import {
  decodeShareCode,
  deserializeGame,
  encodeShareCode,
  hashPosition,
  serializeMoves,
} from '../serialization.ts'
import { applyMove, createPosition, legalMoves } from '../rules.ts'
import { DEFAULT_RULES, type BoardSize, type Move } from '../types.ts'

const size: BoardSize = { rows: 3, cols: 3 }

function playRandomish(count: number): Move[] {
  let p = createPosition(size)
  const moves: Move[] = []
  for (let i = 0; i < count; i++) {
    const options = legalMoves(p)
    if (!options.length) break
    const result = applyMove(p, options[(i * 5 + 3) % options.length], DEFAULT_RULES, {
      thinkMs: i * 10,
    })
    p = result.position
    moves.push(result.move)
  }
  return moves
}

describe('serialization', () => {
  it('round-trips a game through serialize/deserialize', () => {
    const moves = playRandomish(12)
    const data = serializeMoves(size, DEFAULT_RULES, moves)
    const restored = deserializeGame(data)
    expect(restored.moves.map((m) => m.edge)).toEqual(moves.map((m) => m.edge))
    expect(restored.positions).toHaveLength(moves.length + 1)
    expect(restored.positions.at(-1)!.scores).toEqual(
      moves.reduce(
        (acc, m) => {
          acc[m.player] += m.captured.length
          return acc
        },
        [0, 0],
      ),
    )
  })

  it('truncates at the first illegal move instead of throwing', () => {
    const restored = deserializeGame({
      v: 1,
      rows: 2,
      cols: 2,
      rules: DEFAULT_RULES,
      moves: [0, 1, 0 /* replayed edge */, 2],
    })
    expect(restored.moves).toHaveLength(2)
  })

  it('round-trips a share code', () => {
    const moves = playRandomish(20)
    const data = serializeMoves(size, DEFAULT_RULES, moves)
    const code = encodeShareCode(data)
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/)
    const decoded = decodeShareCode(code)
    expect(decoded.rows).toBe(size.rows)
    expect(decoded.cols).toBe(size.cols)
    expect(decoded.moves).toEqual(data.moves)
  })

  it('encodes large edge ids across the varint boundary', () => {
    const data = {
      v: 1,
      rows: 12,
      cols: 12,
      rules: DEFAULT_RULES,
      moves: [0, 31, 32, 100, 311],
    }
    expect(decodeShareCode(encodeShareCode(data)).moves).toEqual(data.moves)
  })

  it('rejects malformed share codes', () => {
    expect(() => decodeShareCode('!!!')).toThrow()
    expect(() => decodeShareCode('')).toThrow()
  })

  it('hashes identical positions identically and different ones differently', () => {
    const a = createPosition(size)
    const b = applyMove(a, 4).position
    expect(hashPosition(a)).toBe(hashPosition(createPosition(size)))
    expect(hashPosition(a)).not.toBe(hashPosition(b))
  })
})
