/**
 * Transports.
 *
 * The online layer talks to an interface, not to a socket. Two implementations
 * ship:
 *
 *  - `WebSocketTransport` — the real thing, against `server/index.ts`.
 *  - `LoopbackTransport` — a `BroadcastChannel` peer-to-peer transport that
 *    lets two tabs on the same machine play a genuine online game with no
 *    server at all. It is how online mode is developed, demoed and tested, and
 *    it means the feature is never "coming soon" just because nothing is
 *    deployed.
 *
 * Both queue outbound messages until connected and reconnect with backoff, so
 * the screens above never have to think about socket state.
 */
import { createPosition, applyMove, isLegalMove, isComplete } from '../core/rules.ts'
import { DEFAULT_RULES, type BoardSize, type RuleSet } from '../core/types.ts'
import {
  PROTOCOL_VERSION,
  makeRoomCode,
  sanitizeChat,
  type ClientMessage,
  type RoomSnapshot,
  type ServerMessage,
} from './protocol.ts'

export type ConnectionState = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'closed'

export interface Transport {
  readonly state: ConnectionState
  connect(): Promise<void>
  send(message: ClientMessage): void
  onMessage(handler: (message: ServerMessage) => void): () => void
  onStateChange(handler: (state: ConnectionState) => void): () => void
  close(): void
}

abstract class BaseTransport implements Transport {
  protected messageHandlers = new Set<(message: ServerMessage) => void>()
  protected stateHandlers = new Set<(state: ConnectionState) => void>()
  protected _state: ConnectionState = 'idle'

  get state(): ConnectionState {
    return this._state
  }

  protected setState(state: ConnectionState): void {
    if (this._state === state) return
    this._state = state
    for (const handler of this.stateHandlers) handler(state)
  }

  protected emit(message: ServerMessage): void {
    for (const handler of this.messageHandlers) handler(message)
  }

  onMessage(handler: (message: ServerMessage) => void): () => void {
    this.messageHandlers.add(handler)
    return () => this.messageHandlers.delete(handler)
  }

  onStateChange(handler: (state: ConnectionState) => void): () => void {
    this.stateHandlers.add(handler)
    return () => this.stateHandlers.delete(handler)
  }

  abstract connect(): Promise<void>
  abstract send(message: ClientMessage): void
  abstract close(): void
}

/* ------------------------------------------------------------------ *
 * WebSocket
 * ------------------------------------------------------------------ */

export class WebSocketTransport extends BaseTransport {
  private socket: WebSocket | null = null
  private queue: ClientMessage[] = []
  private attempts = 0
  private closedByUs = false
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null

  constructor(
    private readonly url: string,
    private readonly hello: () => ClientMessage,
  ) {
    super()
  }

  connect(): Promise<void> {
    this.closedByUs = false
    return new Promise((resolve, reject) => {
      this.setState(this.attempts === 0 ? 'connecting' : 'reconnecting')
      let socket: WebSocket
      try {
        socket = new WebSocket(this.url)
      } catch (error) {
        this.scheduleReconnect()
        reject(error)
        return
      }
      this.socket = socket

      socket.addEventListener('open', () => {
        this.attempts = 0
        this.setState('open')
        socket.send(JSON.stringify(this.hello()))
        for (const message of this.queue.splice(0)) socket.send(JSON.stringify(message))
        resolve()
      })

      socket.addEventListener('message', (event) => {
        try {
          this.emit(JSON.parse(String(event.data)) as ServerMessage)
        } catch {
          /* ignore malformed frames rather than tearing down the game */
        }
      })

      socket.addEventListener('close', () => {
        this.socket = null
        if (this.closedByUs) {
          this.setState('closed')
          return
        }
        this.scheduleReconnect()
      })

      socket.addEventListener('error', () => {
        if (this._state === 'connecting') reject(new Error('Could not reach the game server'))
      })
    })
  }

  /** Exponential backoff, capped, with jitter so reconnects do not thunder. */
  private scheduleReconnect(): void {
    this.setState('reconnecting')
    this.attempts++
    const delay = Math.min(12_000, 400 * 2 ** Math.min(5, this.attempts)) * (0.7 + Math.random() * 0.6)
    this.reconnectTimer = setTimeout(() => {
      void this.connect().catch(() => {})
    }, delay)
  }

  send(message: ClientMessage): void {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message))
    else this.queue.push(message)
  }

  close(): void {
    this.closedByUs = true
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.socket?.close()
    this.socket = null
    this.setState('closed')
  }
}

/* ------------------------------------------------------------------ *
 * Loopback (BroadcastChannel)
 * ------------------------------------------------------------------ */

interface LoopbackRoom {
  code: string
  size: BoardSize
  rules: RuleSet
  ranked: boolean
  moves: number[]
  seats: { id: string; name: string }[]
  status: RoomSnapshot['status']
  startedAt: number
}

/**
 * A serverless transport for same-device play.
 *
 * The first tab to create a room becomes the host and owns the authoritative
 * position; other tabs send intents and apply what the host broadcasts. It is
 * the same message flow as the real server, validated by the same engine, so
 * the UI cannot tell the difference.
 */
export class LoopbackTransport extends BaseTransport {
  private channel: BroadcastChannel | null = null
  private readonly id = `L${Math.random().toString(36).slice(2, 9)}`
  private room: LoopbackRoom | null = null
  private isHost = false
  private seat: 0 | 1 | null = null
  private name = 'Player'

  constructor(name: string) {
    super()
    this.name = name
  }

  connect(): Promise<void> {
    if (typeof BroadcastChannel === 'undefined') {
      this.setState('closed')
      return Promise.reject(new Error('BroadcastChannel is unavailable'))
    }
    this.channel = new BroadcastChannel('noqat-loopback')
    this.channel.addEventListener('message', (event: MessageEvent) => this.onPeer(event.data))
    this.setState('open')
    this.emit({ type: 'welcome', id: this.id, token: this.id, elo: 1000 })
    return Promise.resolve()
  }

  send(message: ClientMessage): void {
    switch (message.type) {
      case 'hello':
        this.name = message.name
        break
      case 'create': {
        this.isHost = true
        this.seat = 0
        this.room = {
          code: makeRoomCode(),
          size: message.size,
          rules: { ...DEFAULT_RULES, ...message.rules, playerCount: 2 },
          ranked: message.ranked,
          moves: [],
          seats: [{ id: this.id, name: this.name }],
          status: 'waiting',
          startedAt: Date.now(),
        }
        this.publish()
        break
      }
      case 'join':
      case 'spectate':
        this.post({ kind: 'join', code: message.code, id: this.id, name: this.name, spectator: message.type === 'spectate' })
        break
      case 'move':
        if (this.isHost) this.applyMove(this.seat ?? 0, message.edge)
        else this.post({ kind: 'intent', id: this.id, edge: message.edge })
        break
      case 'chat':
        this.post({ kind: 'chat', from: this.name, text: sanitizeChat(message.text) })
        this.emit({ type: 'chat', from: this.name, text: sanitizeChat(message.text), at: Date.now() })
        break
      case 'emote':
        this.post({ kind: 'emote', from: this.name, emote: message.emote })
        break
      case 'resign':
        this.post({ kind: 'over', winner: this.seat === 0 ? 1 : 0, reason: 'resign' })
        this.emit({ type: 'over', winner: this.seat === 0 ? 1 : 0, reason: 'resign', ratings: [1000, 1000] })
        break
      case 'leave':
        this.close()
        break
      case 'ping':
        this.emit({ type: 'pong', at: message.at })
        break
    }
  }

  private post(payload: unknown): void {
    this.channel?.postMessage(payload)
  }

  private onPeer(payload: unknown): void {
    const data = payload as Record<string, unknown>
    switch (data.kind) {
      case 'join': {
        if (!this.isHost || !this.room) return
        if (data.code !== this.room.code) return
        if (data.spectator) {
          this.publish()
          return
        }
        if (this.room.seats.length >= 2) {
          this.post({ kind: 'error', to: data.id, code: 'room-full' })
          return
        }
        this.room.seats.push({ id: String(data.id), name: String(data.name) })
        this.room.status = 'playing'
        this.publish()
        break
      }
      case 'room': {
        const room = data.room as RoomSnapshot
        if (this.room && room.code !== this.room.code && this.seat !== null) return
        const seatIndex = room.players.findIndex((p) => p.id === this.id)
        this.seat = seatIndex >= 0 ? (seatIndex as 0 | 1) : null
        this.emit({ type: 'room', room, seat: this.seat })
        break
      }
      case 'intent': {
        if (!this.isHost || !this.room) return
        const seat = this.room.seats.findIndex((s) => s.id === data.id)
        if (seat < 0) return
        this.applyMove(seat as 0 | 1, Number(data.edge))
        break
      }
      case 'move':
        this.emit({ type: 'move', edge: Number(data.edge), by: Number(data.by) as 0 | 1, at: Date.now() })
        break
      case 'chat':
        if (data.from !== this.name) {
          this.emit({ type: 'chat', from: String(data.from), text: String(data.text), at: Date.now() })
        }
        break
      case 'emote':
        this.emit({ type: 'emote', from: String(data.from), emote: data.emote as never })
        break
      case 'over':
        this.emit({
          type: 'over',
          winner: data.winner as 0 | 1 | null,
          reason: data.reason as 'resign',
          ratings: [1000, 1000],
        })
        break
      case 'error':
        if (data.to === this.id) this.emit({ type: 'error', code: data.code as 'room-full' })
        break
    }
  }

  /** Host-side authority: identical validation to the real server. */
  private applyMove(seat: 0 | 1, edge: number): void {
    const room = this.room
    if (!room || room.status !== 'playing') return
    let position = createPosition(room.size, room.rules)
    for (const played of room.moves) position = applyMove(position, played, room.rules).position
    if (position.current !== seat) {
      this.emit({ type: 'error', code: 'not-your-turn' })
      return
    }
    if (!isLegalMove(position, edge)) {
      this.emit({ type: 'error', code: 'illegal-move' })
      return
    }
    room.moves.push(edge)
    const next = applyMove(position, edge, room.rules).position
    this.post({ kind: 'move', edge, by: seat })
    this.emit({ type: 'move', edge, by: seat, at: Date.now() })
    if (isComplete(next)) {
      room.status = 'finished'
      const [a, b] = next.scores
      const winner = a === b ? null : a > b ? 0 : 1
      this.post({ kind: 'over', winner, reason: 'complete' })
      this.emit({ type: 'over', winner, reason: 'complete', ratings: [1000, 1000] })
    }
  }

  private publish(): void {
    const room = this.room
    if (!room) return
    const snapshot: RoomSnapshot = {
      code: room.code,
      size: room.size,
      rules: room.rules,
      ranked: room.ranked,
      moves: [...room.moves],
      status: room.status,
      spectators: 0,
      startedAt: room.startedAt,
      clocks: [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY],
      players: room.seats.map((seat, index) => ({
        id: seat.id,
        name: seat.name,
        elo: 1000,
        seat: index as 0 | 1,
        connected: true,
      })),
    }
    this.post({ kind: 'room', room: snapshot })
    this.emit({ type: 'room', room: snapshot, seat: this.seat })
  }

  close(): void {
    this.channel?.close()
    this.channel = null
    this.setState('closed')
  }
}

/**
 * Chooses a transport. A configured server wins; otherwise the loopback
 * transport keeps online mode usable on a single machine.
 */
export function createTransport(name: string, serverUrl?: string): Transport {
  const url = serverUrl ?? import.meta.env?.VITE_NOQAT_SERVER
  if (url) {
    return new WebSocketTransport(String(url), () => ({
      type: 'hello',
      version: PROTOCOL_VERSION,
      name,
    }))
  }
  return new LoopbackTransport(name)
}
