/**
 * The wire protocol.
 *
 * Shared verbatim by the browser and the Node server, which is the point: the
 * server imports the same `core` engine and validates every move against it, so
 * a tampered client cannot play an illegal edge, move out of turn, or claim a
 * box it did not close. The client is a renderer, never an authority.
 */
import type { BoardSize, RuleSet } from '../core/types.ts'

export const PROTOCOL_VERSION = 1

export type Emote = 'wave' | 'nice' | 'oops' | 'think' | 'gg' | 'clap'

export const EMOTES: readonly Emote[] = ['wave', 'nice', 'oops', 'think', 'gg', 'clap']

export interface RoomPlayer {
  readonly id: string
  readonly name: string
  readonly elo: number
  readonly seat: 0 | 1
  readonly connected: boolean
}

export interface RoomSnapshot {
  readonly code: string
  readonly size: BoardSize
  readonly rules: RuleSet
  readonly players: readonly RoomPlayer[]
  readonly spectators: number
  /** Edge ids in play order. */
  readonly moves: readonly number[]
  readonly status: 'waiting' | 'playing' | 'finished'
  readonly ranked: boolean
  /** Remaining milliseconds per seat. */
  readonly clocks: readonly number[]
  readonly startedAt: number
}

/* ---- client to server ---------------------------------------------- */

export type ClientMessage =
  | { readonly type: 'hello'; readonly version: number; readonly name: string; readonly token?: string }
  | {
      readonly type: 'create'
      readonly size: BoardSize
      readonly ranked: boolean
      readonly rules?: Partial<RuleSet>
    }
  | { readonly type: 'join'; readonly code: string }
  | { readonly type: 'spectate'; readonly code: string }
  | { readonly type: 'move'; readonly edge: number }
  | { readonly type: 'resign' }
  | { readonly type: 'rematch' }
  | { readonly type: 'chat'; readonly text: string }
  | { readonly type: 'emote'; readonly emote: Emote }
  | { readonly type: 'leave' }
  | { readonly type: 'ping'; readonly at: number }

/* ---- server to client ---------------------------------------------- */

export type ServerMessage =
  | { readonly type: 'welcome'; readonly id: string; readonly token: string; readonly elo: number }
  | { readonly type: 'room'; readonly room: RoomSnapshot; readonly seat: 0 | 1 | null }
  | { readonly type: 'move'; readonly edge: number; readonly by: 0 | 1; readonly at: number }
  | {
      readonly type: 'over'
      readonly winner: 0 | 1 | null
      readonly reason: 'complete' | 'resign' | 'timeout' | 'disconnect'
      readonly ratings: readonly number[]
    }
  | { readonly type: 'chat'; readonly from: string; readonly text: string; readonly at: number }
  | { readonly type: 'emote'; readonly from: string; readonly emote: Emote }
  | { readonly type: 'presence'; readonly seat: 0 | 1; readonly connected: boolean }
  | { readonly type: 'spectators'; readonly count: number }
  | { readonly type: 'pong'; readonly at: number }
  | { readonly type: 'error'; readonly code: ErrorCode; readonly detail?: string }

export type ErrorCode =
  | 'version-mismatch'
  | 'room-not-found'
  | 'room-full'
  | 'not-your-turn'
  | 'illegal-move'
  | 'rate-limited'
  | 'invalid'

/* ---- validation ---------------------------------------------------- */

export const MAX_CHAT_LENGTH = 200
/** Moves per second a client may send before being throttled. */
export const MOVE_RATE_LIMIT = 8
export const CHAT_RATE_LIMIT = 2

/**
 * Narrows untrusted JSON to a `ClientMessage`. The server runs this before
 * touching anything — never trust a payload because it parsed.
 */
export function parseClientMessage(raw: unknown): ClientMessage | null {
  if (typeof raw !== 'object' || raw === null) return null
  const message = raw as Record<string, unknown>
  switch (message.type) {
    case 'hello':
      return typeof message.version === 'number' && typeof message.name === 'string'
        ? {
            type: 'hello',
            version: message.version,
            name: sanitizeName(message.name),
            ...(typeof message.token === 'string' ? { token: message.token } : {}),
          }
        : null
    case 'create': {
      const size = message.size as BoardSize | undefined
      if (!size || !Number.isInteger(size.rows) || !Number.isInteger(size.cols)) return null
      if (size.rows < 2 || size.cols < 2 || size.rows > 12 || size.cols > 12) return null
      return {
        type: 'create',
        size: { rows: size.rows, cols: size.cols },
        ranked: message.ranked === true,
        ...(typeof message.rules === 'object' && message.rules !== null
          ? { rules: message.rules as Partial<RuleSet> }
          : {}),
      }
    }
    case 'join':
    case 'spectate':
      return typeof message.code === 'string' && /^[A-Z0-9]{4,8}$/.test(message.code)
        ? { type: message.type, code: message.code }
        : null
    case 'move':
      return Number.isInteger(message.edge) && (message.edge as number) >= 0
        ? { type: 'move', edge: message.edge as number }
        : null
    case 'resign':
    case 'rematch':
    case 'leave':
      return { type: message.type }
    case 'chat':
      return typeof message.text === 'string' && message.text.trim().length > 0
        ? { type: 'chat', text: message.text.slice(0, MAX_CHAT_LENGTH) }
        : null
    case 'emote':
      return EMOTES.includes(message.emote as Emote)
        ? { type: 'emote', emote: message.emote as Emote }
        : null
    case 'ping':
      return { type: 'ping', at: typeof message.at === 'number' ? message.at : 0 }
    default:
      return null
  }
}

/**
 * Strips control characters and bidirectional overrides from a display name.
 * The bidi ones matter: U+202E and friends can make a name render as somebody
 * else's in the opponent's chat window.
 */
const UNSAFE_NAME_CHARS = new RegExp(
  // Matching control characters is exactly the point of this pattern.
  // eslint-disable-next-line no-control-regex
  '[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069]',
  'g',
)

export function sanitizeName(name: string): string {
  const cleaned = name.replace(UNSAFE_NAME_CHARS, '').trim().slice(0, 24)
  return cleaned.length > 0 ? cleaned : 'Player'
}

export function sanitizeChat(text: string): string {
  return text.replace(UNSAFE_NAME_CHARS, '').trim().slice(0, MAX_CHAT_LENGTH)
}

/** Room codes avoid characters that are ambiguous when read aloud. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function makeRoomCode(random: () => number = Math.random): string {
  let code = ''
  for (let i = 0; i < 5; i++) code += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)]
  return code
}
