/// <reference lib="webworker" />
/**
 * The AI runs off the main thread so that a two-second Grandmaster search never
 * drops a frame of the board animation.
 */
import { chooseMove } from './engine.ts'
import type { AiRequest, AiWorkerMessage } from './types.ts'

const ctx = self as unknown as DedicatedWorkerGlobalScope

ctx.addEventListener('message', (event: MessageEvent<AiRequest>) => {
  const request = event.data
  try {
    const payload = chooseMove(request)
    const message: AiWorkerMessage = { kind: 'move', payload }
    ctx.postMessage(message)
  } catch (error) {
    const message: AiWorkerMessage = {
      kind: 'error',
      id: request?.id ?? -1,
      message: error instanceof Error ? error.message : String(error),
    }
    ctx.postMessage(message)
  }
})
