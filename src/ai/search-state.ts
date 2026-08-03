/**
 * A mutable, allocation-free mirror of a `Position`, tuned for tree search.
 *
 * The search only cares about *which* edges are drawn (not who drew them) and
 * about the running box differential, so the state collapses to two typed
 * arrays plus an incrementally maintained per-box degree table. Make/unmake is
 * O(1) and never allocates, which is what makes deep alpha-beta viable in a
 * browser worker.
 */
import { tablesFor, type BoardTables } from '../core/board.ts'
import type { BoxId, EdgeId, Position } from '../core/types.ts'
import { createRng } from '../lib/rng.ts'

/** Zobrist keys: one 32-bit pair per edge, generated deterministically. */
function zobristFor(edgeCount: number): { lo: Int32Array; hi: Int32Array } {
  const rng = createRng(0x5eed_1234 ^ edgeCount)
  const lo = new Int32Array(edgeCount)
  const hi = new Int32Array(edgeCount)
  for (let i = 0; i < edgeCount; i++) {
    lo[i] = (rng.next() * 0xffffffff) | 0
    hi[i] = (rng.next() * 0xffffffff) | 0
  }
  return { lo, hi }
}

const zobristCache = new Map<number, { lo: Int32Array; hi: Int32Array }>()

export class SearchState {
  readonly tables: BoardTables
  /** 1 when drawn, 0 when free. */
  readonly drawn: Uint8Array
  /** Undrawn edges per box; 0 means the box is closed. */
  readonly degree: Uint8Array
  freeEdges: number
  openBoxes: number
  /** Box differential from the root player's point of view. */
  private readonly zLo: Int32Array
  private readonly zHi: Int32Array
  hashLo = 0
  hashHi = 0

  constructor(position: Position) {
    this.tables = tablesFor(position.size)
    const n = this.tables.edgeCount
    this.drawn = new Uint8Array(n)
    this.degree = new Uint8Array(this.tables.boxCount)
    let free = 0
    for (let e = 0; e < n; e++) {
      if (position.edges[e] === 0) free++
      else this.drawn[e] = 1
    }
    this.freeEdges = free
    let open = 0
    for (let b = 0; b < this.tables.boxCount; b++) {
      let d = 0
      for (let k = 0; k < 4; k++) if (this.drawn[this.tables.boxEdges[b * 4 + k]] === 0) d++
      this.degree[b] = d
      if (d > 0) open++
    }
    this.openBoxes = open

    let keys = zobristCache.get(n)
    if (!keys) {
      keys = zobristFor(n)
      zobristCache.set(n, keys)
    }
    this.zLo = keys.lo
    this.zHi = keys.hi
    for (let e = 0; e < n; e++) {
      if (this.drawn[e]) {
        this.hashLo ^= this.zLo[e]
        this.hashHi ^= this.zHi[e]
      }
    }
  }

  /** Draws `edge`, returning how many boxes it closed. */
  make(edge: EdgeId): number {
    this.drawn[edge] = 1
    this.freeEdges--
    this.hashLo ^= this.zLo[edge]
    this.hashHi ^= this.zHi[edge]
    let captured = 0
    const { edgeBoxes } = this.tables
    for (let k = 0; k < 2; k++) {
      const b = edgeBoxes[edge * 2 + k]
      if (b < 0) continue
      if (--this.degree[b] === 0) {
        captured++
        this.openBoxes--
      }
    }
    return captured
  }

  unmake(edge: EdgeId): void {
    this.drawn[edge] = 0
    this.freeEdges++
    this.hashLo ^= this.zLo[edge]
    this.hashHi ^= this.zHi[edge]
    const { edgeBoxes } = this.tables
    for (let k = 0; k < 2; k++) {
      const b = edgeBoxes[edge * 2 + k]
      if (b < 0) continue
      if (this.degree[b]++ === 0) this.openBoxes++
    }
  }

  /** Boxes with a single undrawn edge — free points for whoever is on move. */
  capturableBoxes(out: number[]): number {
    out.length = 0
    for (let b = 0; b < this.degree.length; b++) if (this.degree[b] === 1) out.push(b)
    return out.length
  }

  hasCapture(): boolean {
    for (let b = 0; b < this.degree.length; b++) if (this.degree[b] === 1) return true
    return false
  }

  /** Whether drawing `edge` would hand the opponent at least one free box. */
  isLoony(edge: EdgeId): boolean {
    const { edgeBoxes } = this.tables
    for (let k = 0; k < 2; k++) {
      const b = edgeBoxes[edge * 2 + k]
      if (b >= 0 && this.degree[b] === 2) return true
    }
    return false
  }

  capturesFor(edge: EdgeId): number {
    const { edgeBoxes } = this.tables
    let n = 0
    for (let k = 0; k < 2; k++) {
      const b = edgeBoxes[edge * 2 + k]
      if (b >= 0 && this.degree[b] === 1) n++
    }
    return n
  }

  /**
   * Move generation.
   *
   * When free boxes are on the table, a rational player either takes them or
   * plays the *double-cross*: declining the last two boxes of a chain (four of
   * a loop) to keep the opponent on move. Restricting the branching factor to
   * those two families is the standard Dots & Boxes pruning — it is what turns
   * a hopeless search into an exact one.
   *
   * Otherwise every free edge is a candidate, ordered so that safe (non-loony)
   * moves come first: they are almost always better and produce fast cutoffs.
   */
  generateMoves(out: number[], scratch: number[]): number[] {
    out.length = 0
    const { edgeBoxes, boxEdges } = this.tables

    const capturable = scratch
    this.capturableBoxes(capturable)

    if (capturable.length > 0) {
      const seen = new Set<number>()
      for (const b of capturable) {
        for (let k = 0; k < 4; k++) {
          const e = boxEdges[b * 4 + k]
          if (this.drawn[e] === 0 && !seen.has(e)) {
            seen.add(e)
            out.push(e)
          }
        }
      }
      // Declining moves: free edges within two boxes of a capturable box that
      // do not themselves capture. This covers both the chain double-cross and
      // the loop "all but four".
      const frontier = new Set<number>(capturable)
      for (let hop = 0; hop < 2; hop++) {
        for (const b of Array.from(frontier)) {
          for (let k = 0; k < 4; k++) {
            const e = boxEdges[b * 4 + k]
            if (this.drawn[e] !== 0) continue
            const n0 = edgeBoxes[e * 2 + 0]
            const n1 = edgeBoxes[e * 2 + 1]
            const other = n0 === b ? n1 : n0
            if (other >= 0 && this.degree[other] <= 2) frontier.add(other)
            if (!seen.has(e) && this.capturesFor(e) === 0) {
              seen.add(e)
              out.push(e)
            }
          }
        }
      }
      return out
    }

    const loony: number[] = []
    for (let e = 0; e < this.drawn.length; e++) {
      if (this.drawn[e] !== 0) continue
      if (this.isLoony(e)) loony.push(e)
      else out.push(e)
    }
    for (const e of loony) out.push(e)
    return out
  }

  /** Chain/loop decomposition of the degree<=2 region — see `core/analysis`. */
  decompose(): { chains: number[]; loops: number[]; hasBigRegion: boolean } {
    const { boxEdges, edgeBoxes } = this.tables
    const n = this.degree.length
    const seen = new Uint8Array(n)
    const chains: number[] = []
    const loops: number[] = []
    let hasBigRegion = false
    const stack: number[] = []

    for (let start = 0; start < n; start++) {
      const d = this.degree[start]
      if (d === 0) continue
      if (d > 2) {
        hasBigRegion = true
        continue
      }
      if (seen[start]) continue
      let count = 0
      let ground = 0
      seen[start] = 1
      stack.push(start)
      while (stack.length) {
        const b = stack.pop() as number
        count++
        for (let k = 0; k < 4; k++) {
          const e = boxEdges[b * 4 + k]
          if (this.drawn[e] !== 0) continue
          const n0 = edgeBoxes[e * 2 + 0]
          const other = n0 === b ? edgeBoxes[e * 2 + 1] : n0
          if (other < 0 || this.degree[other] > 2) {
            ground++
            continue
          }
          if (!seen[other]) {
            seen[other] = 1
            stack.push(other)
          }
        }
      }
      if (ground === 0) loops.push(count)
      else chains.push(count)
    }
    chains.sort((a, b) => a - b)
    loops.sort((a, b) => a - b)
    return { chains, loops, hasBigRegion }
  }

  /** All still-open boxes, used when converting a solved value back to a move. */
  openBoxList(): BoxId[] {
    const out: BoxId[] = []
    for (let b = 0; b < this.degree.length; b++) if (this.degree[b] > 0) out.push(b)
    return out
  }
}
