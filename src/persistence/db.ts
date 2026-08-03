/**
 * IndexedDB schema and access.
 *
 * Everything the player accumulates — saves, replays, statistics, profile —
 * lives here rather than in localStorage, because replays are large and
 * localStorage is synchronous and capped. Every call degrades gracefully: in
 * private-browsing modes or when storage is denied, the app keeps working with
 * an in-memory store and simply forgets things when the tab closes.
 */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { SerializedGame } from '../core/serialization.ts'
import type { Difficulty } from '../ai/types.ts'

export const DB_NAME = 'noqat'
export const DB_VERSION = 1

export interface SavedGame {
  readonly id: string
  readonly mode: string
  readonly updatedAt: number
  readonly createdAt: number
  readonly game: SerializedGame
  readonly players: readonly { kind: string; name: string; difficulty?: Difficulty }[]
  readonly scores: readonly number[]
  readonly finished: boolean
  readonly themeId: string
  /** Remaining clock per player, in milliseconds. */
  readonly clocks?: readonly number[]
}

export interface ReplayRecord {
  readonly id: string
  readonly createdAt: number
  readonly game: SerializedGame
  readonly players: readonly { kind: string; name: string; difficulty?: Difficulty }[]
  readonly finalScores: readonly number[]
  readonly winner: number | null
  readonly mode: string
  readonly themeId: string
  readonly durationMs: number
}

export interface StatsRecord {
  readonly id: 'global'
  gamesPlayed: number
  wins: number
  losses: number
  draws: number
  boxesWon: number
  boxesLost: number
  totalMoves: number
  totalThinkMs: number
  currentStreak: number
  longestStreak: number
  /** Board size key ("5x5") → games played. */
  bySize: Record<string, number>
  /** Theme id → games played. */
  byTheme: Record<string, number>
  /** Difficulty → { played, won }. */
  byDifficulty: Record<string, { played: number; won: number }>
  /** Board size key → per-edge play counts, for the heatmap. */
  heatmaps: Record<string, number[]>
  /** Recent results, newest last: 1 win, 0 draw, -1 loss. */
  recent: { at: number; result: number; mode: string }[]
}

export interface ProfileRecord {
  readonly id: 'me'
  name: string
  xp: number
  level: number
  /** Theme ids the player has unlocked beyond the starters. */
  unlockedThemes: string[]
  achievements: Record<string, { at: number; progress: number }>
  quests: { id: string; period: 'daily' | 'weekly'; progress: number; target: number; claimedAt?: number }[]
  elo: number
  createdAt: number
  /** Daily-challenge completions, keyed by ISO date. */
  dailyResults: Record<string, { score: number; par: number; won: boolean }>
  campaignProgress: Record<string, { stars: number; bestScore: number }>
}

interface NoqatDB extends DBSchema {
  saves: {
    key: string
    value: SavedGame
    indexes: { 'by-updated': number }
  }
  replays: {
    key: string
    value: ReplayRecord
    indexes: { 'by-created': number }
  }
  stats: { key: string; value: StatsRecord }
  profile: { key: string; value: ProfileRecord }
}

let dbPromise: Promise<IDBPDatabase<NoqatDB> | null> | null = null

export function getDb(): Promise<IDBPDatabase<NoqatDB> | null> {
  if (dbPromise) return dbPromise
  dbPromise = (async () => {
    if (typeof indexedDB === 'undefined') return null
    try {
      return await openDB<NoqatDB>(DB_NAME, DB_VERSION, {
        upgrade(db) {
          if (!db.objectStoreNames.contains('saves')) {
            const saves = db.createObjectStore('saves', { keyPath: 'id' })
            saves.createIndex('by-updated', 'updatedAt')
          }
          if (!db.objectStoreNames.contains('replays')) {
            const replays = db.createObjectStore('replays', { keyPath: 'id' })
            replays.createIndex('by-created', 'createdAt')
          }
          if (!db.objectStoreNames.contains('stats')) {
            db.createObjectStore('stats', { keyPath: 'id' })
          }
          if (!db.objectStoreNames.contains('profile')) {
            db.createObjectStore('profile', { keyPath: 'id' })
          }
        },
        blocking() {
          // Another tab wants to upgrade; let go so it can.
          void dbPromise?.then((db) => db?.close())
          dbPromise = null
        },
      })
    } catch {
      return null
    }
  })()
  return dbPromise
}

/** Wipes every store. Used by Settings → Delete all local data. */
export async function clearAllData(): Promise<void> {
  const db = await getDb()
  if (!db) return
  await Promise.all([
    db.clear('saves'),
    db.clear('replays'),
    db.clear('stats'),
    db.clear('profile'),
  ])
}

export async function estimateUsage(): Promise<{ usage: number; quota: number } | null> {
  if (!navigator.storage?.estimate) return null
  try {
    const { usage = 0, quota = 0 } = await navigator.storage.estimate()
    return { usage, quota }
  } catch {
    return null
  }
}

/** Asks the browser not to evict our data under storage pressure. */
export async function requestPersistence(): Promise<boolean> {
  if (!navigator.storage?.persist) return false
  try {
    return await navigator.storage.persist()
  } catch {
    return false
  }
}
