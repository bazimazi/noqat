/**
 * Online lobby and live game glue.
 *
 * The screen owns the transport, mirrors authoritative server moves into the
 * game store, and never lets the local player move for the opponent. When no
 * server is configured it falls back to the BroadcastChannel transport, so
 * "play online" works between two tabs on one machine — useful for testing and
 * genuinely fun for two people sharing a laptop.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { BackIcon, Badge, Button, IconButton, Panel } from '../../components/ui.tsx'
import { useI18n } from '../../i18n/index.tsx'
import { useUi } from '../../state/uiStore.ts'
import { useSettings } from '../../state/settingsStore.ts'
import { useGame, type PlayerConfig } from '../../state/gameStore.ts'
import type { ConnectionState, Transport } from '../../online/transport.ts'
import { closeOnlineSession, openOnlineSession } from '../../online/session.ts'
import { EMOTES, PROTOCOL_VERSION, type Emote, type RoomSnapshot, type ServerMessage } from '../../online/protocol.ts'

const EMOTE_GLYPH: Record<Emote, string> = {
  wave: '👋',
  nice: '👍',
  oops: '😅',
  think: '🤔',
  gg: '🤝',
  clap: '👏',
}

export function OnlineScreen() {
  const { t, n } = useI18n()
  const back = useUi((s) => s.back)
  const go = useUi((s) => s.go)
  const toast = useUi((s) => s.toast)
  const themeId = useSettings((s) => s.themeId)
  const playerName = useSettings((s) => s.playerName)

  const transportRef = useRef<Transport | null>(null)
  const [connection, setConnection] = useState<ConnectionState>('idle')
  const [room, setRoom] = useState<RoomSnapshot | null>(null)
  const [seat, setSeat] = useState<0 | 1 | null>(null)
  const [joinCode, setJoinCode] = useState('')
  const [chat, setChat] = useState<{ from: string; text: string; at: number }[]>([])
  const [emote, setEmote] = useState<{ from: string; emote: Emote; at: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const name = playerName || t('common.you')

  /** Starts a local game mirroring the server room. */
  const syncRoom = useCallback(
    (snapshot: RoomSnapshot, mySeat: 0 | 1 | null) => {
      if (snapshot.status === 'waiting') return
      const players: PlayerConfig[] = [0, 1].map((index) => {
        const player = snapshot.players.find((p) => p.seat === index)
        return {
          kind: index === mySeat ? 'human' : 'remote',
          name: player?.name ?? t('common.player', { n: index + 1 }),
          ...(player?.id ? { remoteId: player.id } : {}),
        }
      })
      useGame.getState().start({
        size: snapshot.size,
        players,
        mode: 'online',
        themeId,
        rules: snapshot.rules,
        id: `online_${snapshot.code}`,
        resume: {
          v: 1,
          rows: snapshot.size.rows,
          cols: snapshot.size.cols,
          rules: snapshot.rules,
          moves: [...snapshot.moves],
        },
      })
      go('game')
    },
    [themeId, go, t],
  )

  useEffect(() => {
    const transport = openOnlineSession(name)
    transportRef.current = transport
    setConnection(transport.state)

    const offState = transport.onStateChange((state) => {
      setConnection(state)
      if (state === 'closed') setError('offline')
    })
    const offMessage = transport.onMessage((message: ServerMessage) => {
      switch (message.type) {
        case 'room':
          setRoom(message.room)
          setSeat(message.seat)
          if (message.room.status === 'playing') syncRoom(message.room, message.seat)
          break
        case 'move':
          // The server is the authority; apply whatever it reports, including
          // our own moves, so local and remote state can never diverge.
          useGame.getState().play(message.edge)
          break
        case 'over':
          useGame.getState().finish()
          break
        case 'chat':
          setChat((current) => [...current.slice(-40), { from: message.from, text: message.text, at: message.at }])
          break
        case 'emote':
          setEmote({ from: message.from, emote: message.emote, at: Date.now() })
          setTimeout(() => setEmote(null), 2200)
          break
        case 'spectators':
          setRoom((current) => (current ? { ...current, spectators: message.count } : current))
          break
        case 'error':
          setError(message.code)
          toast(message.code, 'warning')
          break
      }
    })

    transport.send({ type: 'hello', version: PROTOCOL_VERSION, name })

    return () => {
      offState()
      offMessage()
      transportRef.current = null
      // The session outlives this screen when it is handing over to a game;
      // otherwise the player has left online play and the socket should go.
      const game = useGame.getState()
      if (!(game.mode === 'online' && game.status !== 'idle')) closeOnlineSession()
    }
  }, [name, syncRoom, toast])

  const send = transportRef.current?.send.bind(transportRef.current)

  return (
    <div className="nq-scroll h-full p-4 sm:p-6">
      <header className="mb-4 flex items-center gap-2">
        <IconButton label={t('common.back')} onClick={() => back()}>
          <BackIcon />
        </IconButton>
        <h1 className="nq-display flex-1 text-xl">{t('online.title')}</h1>
        <Badge tone={connection === 'open' ? 'accent' : 'neutral'}>
          {connection === 'open'
            ? t('common.on')
            : connection === 'reconnecting'
              ? t('game.reconnecting')
              : t('online.disconnected')}
        </Badge>
      </header>

      <div className="mx-auto grid max-w-lg gap-3">
        {error === 'offline' && (
          <Panel style={{ borderColor: '#e4695f' }}>
            <p className="text-sm">{t('online.offline')}</p>
          </Panel>
        )}

        {room ? (
          <Panel>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium">{t('online.roomCode')}</span>
              <code className="nq-numeric text-lg tracking-[0.3em]">{room.code}</code>
            </div>
            <Button
              size="sm"
              block
              onClick={async () => {
                await navigator.clipboard.writeText(`${location.origin}${location.pathname}?room=${room.code}`)
                toast(t('common.copied'), 'success')
              }}
            >
              {t('online.copyLink')}
            </Button>
            <ul className="mt-3 grid gap-1.5">
              {[0, 1].map((index) => {
                const player = room.players.find((p) => p.seat === index)
                return (
                  <li key={index} className="flex items-center justify-between text-sm">
                    <span>{player?.name ?? t('online.waiting')}</span>
                    <span className="text-xs" style={{ color: 'var(--nq-text-muted)' }}>
                      {player ? `${t('online.rating')} ${n(player.elo)}` : '—'}
                      {index === seat ? ` · ${t('common.you')}` : ''}
                    </span>
                  </li>
                )
              })}
            </ul>
            {room.spectators > 0 && (
              <p className="mt-2 text-xs" style={{ color: 'var(--nq-text-muted)' }}>
                {t('online.spectators', { n: room.spectators })}
              </p>
            )}
          </Panel>
        ) : (
          <>
            <Panel>
              <h2 className="mb-2 text-sm font-semibold">{t('online.createRoom')}</h2>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="primary"
                  block
                  onClick={() => send?.({ type: 'create', size: { rows: 5, cols: 5 }, ranked: false })}
                >
                  {t('mode.casual')}
                </Button>
                <Button
                  block
                  onClick={() => send?.({ type: 'create', size: { rows: 5, cols: 5 }, ranked: true })}
                >
                  {t('mode.ranked')}
                </Button>
              </div>
            </Panel>

            <Panel>
              <h2 className="mb-2 text-sm font-semibold">{t('online.joinRoom')}</h2>
              <div className="flex gap-2">
                <input
                  aria-label={t('online.roomCode')}
                  value={joinCode}
                  onChange={(event) => setJoinCode(event.target.value.toUpperCase().slice(0, 8))}
                  placeholder="ABCDE"
                  className="nq-focus-ring nq-numeric min-h-11 flex-1 px-3 tracking-[0.3em]"
                  style={{
                    background: 'var(--nq-surface-alt)',
                    color: 'var(--nq-text)',
                    border: '1px solid var(--nq-border)',
                    borderRadius: 'var(--nq-radius-sm)',
                  }}
                />
                <Button
                  variant="primary"
                  disabled={joinCode.length < 4}
                  onClick={() => send?.({ type: 'join', code: joinCode })}
                >
                  {t('common.play')}
                </Button>
                <Button
                  disabled={joinCode.length < 4}
                  onClick={() => send?.({ type: 'spectate', code: joinCode })}
                  title={t('game.spectating')}
                >
                  {t('game.spectating')}
                </Button>
              </div>
            </Panel>
          </>
        )}

        <Panel>
          <h2 className="mb-2 text-sm font-semibold">{t('online.emote')}</h2>
          <div className="flex flex-wrap gap-2">
            {EMOTES.map((id) => (
              <Button key={id} size="sm" onClick={() => send?.({ type: 'emote', emote: id })} aria-label={id}>
                <span aria-hidden="true">{EMOTE_GLYPH[id]}</span>
              </Button>
            ))}
          </div>
        </Panel>

        <Panel>
          <h2 className="mb-2 text-sm font-semibold">{t('online.chat')}</h2>
          <ul className="nq-scroll mb-2 max-h-32 text-sm">
            {chat.map((entry, index) => (
              <li key={index}>
                <span style={{ color: 'var(--nq-accent)' }}>{entry.from}: </span>
                {entry.text}
              </li>
            ))}
            {chat.length === 0 && (
              <li className="text-xs" style={{ color: 'var(--nq-text-muted)' }}>
                —
              </li>
            )}
          </ul>
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              const input = event.currentTarget.elements.namedItem('chat') as HTMLInputElement
              if (input.value.trim()) {
                send?.({ type: 'chat', text: input.value })
                input.value = ''
              }
            }}
          >
            <input
              name="chat"
              aria-label={t('online.chat')}
              maxLength={200}
              className="nq-focus-ring min-h-11 flex-1 px-3"
              style={{
                background: 'var(--nq-surface-alt)',
                color: 'var(--nq-text)',
                border: '1px solid var(--nq-border)',
                borderRadius: 'var(--nq-radius-sm)',
              }}
            />
            <Button type="submit">{t('common.next')}</Button>
          </form>
        </Panel>
      </div>

      <AnimatePresence>
        {emote && (
          <motion.div
            className="pointer-events-none fixed inset-x-0 bottom-24 grid place-items-center text-5xl"
            initial={{ opacity: 0, scale: 0.4, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.6, y: -20 }}
          >
            <span aria-label={`${emote.from}: ${emote.emote}`}>{EMOTE_GLYPH[emote.emote]}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
