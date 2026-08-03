/**
 * Promise-based facade over the AI worker, with a synchronous fallback for
 * environments without workers (tests, ancient browsers, the online server).
 *
 * The client also enforces `minThinkMs`: a Grandmaster that answers a 3x3
 * position in 4 ms feels broken, so weaker-looking deliberation is *added*
 * rather than faked with a spinner.
 */
import type { Position, RuleSet } from '../core/types.ts'
import { chooseMove } from './engine.ts'
import { DIFFICULTY_PROFILES, type AiResponse, type AiWorkerMessage, type Difficulty } from './types.ts'

export interface ThinkOptions {
  readonly position: Position
  readonly rules: RuleSet
  readonly difficulty: Difficulty
  readonly seed: number
  readonly timeBudgetMs?: number
  /** Skips the artificial delay (used by replays, tests and hint requests). */
  readonly instant?: boolean
  readonly signal?: AbortSignal
}

export class AiClient {
  private worker: Worker | null = null
  private nextId = 1
  private readonly pending = new Map<number, { resolve: (r: AiResponse) => void; reject: (e: Error) => void }>()

  constructor(private readonly useWorker = typeof Worker !== 'undefined') {}

  private ensureWorker(): Worker | null {
    if (!this.useWorker) return null
    if (this.worker) return this.worker
    try {
      this.worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
      this.worker.addEventListener('message', (event: MessageEvent<AiWorkerMessage>) => {
        const message = event.data
        if (message.kind === 'move') {
          this.pending.get(message.payload.id)?.resolve(message.payload)
          this.pending.delete(message.payload.id)
        } else if (message.kind === 'error') {
          this.pending.get(message.id)?.reject(new Error(message.message))
          this.pending.delete(message.id)
        }
      })
      this.worker.addEventListener('error', () => {
        // Fall back to in-thread search for the rest of the session.
        this.worker?.terminate()
        this.worker = null
        for (const [, handlers] of this.pending) handlers.reject(new Error('AI worker crashed'))
        this.pending.clear()
      })
      return this.worker
    } catch {
      return null
    }
  }

  async think(options: ThinkOptions): Promise<AiResponse> {
    const id = this.nextId++
    const profile = DIFFICULTY_PROFILES[options.difficulty]
    const startedAt = performance.now()

    const request = {
      id,
      position: options.position,
      rules: options.rules,
      difficulty: options.difficulty,
      seed: options.seed,
      ...(options.timeBudgetMs !== undefined ? { timeBudgetMs: options.timeBudgetMs } : {}),
    }

    const worker = this.ensureWorker()
    let response: AiResponse
    if (worker) {
      response = await new Promise<AiResponse>((resolve, reject) => {
        this.pending.set(id, { resolve, reject })
        options.signal?.addEventListener('abort', () => {
          this.pending.delete(id)
          reject(new DOMException('Aborted', 'AbortError'))
        })
        // Typed arrays inside the position are structured-cloned automatically.
        worker.postMessage(request)
      }).catch((error: unknown) => {
        if (error instanceof DOMException) throw error
        return chooseMove(request)
      })
    } else {
      response = chooseMove(request)
    }

    if (!options.instant) {
      const elapsed = performance.now() - startedAt
      const wait = profile.minThinkMs - elapsed
      if (wait > 0) await delay(wait, options.signal)
    }
    return response
  }

  /** A single best move with no artificial delay — used by the Hint button. */
  hint(position: Position, rules: RuleSet, seed: number): Promise<AiResponse> {
    return this.think({
      position,
      rules,
      difficulty: 'expert',
      seed,
      instant: true,
      timeBudgetMs: 700,
    })
  }

  dispose(): void {
    this.worker?.terminate()
    this.worker = null
    this.pending.clear()
  }
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(new DOMException('Aborted', 'AbortError'))
    })
  })
}

let shared: AiClient | null = null

export function getAiClient(): AiClient {
  if (!shared) shared = new AiClient()
  return shared
}
