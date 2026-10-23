import { describe, expect, it } from 'vitest'
import { DEFAULT_RULES } from '../../core/types.ts'
import { selectOutcome, useGame } from '../gameStore.ts'

const players = [{ kind: 'human' as const, name: 'A' }, { kind: 'human' as const, name: 'B' }]
const resume = { v: 1, rows: 3, cols: 3, rules: { ...DEFAULT_RULES, gameTimeLimit: 180 }, moves: [0, 1] }

describe('saved game clocks', () => {
  it('restores remaining time and original creation time', () => {
    const startedAt = Date.now() - 60_000
    useGame.getState().start({ size: { rows: 3, cols: 3 }, players, mode: 'blitz', resume, clocks: [123_400, 170_000], startedAt })
    expect(useGame.getState().clocks).toEqual([123_400, 170_000])
    expect(useGame.getState().startedAt).toBe(startedAt)
    expect(useGame.getState().status).toBe('playing')
  })

  it('keeps an expired clock expired and records the correct winner', () => {
    useGame.getState().start({ size: { rows: 3, cols: 3 }, players, resume, clocks: [0, 100_000] })
    const state = useGame.getState()
    expect(state.status).toBe('finished')
    expect(state.flaggedBy).toBe(0)
    expect(state.moveDeadline).toBeNull()
    expect(selectOutcome(state)).toEqual({ kind: 'win', winners: [1] })
  })

  it('sanitizes corrupt clocks and timestamps without creating infinite timed games', () => {
    useGame.getState().start({ size: { rows: 3, cols: 3 }, players, resume, clocks: [Infinity, NaN], startedAt: Infinity })
    expect(useGame.getState().clocks).toEqual([180_000, 180_000])
    expect(Number.isFinite(useGame.getState().startedAt)).toBe(true)
    useGame.getState().start({ size: { rows: 3, cols: 3 }, players, resume, clocks: [999_999, -3] })
    expect(useGame.getState().clocks).toEqual([180_000, 0])
    expect(useGame.getState().flaggedBy).toBe(1)
  })

  it('keeps untimed saves untimed', () => {
    useGame.getState().start({ size: { rows: 3, cols: 3 }, players, resume: { ...resume, rules: DEFAULT_RULES }, clocks: [null as unknown as number, 0] })
    expect(useGame.getState().clocks).toEqual([Infinity, Infinity])
    expect(useGame.getState().status).toBe('playing')
  })
})
