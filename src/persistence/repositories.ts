/**
 * Repositories over the IndexedDB stores.
 *
 * These are the only functions that know about persistence; the stores and
 * components talk to them, never to `idb` directly. Every read returns a
 * sensible default so a first run, a cleared database and a denied quota are
 * all the same code path.
 */
import { boardKey } from '../core/board.ts'
import type { BoardSize } from '../core/types.ts'
import {
  getDb,
  type ProfileRecord,
  type ReplayRecord,
  type SavedGame,
  type StatsRecord,
} from './db.ts'

/* ------------------------------------------------------------------ *
 * saves
 * ------------------------------------------------------------------ */

export const AUTOSAVE_ID = 'autosave'
const MAX_REPLAYS = 60

export async function putSave(save: SavedGame): Promise<void> {
  const db = await getDb()
  await db?.put('saves', save)
}

export async function getSave(id: string): Promise<SavedGame | null> {
  const db = await getDb()
  return (await db?.get('saves', id)) ?? null
}

export async function listSaves(limit = 20): Promise<SavedGame[]> {
  const db = await getDb()
  if (!db) return []
  const all = await db.getAllFromIndex('saves', 'by-updated')
  return all.reverse().slice(0, limit)
}

export async function deleteSave(id: string): Promise<void> {
  const db = await getDb()
  await db?.delete('saves', id)
}

/* ------------------------------------------------------------------ *
 * replays
 * ------------------------------------------------------------------ */

export async function putReplay(replay: ReplayRecord): Promise<void> {
  const db = await getDb()
  if (!db) return
  await db.put('replays', replay)
  // Keep the library bounded: replays are cheap but not free.
  const all = await db.getAllFromIndex('replays', 'by-created')
  if (all.length > MAX_REPLAYS) {
    const excess = all.slice(0, all.length - MAX_REPLAYS)
    await Promise.all(excess.map((r) => db.delete('replays', r.id)))
  }
}

export async function listReplays(limit = 40): Promise<ReplayRecord[]> {
  const db = await getDb()
  if (!db) return []
  const all = await db.getAllFromIndex('replays', 'by-created')
  return all.reverse().slice(0, limit)
}

export async function getReplay(id: string): Promise<ReplayRecord | null> {
  const db = await getDb()
  return (await db?.get('replays', id)) ?? null
}

/* ------------------------------------------------------------------ *
 * statistics
 * ------------------------------------------------------------------ */

export function emptyStats(): StatsRecord {
  return {
    id: 'global',
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    boxesWon: 0,
    boxesLost: 0,
    totalMoves: 0,
    totalThinkMs: 0,
    currentStreak: 0,
    longestStreak: 0,
    bySize: {},
    byTheme: {},
    byDifficulty: {},
    heatmaps: {},
    recent: [],
  }
}

export async function getStats(): Promise<StatsRecord> {
  const db = await getDb()
  return (await db?.get('stats', 'global')) ?? emptyStats()
}

export interface GameSummary {
  readonly size: BoardSize
  readonly themeId: string
  readonly mode: string
  readonly difficulty?: string
  /** 1 win, 0 draw, -1 loss — from the local player's point of view. */
  readonly result: 1 | 0 | -1
  readonly boxesWon: number
  readonly boxesLost: number
  readonly moves: number
  readonly thinkMs: number
  /** Edge ids the local player drew, for the heatmap. */
  readonly playedEdges: readonly number[]
  readonly at: number
}

export async function recordGame(summary: GameSummary): Promise<StatsRecord> {
  const db = await getDb()
  const stats = await getStats()

  stats.gamesPlayed++
  if (summary.result === 1) stats.wins++
  else if (summary.result === -1) stats.losses++
  else stats.draws++

  stats.boxesWon += summary.boxesWon
  stats.boxesLost += summary.boxesLost
  stats.totalMoves += summary.moves
  stats.totalThinkMs += summary.thinkMs

  stats.currentStreak = summary.result === 1 ? stats.currentStreak + 1 : 0
  stats.longestStreak = Math.max(stats.longestStreak, stats.currentStreak)

  const sizeKey = boardKey(summary.size)
  stats.bySize[sizeKey] = (stats.bySize[sizeKey] ?? 0) + 1
  stats.byTheme[summary.themeId] = (stats.byTheme[summary.themeId] ?? 0) + 1

  if (summary.difficulty) {
    const entry = stats.byDifficulty[summary.difficulty] ?? { played: 0, won: 0 }
    entry.played++
    if (summary.result === 1) entry.won++
    stats.byDifficulty[summary.difficulty] = entry
  }

  const edgeCount = (summary.size.rows + 1) * summary.size.cols + summary.size.rows * (summary.size.cols + 1)
  const heatmap = stats.heatmaps[sizeKey] ?? new Array<number>(edgeCount).fill(0)
  for (const edge of summary.playedEdges) {
    if (edge >= 0 && edge < heatmap.length) heatmap[edge]++
  }
  stats.heatmaps[sizeKey] = heatmap

  stats.recent.push({ at: summary.at, result: summary.result, mode: summary.mode })
  if (stats.recent.length > 120) stats.recent = stats.recent.slice(-120)

  await db?.put('stats', stats)
  return stats
}

export async function resetStats(): Promise<void> {
  const db = await getDb()
  await db?.put('stats', emptyStats())
}

/* ------------------------------------------------------------------ *
 * profile
 * ------------------------------------------------------------------ */

export function emptyProfile(): ProfileRecord {
  return {
    id: 'me',
    name: '',
    xp: 0,
    level: 1,
    unlockedThemes: [],
    achievements: {},
    quests: [],
    elo: 1000,
    createdAt: Date.now(),
    dailyResults: {},
    campaignProgress: {},
  }
}

export async function getProfile(): Promise<ProfileRecord> {
  const db = await getDb()
  return (await db?.get('profile', 'me')) ?? emptyProfile()
}

export async function putProfile(profile: ProfileRecord): Promise<void> {
  const db = await getDb()
  await db?.put('profile', profile)
}
