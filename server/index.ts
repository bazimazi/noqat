/**
 * Noqat online server.
 *
 * A single-process authoritative WebSocket server. Run it with:
 *
 *   npm run server                      # ws://localhost:8787
 *   VITE_NOQAT_SERVER=ws://localhost:8787 npm run dev
 *
 * The important property is that it imports the *same* `src/core` engine the
 * client does. Every move is replayed through `applyMove` server-side, so the
 * server's position — not the client's — decides what happened. A modified
 * client can send whatever it likes and will simply be told no.
 *
 * State is in memory: rooms disappear on restart. That is a deliberate scope
 * choice, not an oversight — persistence, accounts and a real ladder belong in
 * a database, and the protocol is designed so adding one changes nothing here
 * except where `players` is loaded from.
 */
import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { WebSocketServer, type WebSocket } from 'ws'

import { applyMove, createPosition, isComplete, isLegalMove } from '../src/core/rules.ts'
import { DEFAULT_RULES, type BoardSize, type Position, type RuleSet } from '../src/core/types.ts'
import {
  CHAT_RATE_LIMIT,
  MOVE_RATE_LIMIT,
  PROTOCOL_VERSION,
  makeRoomCode,
  parseClientMessage,
  sanitizeChat,
  type ClientMessage,
  type RoomSnapshot,
  type ServerMessage,
} from '../src/online/protocol.ts'

const PORT = Number(process.env.PORT ?? 8787)
const MOVE_TIMEOUT_MS = 60_000
const EMPTY_ROOM_TTL_MS = 5 * 60_000
const RECONNECT_GRACE_MS = 45_000

interface Client {
  readonly socket: WebSocket
  id: string
  name: string
  elo: number
  roomCode: string | null
  seat: 0 | 1 | null
  spectating: boolean
  /** Sliding-window counters for cheap rate limiting. */
  moveTimes: number[]
  chatTimes: number[]
  alive: boolean
}

interface Seat {
  id: string
  name: string
  elo: number
  client: Client | null
  disconnectedAt: number | null
}

interface Room {
  code: string
  size: BoardSize
  rules: RuleSet
  ranked: boolean
  position: Position
  moves: number[]
  seats: (Seat | null)[]
  spectators: Set<Client>
  status: 'waiting' | 'playing' | 'finished'
  startedAt: number
  clocks: number[]
  lastMoveAt: number
  emptyAt: number | null
}

const rooms = new Map<string, Room>()
/** token → { id, name, elo } so a reconnecting player keeps their seat. */
const identities = new Map<string, { id: string; name: string; elo: number }>()

/* ------------------------------------------------------------------ *
 * helpers
 * ------------------------------------------------------------------ */

function send(client: Client, message: ServerMessage): void {
  if (client.socket.readyState === 1) client.socket.send(JSON.stringify(message))
}

function broadcast(room: Room, message: ServerMessage, except?: Client): void {
  for (const seat of room.seats) {
    if (seat?.client && seat.client !== except) send(seat.client, message)
  }
  for (const spectator of room.spectators) {
    if (spectator !== except) send(spectator, message)
  }
}

function snapshot(room: Room): RoomSnapshot {
  return {
    code: room.code,
    size: room.size,
    rules: room.rules,
    ranked: room.ranked,
    moves: [...room.moves],
    status: room.status,
    spectators: room.spectators.size,
    startedAt: room.startedAt,
    clocks: [...room.clocks],
    players: room.seats.flatMap((seat, index) =>
      seat
        ? [{ id: seat.id, name: seat.name, elo: seat.elo, seat: index as 0 | 1, connected: seat.client !== null }]
        : [],
    ),
  }
}

function pushRoom(room: Room): void {
  for (const seat of room.seats) {
    if (seat?.client) send(seat.client, { type: 'room', room: snapshot(room), seat: seat.client.seat })
  }
  for (const spectator of room.spectators) {
    send(spectator, { type: 'room', room: snapshot(room), seat: null })
  }
}

function rateLimited(times: number[], limit: number): boolean {
  const now = Date.now()
  while (times.length && now - times[0] > 1000) times.shift()
  if (times.length >= limit) return true
  times.push(now)
  return false
}

function expectedElo(a: number, b: number): number {
  return 1 / (1 + 10 ** ((b - a) / 400))
}

function updateRatings(room: Room, winner: 0 | 1 | null): number[] {
  const [first, second] = room.seats
  if (!first || !second || !room.ranked) {
    return [first?.elo ?? 1000, second?.elo ?? 1000]
  }
  const scoreA = winner === null ? 0.5 : winner === 0 ? 1 : 0
  const k = 24
  const nextA = Math.round(first.elo + k * (scoreA - expectedElo(first.elo, second.elo)))
  const nextB = Math.round(second.elo + k * (1 - scoreA - expectedElo(second.elo, first.elo)))
  first.elo = nextA
  second.elo = nextB
  const idA = identities.get(first.id)
  if (idA) idA.elo = nextA
  const idB = identities.get(second.id)
  if (idB) idB.elo = nextB
  return [nextA, nextB]
}

function finish(room: Room, winner: 0 | 1 | null, reason: 'complete' | 'resign' | 'timeout' | 'disconnect'): void {
  if (room.status === 'finished') return
  room.status = 'finished'
  const ratings = updateRatings(room, winner)
  broadcast(room, { type: 'over', winner, reason, ratings })
  pushRoom(room)
}

function leaveRoom(client: Client): void {
  const room = client.roomCode ? rooms.get(client.roomCode) : null
  client.roomCode = null
  if (!room) return

  if (client.spectating) {
    room.spectators.delete(client)
    broadcast(room, { type: 'spectators', count: room.spectators.size })
  } else if (client.seat !== null) {
    const seat = room.seats[client.seat]
    if (seat) {
      // Hold the seat open: a dropped connection is usually a tunnel, not a
      // forfeit, and the player should be able to walk back into the game.
      seat.client = null
      seat.disconnectedAt = Date.now()
      broadcast(room, { type: 'presence', seat: client.seat, connected: false })
      pushRoom(room)
    }
  }
  client.seat = null
  client.spectating = false

  const occupied = room.seats.some((seat) => seat?.client) || room.spectators.size > 0
  room.emptyAt = occupied ? null : Date.now()
}

/* ------------------------------------------------------------------ *
 * message handling
 * ------------------------------------------------------------------ */

function handle(client: Client, message: ClientMessage): void {
  switch (message.type) {
    case 'hello': {
      if (message.version !== PROTOCOL_VERSION) {
        send(client, { type: 'error', code: 'version-mismatch', detail: `server speaks v${PROTOCOL_VERSION}` })
        client.socket.close()
        return
      }
      const existing = message.token ? identities.get(message.token) : undefined
      const token = message.token && existing ? message.token : randomUUID()
      const identity = existing ?? { id: randomUUID(), name: message.name, elo: 1000 }
      identity.name = message.name
      identities.set(token, identity)
      client.id = identity.id
      client.name = identity.name
      client.elo = identity.elo
      send(client, { type: 'welcome', id: identity.id, token, elo: identity.elo })

      // Walk back into a game that is still holding a seat for this identity.
      for (const room of rooms.values()) {
        const index = room.seats.findIndex((seat) => seat?.id === identity.id)
        if (index >= 0) {
          const seat = room.seats[index]!
          seat.client = client
          seat.disconnectedAt = null
          client.roomCode = room.code
          client.seat = index as 0 | 1
          room.emptyAt = null
          broadcast(room, { type: 'presence', seat: index as 0 | 1, connected: true })
          pushRoom(room)
          break
        }
      }
      return
    }

    case 'create': {
      leaveRoom(client)
      const code = uniqueCode()
      const rules: RuleSet = {
        ...DEFAULT_RULES,
        moveTimeLimit: 45,
        gameTimeLimit: 600,
        ...message.rules,
        playerCount: 2,
      }
      const room: Room = {
        code,
        size: message.size,
        rules,
        ranked: message.ranked,
        position: createPosition(message.size, rules),
        moves: [],
        seats: [
          { id: client.id, name: client.name, elo: client.elo, client, disconnectedAt: null },
          null,
        ],
        spectators: new Set(),
        status: 'waiting',
        startedAt: Date.now(),
        clocks: [rules.gameTimeLimit * 1000, rules.gameTimeLimit * 1000],
        lastMoveAt: Date.now(),
        emptyAt: null,
      }
      rooms.set(code, room)
      client.roomCode = code
      client.seat = 0
      client.spectating = false
      pushRoom(room)
      return
    }

    case 'join': {
      const room = rooms.get(message.code)
      if (!room) {
        send(client, { type: 'error', code: 'room-not-found' })
        return
      }
      const free = room.seats.findIndex((seat) => seat === null)
      if (free < 0) {
        send(client, { type: 'error', code: 'room-full' })
        return
      }
      leaveRoom(client)
      room.seats[free] = { id: client.id, name: client.name, elo: client.elo, client, disconnectedAt: null }
      client.roomCode = room.code
      client.seat = free as 0 | 1
      client.spectating = false
      room.emptyAt = null
      if (room.seats.every((seat) => seat !== null)) {
        room.status = 'playing'
        room.lastMoveAt = Date.now()
      }
      pushRoom(room)
      return
    }

    case 'spectate': {
      const room = rooms.get(message.code)
      if (!room) {
        send(client, { type: 'error', code: 'room-not-found' })
        return
      }
      leaveRoom(client)
      room.spectators.add(client)
      client.roomCode = room.code
      client.spectating = true
      client.seat = null
      room.emptyAt = null
      send(client, { type: 'room', room: snapshot(room), seat: null })
      broadcast(room, { type: 'spectators', count: room.spectators.size })
      return
    }

    case 'move': {
      const room = client.roomCode ? rooms.get(client.roomCode) : null
      if (!room || client.seat === null || room.status !== 'playing') return
      if (rateLimited(client.moveTimes, MOVE_RATE_LIMIT)) {
        send(client, { type: 'error', code: 'rate-limited' })
        return
      }
      // Authority: the server's own position decides, not the client's claim.
      if (room.position.current !== client.seat) {
        send(client, { type: 'error', code: 'not-your-turn' })
        return
      }
      if (!isLegalMove(room.position, message.edge)) {
        send(client, { type: 'error', code: 'illegal-move' })
        return
      }

      const now = Date.now()
      if (room.rules.gameTimeLimit > 0) {
        room.clocks[client.seat] = Math.max(0, room.clocks[client.seat] - (now - room.lastMoveAt))
        if (room.clocks[client.seat] === 0) {
          finish(room, client.seat === 0 ? 1 : 0, 'timeout')
          return
        }
      }
      room.lastMoveAt = now

      const result = applyMove(room.position, message.edge, room.rules, { at: now })
      room.position = result.position
      room.moves.push(message.edge)
      broadcast(room, { type: 'move', edge: message.edge, by: client.seat, at: now })

      if (isComplete(room.position)) {
        const [a, b] = room.position.scores
        finish(room, a === b ? null : a > b ? 0 : 1, 'complete')
      }
      return
    }

    case 'resign': {
      const room = client.roomCode ? rooms.get(client.roomCode) : null
      if (!room || client.seat === null) return
      finish(room, client.seat === 0 ? 1 : 0, 'resign')
      return
    }

    case 'rematch': {
      const room = client.roomCode ? rooms.get(client.roomCode) : null
      if (!room || room.status !== 'finished') return
      room.position = createPosition(room.size, room.rules)
      room.moves = []
      room.status = room.seats.every((seat) => seat !== null) ? 'playing' : 'waiting'
      room.clocks = [room.rules.gameTimeLimit * 1000, room.rules.gameTimeLimit * 1000]
      room.startedAt = Date.now()
      room.lastMoveAt = Date.now()
      room.seats.reverse() // swap colours, as any decent club would
      for (const [index, seat] of room.seats.entries()) {
        if (seat?.client) seat.client.seat = index as 0 | 1
      }
      pushRoom(room)
      return
    }

    case 'chat': {
      const room = client.roomCode ? rooms.get(client.roomCode) : null
      if (!room) return
      if (rateLimited(client.chatTimes, CHAT_RATE_LIMIT)) {
        send(client, { type: 'error', code: 'rate-limited' })
        return
      }
      const text = sanitizeChat(message.text)
      if (!text) return
      broadcast(room, { type: 'chat', from: client.name, text, at: Date.now() })
      return
    }

    case 'emote': {
      const room = client.roomCode ? rooms.get(client.roomCode) : null
      if (!room) return
      if (rateLimited(client.chatTimes, CHAT_RATE_LIMIT)) return
      broadcast(room, { type: 'emote', from: client.name, emote: message.emote })
      return
    }

    case 'leave':
      leaveRoom(client)
      return

    case 'ping':
      send(client, { type: 'pong', at: message.at })
      return
  }
}

function uniqueCode(): string {
  for (let attempt = 0; attempt < 40; attempt++) {
    const code = makeRoomCode()
    if (!rooms.has(code)) return code
  }
  return `${makeRoomCode()}${Date.now() % 97}`
}

/* ------------------------------------------------------------------ *
 * housekeeping
 * ------------------------------------------------------------------ */

function sweep(): void {
  const now = Date.now()
  for (const [code, room] of rooms) {
    // Forfeit a seat that has been gone longer than the reconnect grace.
    if (room.status === 'playing') {
      for (const [index, seat] of room.seats.entries()) {
        if (seat && !seat.client && seat.disconnectedAt && now - seat.disconnectedAt > RECONNECT_GRACE_MS) {
          finish(room, index === 0 ? 1 : 0, 'disconnect')
        }
      }
      if (room.rules.moveTimeLimit > 0 && now - room.lastMoveAt > Math.max(MOVE_TIMEOUT_MS, room.rules.moveTimeLimit * 1000)) {
        finish(room, room.position.current === 0 ? 1 : 0, 'timeout')
      }
    }
    if (room.emptyAt && now - room.emptyAt > EMPTY_ROOM_TTL_MS) rooms.delete(code)
  }
}

/* ------------------------------------------------------------------ *
 * bootstrap
 * ------------------------------------------------------------------ */

const httpServer = createServer((request, response) => {
  if (request.url === '/health') {
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ ok: true, rooms: rooms.size, version: PROTOCOL_VERSION }))
    return
  }
  response.writeHead(404)
  response.end()
})

const wss = new WebSocketServer({ server: httpServer, maxPayload: 16 * 1024 })

wss.on('connection', (socket) => {
  const client: Client = {
    socket,
    id: randomUUID(),
    name: 'Player',
    elo: 1000,
    roomCode: null,
    seat: null,
    spectating: false,
    moveTimes: [],
    chatTimes: [],
    alive: true,
  }

  socket.on('message', (data) => {
    let parsed: unknown
    try {
      parsed = JSON.parse(String(data))
    } catch {
      send(client, { type: 'error', code: 'invalid' })
      return
    }
    const message = parseClientMessage(parsed)
    if (!message) {
      send(client, { type: 'error', code: 'invalid' })
      return
    }
    try {
      handle(client, message)
    } catch (error) {
      // One client's bad state must never take the server down.
      console.error('handler error', error)
      send(client, { type: 'error', code: 'invalid' })
    }
  })

  socket.on('pong', () => {
    client.alive = true
  })

  socket.on('close', () => leaveRoom(client))
  socket.on('error', () => leaveRoom(client))
})

// Drop sockets that stop answering, so seats do not stay held by ghosts.
const heartbeat = setInterval(() => {
  for (const socket of wss.clients) {
    const ws = socket as WebSocket & { __alive?: boolean }
    if (ws.__alive === false) {
      ws.terminate()
      continue
    }
    ws.__alive = false
    ws.ping()
    ws.once('pong', () => {
      ws.__alive = true
    })
  }
  sweep()
}, 15_000)

wss.on('close', () => clearInterval(heartbeat))

httpServer.listen(PORT, () => {
  console.log(`Noqat server listening on ws://localhost:${PORT} (protocol v${PROTOCOL_VERSION})`)
})
