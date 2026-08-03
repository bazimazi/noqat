/**
 * Progression: experience, levels, theme unlocks, achievements and quests.
 *
 * The curve is deliberately gentle — this is a relaxing puzzle game, not a
 * grind. Every theme is reachable in a couple of evenings of casual play, and
 * nothing is ever locked behind a purchase.
 */
import { create } from 'zustand'
import { STARTER_THEMES, THEME_UNLOCKS } from '../themes/registry.ts'
import type { ThemeId } from '../themes/types.ts'
import { emptyProfile, getProfile, putProfile } from '../persistence/repositories.ts'
import type { ProfileRecord } from '../persistence/db.ts'

/** XP needed to go from `level` to `level + 1`. */
export function xpForLevel(level: number): number {
  return Math.round(80 * Math.pow(level, 1.25))
}

export function levelFromXp(xp: number): { level: number; into: number; needed: number } {
  let level = 1
  let remaining = xp
  for (;;) {
    const needed = xpForLevel(level)
    if (remaining < needed || level > 99) return { level, into: remaining, needed }
    remaining -= needed
    level++
  }
}

export interface Achievement {
  readonly id: string
  readonly target: number
  /** Which counter drives it. */
  readonly metric: 'wins' | 'games' | 'perfect' | 'grandmaster' | 'themes' | 'streak' | 'daily'
  readonly xp: number
}

export const ACHIEVEMENTS: readonly Achievement[] = [
  { id: 'first-win', target: 1, metric: 'wins', xp: 40 },
  { id: 'ten-wins', target: 10, metric: 'wins', xp: 120 },
  { id: 'fifty-wins', target: 50, metric: 'wins', xp: 400 },
  { id: 'century', target: 100, metric: 'games', xp: 500 },
  { id: 'shutout', target: 1, metric: 'perfect', xp: 200 },
  { id: 'giant-slayer', target: 1, metric: 'grandmaster', xp: 600 },
  { id: 'collector', target: 6, metric: 'themes', xp: 250 },
  { id: 'streak-five', target: 5, metric: 'streak', xp: 180 },
  { id: 'daily-seven', target: 7, metric: 'daily', xp: 300 },
]

export interface ProfileState extends ProfileRecord {
  loaded: boolean
  load: () => Promise<void>
  addXp: (amount: number) => Promise<{ leveledTo: number | null; unlocked: ThemeId[] }>
  bumpAchievement: (metric: Achievement['metric'], value: number) => Promise<string[]>
  recordDaily: (isoDate: string, score: number, par: number, won: boolean) => Promise<void>
  recordCampaign: (levelId: string, stars: number, score: number) => Promise<void>
  setName: (name: string) => Promise<void>
  isThemeUnlocked: (themeId: ThemeId) => boolean
  updateElo: (opponentElo: number, result: 1 | 0.5 | 0) => Promise<number>
}

/** Themes a profile at this level has earned. */
export function unlockedThemesFor(level: number, explicit: readonly string[]): ThemeId[] {
  const ids = new Set<string>([...STARTER_THEMES, ...explicit])
  for (const [id, unlock] of Object.entries(THEME_UNLOCKS)) {
    if (level >= unlock.level) ids.add(id)
  }
  return Array.from(ids) as ThemeId[]
}

/** Standard Elo with a K-factor that softens as the player settles. */
export function nextElo(current: number, opponent: number, result: 1 | 0.5 | 0, games: number): number {
  const k = games < 20 ? 40 : games < 100 ? 24 : 16
  const expected = 1 / (1 + Math.pow(10, (opponent - current) / 400))
  return Math.round(current + k * (result - expected))
}

export const useProfile = create<ProfileState>()((set, get) => ({
  ...emptyProfile(),
  loaded: false,

  load: async () => {
    const record = await getProfile()
    set({ ...record, loaded: true })
  },

  addXp: async (amount) => {
    const state = get()
    const before = levelFromXp(state.xp).level
    const xp = state.xp + Math.max(0, Math.round(amount))
    const after = levelFromXp(xp).level

    const previouslyUnlocked = new Set(unlockedThemesFor(before, state.unlockedThemes))
    const nowUnlocked = unlockedThemesFor(after, state.unlockedThemes)
    const unlocked = nowUnlocked.filter((id) => !previouslyUnlocked.has(id))

    const next = { ...toRecord(get()), xp, level: after, unlockedThemes: nowUnlocked }
    set({ xp, level: after, unlockedThemes: nowUnlocked })
    await putProfile(next)
    return { leveledTo: after > before ? after : null, unlocked }
  },

  bumpAchievement: async (metric, value) => {
    const state = get()
    const achievements = { ...state.achievements }
    const newlyEarned: string[] = []
    for (const achievement of ACHIEVEMENTS) {
      if (achievement.metric !== metric) continue
      const existing = achievements[achievement.id]
      if (existing?.at) continue
      const progress = Math.max(existing?.progress ?? 0, value)
      const earned = progress >= achievement.target
      achievements[achievement.id] = { at: earned ? Date.now() : 0, progress }
      if (earned) newlyEarned.push(achievement.id)
    }
    set({ achievements })
    await putProfile({ ...toRecord(get()), achievements })
    if (newlyEarned.length) {
      const bonus = newlyEarned.reduce(
        (sum, id) => sum + (ACHIEVEMENTS.find((a) => a.id === id)?.xp ?? 0),
        0,
      )
      await get().addXp(bonus)
    }
    return newlyEarned
  },

  recordDaily: async (isoDate, score, par, won) => {
    const dailyResults = { ...get().dailyResults, [isoDate]: { score, par, won } }
    set({ dailyResults })
    await putProfile({ ...toRecord(get()), dailyResults })
    const streak = countDailyStreak(dailyResults)
    await get().bumpAchievement('daily', streak)
  },

  recordCampaign: async (levelId, stars, score) => {
    const existing = get().campaignProgress[levelId]
    if (existing && existing.stars >= stars && existing.bestScore >= score) return
    const campaignProgress = {
      ...get().campaignProgress,
      [levelId]: { stars: Math.max(stars, existing?.stars ?? 0), bestScore: Math.max(score, existing?.bestScore ?? 0) },
    }
    set({ campaignProgress })
    await putProfile({ ...toRecord(get()), campaignProgress })
  },

  setName: async (name) => {
    set({ name })
    await putProfile({ ...toRecord(get()), name })
  },

  isThemeUnlocked: (themeId) => {
    const state = get()
    return unlockedThemesFor(state.level, state.unlockedThemes).includes(themeId)
  },

  updateElo: async (opponentElo, result) => {
    const state = get()
    const games = Object.keys(state.dailyResults).length + state.level * 3
    const elo = nextElo(state.elo, opponentElo, result, games)
    set({ elo })
    await putProfile({ ...toRecord(get()), elo })
    return elo
  },
}))

function toRecord(state: ProfileState): ProfileRecord {
  return {
    id: 'me',
    name: state.name,
    xp: state.xp,
    level: state.level,
    unlockedThemes: state.unlockedThemes,
    achievements: state.achievements,
    quests: state.quests,
    elo: state.elo,
    createdAt: state.createdAt,
    dailyResults: state.dailyResults,
    campaignProgress: state.campaignProgress,
  }
}

/** Consecutive days (ending today or yesterday) with a completed daily. */
export function countDailyStreak(results: Record<string, unknown>, today = new Date()): number {
  let streak = 0
  const cursor = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
  // Allow the streak to still count if today has not been played yet.
  if (!results[isoDay(cursor)]) cursor.setUTCDate(cursor.getUTCDate() - 1)
  while (results[isoDay(cursor)]) {
    streak++
    cursor.setUTCDate(cursor.getUTCDate() - 1)
  }
  return streak
}

export function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/** XP for a finished game, scaled by board size and opponent strength. */
export function xpForGame(options: {
  won: boolean
  drawn: boolean
  boxes: number
  totalBoxes: number
  opponentElo: number
  perfect: boolean
}): number {
  const base = options.won ? 60 : options.drawn ? 30 : 18
  const sizeBonus = Math.round(options.totalBoxes * 0.8)
  const strengthBonus = Math.round(Math.max(0, options.opponentElo - 800) / 25)
  const perfectBonus = options.perfect ? 50 : 0
  return base + sizeBonus + (options.won ? strengthBonus : Math.round(strengthBonus / 3)) + perfectBonus
}
