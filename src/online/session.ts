/**
 * The online session.
 *
 * The transport has to outlive the lobby screen: the moment a room fills up the
 * app navigates to the board, and a transport owned by the lobby component would
 * be torn down exactly when the game needs it. It also has to outlive the board
 * for the loopback host, which holds the authoritative position in memory.
 *
 * So it lives here, at module scope, opened when the lobby connects and closed
 * only when the player actually leaves online play.
 */
import { createTransport, type Transport } from './transport.ts'

let transport: Transport | null = null
let openedFor: string | null = null

/** Returns the live session, creating and connecting one if needed. */
export function openOnlineSession(name: string): Transport {
  if (transport && openedFor === name) return transport
  closeOnlineSession()
  openedFor = name
  transport = createTransport(name)
  void transport.connect().catch(() => {})
  return transport
}

/** The live session, or null when the player is not online. */
export function currentOnlineSession(): Transport | null {
  return transport
}

export function closeOnlineSession(): void {
  transport?.close()
  transport = null
  openedFor = null
}
