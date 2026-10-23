import { beforeEach, describe, expect, it, vi } from 'vitest'
import { emptyProfile, putProfile } from '../../persistence/repositories.ts'
import { countDailyStreak, isoDay, useProfile } from '../profileStore.ts'
import { previousDay } from '../../lib/calendar.ts'

vi.mock('../../persistence/db.ts', () => ({ getDb: async () => null }))
vi.mock('../../persistence/repositories.ts', async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>()
  return { ...original, putProfile: vi.fn(async () => {}) }
})

describe('daily and puzzle progression', () => {
  beforeEach(() => {
    useProfile.setState({ ...emptyProfile(), loaded: true })
    vi.clearAllMocks()
  })

  it('preserves the best daily attempt and a previous victory on retries', async () => {
    await useProfile.getState().recordDaily('2026-10-22', 12, 10, true)
    await useProfile.getState().recordDaily('2026-10-22', 4, 10, false)
    expect(useProfile.getState().dailyResults['2026-10-22']).toEqual({ score: 12, par: 10, won: true })
    expect(Object.keys(useProfile.getState().dailyResults)).toHaveLength(1)
    expect(putProfile).toHaveBeenCalled()
  })

  it('retains puzzle mastery and best score after a weaker retry', async () => {
    await useProfile.getState().recordPuzzle('woven-chain', 2, 5)
    await useProfile.getState().recordPuzzle('woven-chain', 3, 6)
    await useProfile.getState().recordPuzzle('woven-chain', 0, 1)
    expect(useProfile.getState().puzzleProgress['woven-chain']).toEqual({ stars: 3, bestScore: 6 })
  })

  it('uses local calendar fields rather than UTC when naming the day', () => {
    const date = new Date(2026, 9, 22, 0, 10)
    vi.spyOn(date, 'toISOString').mockReturnValue('2026-10-21T20:40:00.000Z')
    expect(isoDay(date)).toBe('2026-10-22')
  })

  it('walks calendar days across year and leap-day boundaries', () => {
    expect(previousDay('2026-01-01')).toBe('2025-12-31')
    expect(previousDay('2024-03-01')).toBe('2024-02-29')
    expect(countDailyStreak({ '2026-01-01': {}, '2025-12-31': {}, '2025-12-30': {} }, new Date(2026, 0, 1))).toBe(3)
  })

  it('ends the streak after a missed day and cannot double count repeated attempts', () => {
    const today = new Date(2026, 9, 22)
    expect(countDailyStreak({ '2026-10-20': {} }, today)).toBe(0)
    expect(countDailyStreak({ '2026-10-22': {}, '2026-10-20': {} }, today)).toBe(1)
  })
})
