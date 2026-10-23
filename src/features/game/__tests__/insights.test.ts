import { describe, expect, it } from 'vitest'
import { applyMove, createPosition } from '../../../core/rules.ts'
import { hEdge, vEdge } from '../../../core/board.ts'
import type { Move } from '../../../core/types.ts'
import { boardInsight, captureRun, edgeInsight } from '../insights.ts'

const size = { rows: 2, cols: 2 }
function move(player: 0 | 1, captured: number[]): Move { return { player, captured, edge: 0, ply: 0 } }

describe('coaching a real position', () => {
  it('distinguishes a safe line, a third side and a completing line', () => {
    let position = createPosition(size)
    const top = hEdge(size, 0, 0)
    const bottom = hEdge(size, 1, 0)
    const left = vEdge(size, 0, 0)
    const right = vEdge(size, 0, 1)
    expect(edgeInsight(position, top)).toBe('safe')
    position = applyMove(position, top).position
    position = applyMove(position, bottom).position
    expect(edgeInsight(position, left)).toBe('risk')
    position = applyMove(position, left).position
    expect(edgeInsight(position, right)).toBe('capture')
    expect(boardInsight(position).captures).toBe(1)
    position = applyMove(position, right).position
    expect(boardInsight(position).claimed).toBe(1)
    expect(edgeInsight(position, right)).toBeNull()
    expect(edgeInsight(position, -1)).toBeNull()
  })
  it('counts consecutive boxes rather than moves and resets on a new turn', () => {
    expect(captureRun([])).toBe(0)
    expect(captureRun([move(0,[0]), move(0,[1,2])])).toBe(3)
    expect(captureRun([move(0,[0,1]), move(1,[2])])).toBe(1)
    expect(captureRun([move(0,[0]), move(0,[])])).toBe(0)
    expect(captureRun([move(1,[]), move(0,[0]), move(0,[1])])).toBe(2)
  })
})
