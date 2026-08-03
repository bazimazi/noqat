/**
 * Protocol validation tests.
 *
 * `parseClientMessage` is the server's entire trust boundary: everything past
 * it is assumed well-formed. These tests are therefore about hostile input, not
 * happy paths.
 */
import { describe, expect, it } from 'vitest'
import {
  EMOTES,
  MAX_CHAT_LENGTH,
  PROTOCOL_VERSION,
  makeRoomCode,
  parseClientMessage,
  sanitizeChat,
  sanitizeName,
} from '../protocol.ts'
import { createRng } from '../../lib/rng.ts'

describe('parseClientMessage', () => {
  it('accepts well-formed messages', () => {
    expect(parseClientMessage({ type: 'hello', version: PROTOCOL_VERSION, name: 'Ada' })).toEqual({
      type: 'hello',
      version: PROTOCOL_VERSION,
      name: 'Ada',
    })
    expect(parseClientMessage({ type: 'move', edge: 12 })).toEqual({ type: 'move', edge: 12 })
    expect(parseClientMessage({ type: 'join', code: 'ABCDE' })).toEqual({ type: 'join', code: 'ABCDE' })
    expect(parseClientMessage({ type: 'resign' })).toEqual({ type: 'resign' })
  })

  it('rejects anything that is not an object', () => {
    for (const input of [null, undefined, 42, 'move', [], true]) {
      expect(parseClientMessage(input)).toBeNull()
    }
  })

  it('rejects unknown message types', () => {
    expect(parseClientMessage({ type: 'shutdown' })).toBeNull()
    expect(parseClientMessage({ type: '__proto__' })).toBeNull()
  })

  it('rejects malformed moves', () => {
    expect(parseClientMessage({ type: 'move' })).toBeNull()
    expect(parseClientMessage({ type: 'move', edge: -1 })).toBeNull()
    expect(parseClientMessage({ type: 'move', edge: 1.5 })).toBeNull()
    expect(parseClientMessage({ type: 'move', edge: '3' })).toBeNull()
    expect(parseClientMessage({ type: 'move', edge: Number.NaN })).toBeNull()
  })

  it('rejects board sizes that would exhaust memory', () => {
    expect(parseClientMessage({ type: 'create', size: { rows: 10_000, cols: 10_000 } })).toBeNull()
    expect(parseClientMessage({ type: 'create', size: { rows: 1, cols: 5 } })).toBeNull()
    expect(parseClientMessage({ type: 'create', size: { rows: 5, cols: 5 } })).toMatchObject({
      size: { rows: 5, cols: 5 },
      ranked: false,
    })
  })

  it('rejects room codes that are not codes', () => {
    expect(parseClientMessage({ type: 'join', code: 'abc' })).toBeNull()
    expect(parseClientMessage({ type: 'join', code: 'AB' })).toBeNull()
    expect(parseClientMessage({ type: 'join', code: 'TOO-LONG-CODE' })).toBeNull()
    expect(parseClientMessage({ type: 'join', code: '../../etc' })).toBeNull()
  })

  it('truncates over-long chat rather than dropping it', () => {
    const message = parseClientMessage({ type: 'chat', text: 'x'.repeat(5000) })
    expect(message).not.toBeNull()
    expect((message as { text: string }).text).toHaveLength(MAX_CHAT_LENGTH)
  })

  it('rejects empty chat', () => {
    expect(parseClientMessage({ type: 'chat', text: '   ' })).toBeNull()
  })

  it('only accepts known emotes', () => {
    for (const emote of EMOTES) {
      expect(parseClientMessage({ type: 'emote', emote })).toEqual({ type: 'emote', emote })
    }
    expect(parseClientMessage({ type: 'emote', emote: 'rude' })).toBeNull()
  })
})

describe('sanitisation', () => {
  it('strips control characters from names', () => {
    expect(sanitizeName('Ada\u0000Lovelace')).toBe('AdaLovelace')
    expect(sanitizeName('Ada\u001bLovelace')).toBe('AdaLovelace')
    // A plain space is legitimate and must survive.
    expect(sanitizeName('Ada Lovelace')).toBe('Ada Lovelace')
  })

  it('strips bidirectional overrides that let a name impersonate another', () => {
    // U+202E reverses the rendering of everything after it, so this name
    // would display as somebody else's in the opponent's chat window.
    expect(sanitizeName('Ada\u202eecila')).toBe('Adaecila')
    expect(sanitizeName('\u2066spoof\u2069')).toBe('spoof')
    // Zero-width space: invisible, but makes two names compare unequal.
    expect(sanitizeName('safe\u200bname')).toBe('safename')
  })

  it('never returns an empty name', () => {
    expect(sanitizeName('')).toBe('Player')
    expect(sanitizeName('   ')).toBe('Player')
    expect(sanitizeName('\u0007')).toBe('Player')
  })

  it('caps name length', () => {
    expect(sanitizeName('x'.repeat(200))).toHaveLength(24)
  })

  it('keeps non-Latin names intact', () => {
    expect(sanitizeName('Ali')).toBe('Ali')
    expect(sanitizeName('Sakura')).toBe('Sakura')
  })

  it('sanitises chat the same way', () => {
    expect(sanitizeChat('hi there')).toBe('hi there')
    expect(sanitizeChat('  spaced  ')).toBe('spaced')
  })
})

describe('room codes', () => {
  it('avoids characters that are ambiguous when read aloud', () => {
    const rng = createRng(7)
    for (let i = 0; i < 200; i++) {
      const code = makeRoomCode(() => rng.next())
      expect(code).toHaveLength(5)
      expect(code).toMatch(/^[A-Z0-9]+$/)
      expect(code).not.toMatch(/[IO01]/)
    }
  })

  it('produces codes the join validator accepts', () => {
    const rng = createRng(11)
    for (let i = 0; i < 50; i++) {
      const code = makeRoomCode(() => rng.next())
      expect(parseClientMessage({ type: 'join', code })).toEqual({ type: 'join', code })
    }
  })
})
