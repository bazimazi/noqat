/**
 * Deterministic pseudo-random numbers.
 *
 * Every source of randomness in Noqat is seeded so that AI behaviour, daily
 * challenges and particle layouts are reproducible — which makes them testable,
 * shareable and identical across devices.
 */
export interface Rng {
  /** Uniform float in [0, 1). */
  next(): number
  /** Uniform integer in [0, max). */
  int(max: number): number
  /** Uniform float in [min, max). */
  range(min: number, max: number): number
  pick<T>(items: readonly T[]): T
  /** Fisher–Yates, returning a new array. */
  shuffle<T>(items: readonly T[]): T[]
  bool(probability?: number): boolean
  /** Approximately normal, mean 0, stddev 1 (Box–Muller). */
  gaussian(): number
}

/** mulberry32 — small, fast, and good enough for games. */
export function createRng(seed: number): Rng {
  let state = seed >>> 0 || 0x9e3779b9

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  const rng: Rng = {
    next,
    int: (max) => Math.floor(next() * max),
    range: (min, max) => min + next() * (max - min),
    pick: (items) => items[Math.floor(next() * items.length)],
    shuffle: (items) => {
      const out = items.slice()
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1))
        ;[out[i], out[j]] = [out[j], out[i]]
      }
      return out
    },
    bool: (probability = 0.5) => next() < probability,
    gaussian: () => {
      const u = Math.max(next(), Number.EPSILON)
      const v = next()
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
    },
  }
  return rng
}

/** Stable 32-bit hash of a string — used to seed from dates, ids and names. */
export function hashString(input: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** A seed that is identical for everyone on a given calendar day (UTC). */
export function dailySeed(date = new Date()): number {
  const iso = `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}-${date.getUTCDate()}`
  return hashString(`noqat-daily-${iso}`)
}
