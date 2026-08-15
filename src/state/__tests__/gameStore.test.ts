import { beforeEach, describe, expect, it } from 'vitest'
import { hEdge, vEdge } from '../../core/board.ts'
import { createPosition, legalMoves } from '../../core/rules.ts'
import {
  selectCurrentPlayer,
  selectIsHumanTurn,
  selectIsLive,
  selectLivePosition,
  selectOutcome,
  selectTension,
  selectVisiblePosition,
  useGame,
  type PlayerConfig,
} from '../gameStore.ts'
import { levelFromXp, nextElo, unlockedThemesFor, xpForGame, countDailyStreak } from '../profileStore.ts'

const HUMANS: PlayerConfig[] = [
  { kind: 'human', name: 'A' },
  { kind: 'human', name: 'B' },
]
const VS_AI: PlayerConfig[] = [
  { kind: 'human', name: 'You' },
  { kind: 'ai', name: 'Computer', difficulty: 'medium' },
]

const size = { rows: 2, cols: 2 }

describe('game store', () => {
  beforeEach(() => {
    useGame.getState().reset()
    useGame.getState().start({ size, players: HUMANS })
  })

  it('starts a fresh game in the playing state', () => {
    const state = useGame.getState()
    expect(state.status).toBe('playing')
    expect(state.moves).toHaveLength(0)
    expect(state.positions).toHaveLength(1)
    expect(selectIsLive(state)).toBe(true)
    expect(selectCurrentPlayer(state)).toBe(0)
  })

  it('applies a legal move and appends to the timeline', () => {
    expect(useGame.getState().play(0)).toBe(true)
    const state = useGame.getState()
    expect(state.moves).toHaveLength(1)
    expect(state.positions).toHaveLength(2)
    expect(selectCurrentPlayer(state)).toBe(1)
  })

  it('rejects an illegal move without changing state', () => {
    useGame.getState().play(0)
    expect(useGame.getState().play(0)).toBe(false)
    expect(useGame.getState().moves).toHaveLength(1)
  })

  it('records a capture event with a rising nonce', () => {
    const { play } = useGame.getState()
    play(hEdge(size, 0, 0))
    play(hEdge(size, 1, 0))
    play(vEdge(size, 0, 0))
    play(vEdge(size, 0, 1)) // closes box 0
    const capture = useGame.getState().lastCapture
    expect(capture).not.toBeNull()
    expect(capture!.boxes).toEqual([0])
    expect(capture!.nonce).toBe(1)
  })

  it('finishes when the board fills up', () => {
    let guard = 0
    while (useGame.getState().status === 'playing' && guard++ < 40) {
      const moves = legalMoves(selectLivePosition(useGame.getState()))
      useGame.getState().play(moves[0])
    }
    const state = useGame.getState()
    expect(state.status).toBe('finished')
    expect(state.finishedAt).toBeGreaterThan(0)
    expect(selectOutcome(state).kind).not.toBe('in-progress')
  })

  it('scrubs through history without forking it', () => {
    useGame.getState().play(0)
    useGame.getState().play(1)
    useGame.getState().scrub(0)
    const state = useGame.getState()
    expect(selectIsLive(state)).toBe(false)
    expect(selectVisiblePosition(state).ply).toBe(0)
    expect(selectLivePosition(state).ply).toBe(2)
    useGame.getState().goLive()
    expect(selectIsLive(useGame.getState())).toBe(true)
  })

  it('plays a replay back from the start and stops at the end', () => {
    useGame.getState().play(0)
    useGame.getState().play(1)
    useGame.getState().watchReplay()
    expect(useGame.getState().cursor).toBe(0)
    expect(useGame.getState().replaying).toBe(true)

    useGame.getState().advanceReplay()
    expect(useGame.getState().cursor).toBe(1)
    expect(useGame.getState().replaying).toBe(true)

    useGame.getState().advanceReplay()
    expect(useGame.getState().cursor).toBe(2)
    // The last position is the live one, so there is nothing left to play.
    expect(useGame.getState().replaying).toBe(false)
    expect(selectIsLive(useGame.getState())).toBe(true)
  })

  it('hands control back to the viewer who scrubs mid-replay', () => {
    useGame.getState().play(0)
    useGame.getState().play(1)
    useGame.getState().watchReplay()
    useGame.getState().scrub(1)
    expect(useGame.getState().replaying).toBe(false)
    expect(useGame.getState().cursor).toBe(1)
  })

  it('clamps scrubbing to the available range', () => {
    useGame.getState().play(0)
    useGame.getState().scrub(-5)
    expect(useGame.getState().cursor).toBe(0)
    useGame.getState().scrub(999)
    expect(useGame.getState().cursor).toBe(1)
  })

  it('pauses and resumes', () => {
    useGame.getState().pause()
    expect(useGame.getState().status).toBe('paused')
    expect(useGame.getState().play(0)).toBe(false)
    useGame.getState().resume()
    expect(useGame.getState().status).toBe('playing')
    expect(useGame.getState().play(0)).toBe(true)
  })

  it('undoes back to the human player’s decision, including the AI reply', () => {
    useGame.getState().start({ size: { rows: 3, cols: 3 }, players: VS_AI })
    useGame.getState().play(0) // human
    useGame.getState().play(1) // "ai"
    expect(useGame.getState().moves).toHaveLength(2)
    expect(useGame.getState().undo()).toBe(true)
    const state = useGame.getState()
    expect(state.moves).toHaveLength(0)
    expect(selectIsHumanTurn(state)).toBe(true)
  })

  it('refuses to undo an online game', () => {
    useGame.getState().start({ size, players: HUMANS, mode: 'online' })
    useGame.getState().play(0)
    expect(useGame.getState().undo()).toBe(false)
  })

  it('refuses to undo with nothing played', () => {
    expect(useGame.getState().undo()).toBe(false)
  })

  it('runs a clock only in timed modes', () => {
    useGame.getState().start({ size, players: HUMANS, mode: 'classic' })
    useGame.getState().tick(5000)
    expect(useGame.getState().clocks[0]).toBe(Number.POSITIVE_INFINITY)

    useGame.getState().start({ size, players: HUMANS, mode: 'blitz' })
    expect(useGame.getState().clocks[0]).toBe(180_000)
    useGame.getState().tick(5000)
    expect(useGame.getState().clocks[0]).toBe(175_000)
    expect(useGame.getState().clocks[1]).toBe(180_000)
  })

  it('ends the game when a clock runs out', () => {
    useGame.getState().start({ size, players: HUMANS, mode: 'blitz' })
    useGame.getState().tick(200_000)
    expect(useGame.getState().clocks[0]).toBe(0)
    expect(useGame.getState().status).toBe('finished')
  })

  it('awards a flagged game to the opponent rather than reporting no result', () => {
    // The board is still half empty when a clock runs out, so the position on
    // its own says "in progress" — only the flag decides it.
    useGame.getState().start({ size, players: HUMANS, mode: 'blitz' })
    useGame.getState().tick(200_000)
    expect(selectOutcome(useGame.getState())).toEqual({ kind: 'win', winners: [1] })
  })

  it('clears a forfeit when the game is unwound', () => {
    useGame.getState().start({ size: { rows: 3, cols: 3 }, players: VS_AI })
    useGame.getState().play(0)
    useGame.getState().play(1)
    useGame.getState().resign(0)
    expect(useGame.getState().status).toBe('finished')
    useGame.getState().undo()
    const state = useGame.getState()
    expect(state.status).toBe('playing')
    expect(state.resignedBy).toBeNull()
    expect(state.flaggedBy).toBeNull()
    expect(selectOutcome(state).kind).toBe('in-progress')
  })

  it('pays a finished game out only once, however often the result is revisited', () => {
    let guard = 0
    while (useGame.getState().status === 'playing' && guard++ < 40) {
      useGame.getState().play(legalMoves(selectLivePosition(useGame.getState()))[0])
    }
    expect(useGame.getState().resultRecorded).toBe(false)
    useGame.getState().markResultRecorded()
    expect(useGame.getState().resultRecorded).toBe(true)
    // A rematch is a new game and must be payable again.
    useGame.getState().start({ size, players: HUMANS })
    expect(useGame.getState().resultRecorded).toBe(false)
  })

  it('carries mode context through so the result screen can pay it out', () => {
    useGame.getState().start({
      size,
      players: VS_AI,
      mode: 'campaign',
      context: { campaignLevelId: 'c1', par: 3 },
    })
    expect(useGame.getState().context).toEqual({ campaignLevelId: 'c1', par: 3 })
    useGame.getState().start({ size, players: HUMANS })
    expect(useGame.getState().context).toEqual({})
  })

  it('treats a shared replay as already paid out', () => {
    useGame.getState().start({ size, players: HUMANS, resultRecorded: true })
    expect(useGame.getState().resultRecorded).toBe(true)
  })

  it('sets a per-move deadline in speed mode only', () => {
    useGame.getState().start({ size, players: HUMANS, mode: 'speed' })
    expect(useGame.getState().moveDeadline).toBeGreaterThan(Date.now())
    useGame.getState().start({ size, players: HUMANS, mode: 'classic' })
    expect(useGame.getState().moveDeadline).toBeNull()
  })

  it('awards resignation to the other player', () => {
    useGame.getState().resign(0)
    const result = selectOutcome(useGame.getState())
    expect(result).toEqual({ kind: 'win', winners: [1] })
  })

  it('round-trips through serialize and resume', () => {
    useGame.getState().play(0)
    useGame.getState().play(3)
    const serialized = useGame.getState().serialize()
    useGame.getState().start({ size, players: HUMANS, resume: serialized })
    expect(useGame.getState().moves.map((m) => m.edge)).toEqual([0, 3])
  })

  it('rates a close game as more tense than a blowout at the same stage', () => {
    const base = createPosition({ rows: 3, cols: 3 })
    const stateWith = (scores: number[], claimed: number) => {
      const boxes = new Int8Array(9).fill(-1)
      for (let i = 0; i < claimed; i++) boxes[i] = i < scores[0] ? 0 : 1
      return {
        ...useGame.getState(),
        positions: [{ ...base, boxes, scores }],
        cursor: 0,
      }
    }
    const level = selectTension(stateWith([3, 3], 6))
    const blowout = selectTension(stateWith([6, 0], 6))
    expect(level).toBeGreaterThan(blowout)
  })

  it('always reports tension inside the unit interval', () => {
    let guard = 0
    while (useGame.getState().status === 'playing' && guard++ < 40) {
      const value = selectTension(useGame.getState())
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(1)
      const moves = legalMoves(selectLivePosition(useGame.getState()))
      useGame.getState().play(moves[0])
    }
  })
})

describe('progression maths', () => {
  it('needs more XP at each level', () => {
    const first = levelFromXp(0)
    expect(first.level).toBe(1)
    expect(levelFromXp(80).level).toBe(2)
    expect(levelFromXp(100000).level).toBeGreaterThan(10)
  })

  it('always grants the starter themes', () => {
    const unlocked = unlockedThemesFor(1, [])
    expect(unlocked).toContain('persian')
    expect(unlocked).toContain('minimal')
    expect(unlocked).toContain('japanese')
    expect(unlocked).not.toContain('neon')
  })

  it('unlocks more themes with level', () => {
    expect(unlockedThemesFor(20, [])).toContain('neon')
    expect(unlockedThemesFor(20, []).length).toBeGreaterThan(unlockedThemesFor(3, []).length)
  })

  it('moves Elo toward the result and rewards upsets more', () => {
    const beatStronger = nextElo(1000, 1400, 1, 50)
    const beatWeaker = nextElo(1000, 700, 1, 50)
    expect(beatStronger).toBeGreaterThan(1000)
    expect(beatStronger - 1000).toBeGreaterThan(beatWeaker - 1000)
    expect(nextElo(1000, 1000, 0, 50)).toBeLessThan(1000)
    expect(nextElo(1000, 1000, 0.5, 50)).toBe(1000)
  })

  it('uses a larger K-factor for new players', () => {
    expect(Math.abs(nextElo(1000, 1000, 1, 5) - 1000)).toBeGreaterThan(
      Math.abs(nextElo(1000, 1000, 1, 200) - 1000),
    )
  })

  it('pays more XP for winning, for bigger boards and for stronger opponents', () => {
    const base = { boxes: 13, totalBoxes: 25, perfect: false, drawn: false }
    const win = xpForGame({ ...base, won: true, opponentElo: 1000 })
    const loss = xpForGame({ ...base, won: false, opponentElo: 1000 })
    const bigWin = xpForGame({ ...base, totalBoxes: 36, won: true, opponentElo: 1000 })
    const hardWin = xpForGame({ ...base, won: true, opponentElo: 2350 })
    expect(win).toBeGreaterThan(loss)
    expect(bigWin).toBeGreaterThan(win)
    expect(hardWin).toBeGreaterThan(win)
  })

  it('counts a daily streak backwards from today', () => {
    const today = new Date('2026-03-10T12:00:00Z')
    const results = {
      '2026-03-10': {},
      '2026-03-09': {},
      '2026-03-08': {},
      '2026-03-06': {},
    }
    expect(countDailyStreak(results, today)).toBe(3)
  })

  it('keeps a streak alive on a day that has not been played yet', () => {
    const today = new Date('2026-03-10T12:00:00Z')
    expect(countDailyStreak({ '2026-03-09': {}, '2026-03-08': {} }, today)).toBe(2)
  })
})
