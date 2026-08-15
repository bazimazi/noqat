/**
 * Controllers — the effects that make a game *play* rather than merely exist.
 *
 * Each one is a hook with a single job, mounted by `GameScreen`:
 *   useAiTurn      drives the computer opponent
 *   useGameClock   runs timers and flags on time
 *   useReplayPlayback  walks the cursor through a finished game
 *   useAutosave    keeps the game recoverable across reloads and crashes
 *   useGameAudio   ties sound and the adaptive soundtrack to game events
 *   useCommentary  narrates the game for screen readers
 *
 * Keeping them separate means each can be reasoned about — and disabled — on
 * its own, and none of them lives in the store.
 */
import { useEffect, useRef } from 'react'
import { getAiClient } from '../../ai/client.ts'
import { DIFFICULTY_PROFILES } from '../../ai/types.ts'
import { getAudioEngine } from '../../audio/engine.ts'
import { getTheme } from '../../themes/registry.ts'
import { useI18n } from '../../i18n/index.tsx'
import { AUTOSAVE_ID, putSave } from '../../persistence/repositories.ts'
import { currentOnlineSession } from '../../online/session.ts'
import type { ServerMessage } from '../../online/protocol.ts'
import { useSettings } from '../../state/settingsStore.ts'
import {
  selectCurrentPlayer,
  selectIsLive,
  selectLivePosition,
  selectTension,
  useGame,
} from '../../state/gameStore.ts'

/* ------------------------------------------------------------------ *
 * AI
 * ------------------------------------------------------------------ */

export function useAiTurn(): void {
  const requestedPly = useRef(-1)
  const seenPly = useRef(-1)

  useEffect(() => {
    const client = getAiClient()
    let disposed = false

    const maybeMove = () => {
      const state = useGame.getState()
      if (state.status !== 'playing') return
      const position = selectLivePosition(state)
      // Undo (and a fresh game) rewinds the timeline, which would otherwise
      // leave `requestedPly` ahead of the board and freeze the opponent for
      // good once play caught back up to it.
      if (position.ply < seenPly.current) requestedPly.current = -1
      seenPly.current = position.ply
      const player = state.players[position.current]
      if (player?.kind !== 'ai') return
      // One request per ply, even if the store notifies more than once.
      if (requestedPly.current === position.ply) return
      requestedPly.current = position.ply

      const difficulty = player.difficulty ?? 'medium'
      useGame.getState().setThinking(true)
      const startedAt = performance.now()

      client
        .think({
          position,
          rules: state.rules,
          difficulty,
          seed: state.seed + position.ply * 7919,
          ...(state.rules.moveTimeLimit > 0
            ? { timeBudgetMs: Math.min(DIFFICULTY_PROFILES[difficulty].timeBudgetMs, state.rules.moveTimeLimit * 600) }
            : {}),
        })
        .then((response) => {
          if (disposed) return
          const now = useGame.getState()
          // The game may have been reset, undone or resumed while we thought.
          if (now.status !== 'playing') return
          if (selectLivePosition(now).ply !== position.ply) return
          now.setThinking(false)
          now.play(response.edge, { thinkMs: performance.now() - startedAt })
        })
        .catch(() => {
          if (disposed) return
          useGame.getState().setThinking(false)
          requestedPly.current = -1
        })
    }

    maybeMove()
    const unsubscribe = useGame.subscribe(maybeMove)
    return () => {
      disposed = true
      unsubscribe()
    }
  }, [])
}

/* ------------------------------------------------------------------ *
 * clocks
 * ------------------------------------------------------------------ */

/** Clocks are displayed in seconds, so this is as often as they need writing. */
const CLOCK_TICK_MS = 250

export function useGameClock(): void {
  useEffect(() => {
    let last = performance.now()
    let raf = 0
    let pending = 0
    const step = (now: number) => {
      const dt = now - last
      last = now
      const state = useGame.getState()
      if (state.status === 'playing') {
        const timed = state.rules.gameTimeLimit > 0
        // Batched rather than written every frame: a 60 Hz store write re-renders
        // the whole screen and re-arms the autosave debounce forever, so a timed
        // game would never actually reach disk.
        if (timed) {
          pending += dt
          if (pending >= CLOCK_TICK_MS) {
            state.tick(pending)
            pending = 0
          }
        }
        if (state.moveDeadline !== null && Date.now() > state.moveDeadline) {
          // Speed mode: running out of move time passes the turn rather than
          // losing the game — a lost tempo is punishment enough.
          const position = selectLivePosition(state)
          const free: number[] = []
          for (let e = 0; e < position.edges.length; e++) if (position.edges[e] === 0) free.push(e)
          if (free.length) state.play(free[Math.floor(Math.random() * free.length)])
        }
      }
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [])
}

/* ------------------------------------------------------------------ *
 * replay playback
 * ------------------------------------------------------------------ */

/**
 * How long a replayed move holds the screen before the next one lands. Long
 * enough for the line to finish drawing and a capture to bloom, short enough
 * that a forty-move game does not outstay its welcome.
 */
const REPLAY_STEP_MS = 620
/** Nothing is being animated, so there is no draw to wait for. */
const REPLAY_STEP_REDUCED_MS = 260

export function useReplayPlayback(): void {
  const replaying = useGame((s) => s.replaying)
  const cursor = useGame((s) => s.cursor)
  const { animationSpeed, reducedMotion } = useSettings((s) => s.a11y)

  useEffect(() => {
    if (!replaying) return
    const game = useGame.getState()
    if (cursor >= game.positions.length - 1) {
      game.setReplaying(false)
      return
    }
    const step = reducedMotion ? REPLAY_STEP_REDUCED_MS : REPLAY_STEP_MS / Math.max(0.25, animationSpeed)
    const timer = setTimeout(() => useGame.getState().advanceReplay(), step)
    return () => clearTimeout(timer)
  }, [replaying, cursor, animationSpeed, reducedMotion])
}

/* ------------------------------------------------------------------ *
 * online
 * ------------------------------------------------------------------ */

/**
 * Keeps an online game talking to the server while the board is on screen.
 *
 * The lobby hands over a live session; from here the board sends every move the
 * local seat makes and applies every move the server reports. Remote moves are
 * applied only if the edge is still free, so the server's echo of our own move
 * is a harmless no-op rather than a desync.
 */
export function useOnlineSync(): void {
  useEffect(() => {
    if (useGame.getState().mode !== 'online') return
    const transport = currentOnlineSession()
    if (!transport) return

    const seat = useGame.getState().players.findIndex((p) => p.kind === 'human')

    const offMessage = transport.onMessage((message: ServerMessage) => {
      if (message.type === 'move') {
        const game = useGame.getState()
        if (selectLivePosition(game).edges[message.edge] === 0) game.play(message.edge)
      } else if (message.type === 'over') {
        const game = useGame.getState()
        if (message.winner !== null && message.winner !== seat && message.reason === 'resign') {
          game.resign(seat)
        } else {
          game.finish()
        }
      }
    })

    let sent = useGame.getState().moves.length
    const unsubscribe = useGame.subscribe((game) => {
      if (game.moves.length < sent) {
        sent = game.moves.length
        return
      }
      for (let i = sent; i < game.moves.length; i++) {
        const move = game.moves[i]
        if (move.player === seat) transport.send({ type: 'move', edge: move.edge })
      }
      sent = game.moves.length
    })

    return () => {
      offMessage()
      unsubscribe()
    }
  }, [])
}

/* ------------------------------------------------------------------ *
 * autosave
 * ------------------------------------------------------------------ */

/** Quiet period before a save; long enough to coalesce a capture burst. */
const AUTOSAVE_DEBOUNCE_MS = 400
/** …but never wait longer than this, however busy the store is. */
const AUTOSAVE_MAX_WAIT_MS = 2500

export function useAutosave(): void {
  const themeId = useSettings((s) => s.themeId)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    let pendingSince = 0

    const save = () => {
      pendingSince = 0
      const state = useGame.getState()
      if (state.status === 'idle' || state.mode === 'online') return
      // Scrubbing and replaying move the cursor, not the game. Saving on every
      // step would write the same game to disk once per replayed move.
      if (!selectIsLive(state)) return
      const position = selectLivePosition(state)
      void putSave({
        id: AUTOSAVE_ID,
        mode: state.mode,
        createdAt: state.startedAt,
        updatedAt: Date.now(),
        game: state.serialize(),
        players: state.players.map((p) => ({
          kind: p.kind,
          name: p.name,
          ...(p.difficulty ? { difficulty: p.difficulty } : {}),
        })),
        scores: Array.from(position.scores),
        finished: state.status === 'finished',
        themeId,
        clocks: state.clocks.map((c) => (Number.isFinite(c) ? c : -1)),
      })
    }

    // Debounced, because a capture burst fires several store updates in one
    // frame — but with a ceiling on the wait. A running clock updates the store
    // continuously, and a pure debounce would be pushed back forever by it, so
    // a timed game would never actually be saved.
    const unsubscribe = useGame.subscribe(() => {
      const now = Date.now()
      if (!pendingSince) pendingSince = now
      if (timer) clearTimeout(timer)
      const wait = Math.min(AUTOSAVE_DEBOUNCE_MS, Math.max(0, pendingSince + AUTOSAVE_MAX_WAIT_MS - now))
      timer = setTimeout(save, wait)
    })
    const onHide = () => {
      if (document.visibilityState === 'hidden') save()
    }
    document.addEventListener('visibilitychange', onHide)

    return () => {
      if (timer) clearTimeout(timer)
      unsubscribe()
      document.removeEventListener('visibilitychange', onHide)
      save()
    }
  }, [themeId])
}

/* ------------------------------------------------------------------ *
 * audio
 * ------------------------------------------------------------------ */

export function useGameAudio(): void {
  const themeId = useSettings((s) => s.themeId)
  const levels = useSettings((s) => s.audio)
  const musicEnabled = useSettings((s) => s.musicEnabled)

  useEffect(() => {
    const engine = getAudioEngine()
    engine.setTheme(getTheme(themeId).audio)
  }, [themeId])

  useEffect(() => {
    getAudioEngine().setLevels(levels)
  }, [levels])

  useEffect(() => {
    const engine = getAudioEngine()
    if (musicEnabled && !levels.muted) void engine.startMusic()
    else engine.stopMusic()
  }, [musicEnabled, levels.muted])

  useEffect(() => {
    const engine = getAudioEngine()
    let lastPly = -1
    let lastCaptureNonce = 0

    return useGame.subscribe((state) => {
      const position = selectLivePosition(state)
      if (position.ply !== lastPly) {
        lastPly = position.ply
        if (state.moves.length > 0) {
          const move = state.moves[state.moves.length - 1]
          engine.play('place', { player: move.player, pan: panFor(state, move.edge) })
        }
      }
      const capture = state.lastCapture
      if (capture && capture.nonce !== lastCaptureNonce) {
        lastCaptureNonce = capture.nonce
        engine.play(capture.boxes.length > 1 ? 'doubleCapture' : 'capture', {
          player: capture.player,
          pan: panFor(state, capture.edge),
        })
      }
      engine.setIntensity(selectTension(state))
    })
  }, [])
}

/** Pans a sound to where on the board it happened. Subtle, but it locates. */
function panFor(state: ReturnType<typeof useGame.getState>, edge: number): number {
  const cols = state.size.cols
  const total = state.positions[0].edges.length
  if (!total) return 0
  const approxCol = (edge % Math.max(1, cols + 1)) / Math.max(1, cols)
  return (approxCol - 0.5) * 0.7
}

/* ------------------------------------------------------------------ *
 * screen-reader commentary
 * ------------------------------------------------------------------ */

export function useCommentary(): void {
  const { t } = useI18n()
  useEffect(() => {
    let lastPly = -1
    return useGame.subscribe((state) => {
      if (!selectIsLive(state)) return
      const position = selectLivePosition(state)
      if (position.ply === lastPly) return
      lastPly = position.ply
      const move = state.moves[state.moves.length - 1]
      if (!move) return
      const name = state.players[move.player]?.name ?? String(move.player + 1)
      const [a = 0, b = 0] = position.scores
      const message = move.captured.length
        ? t('a11y.captureAnnounce', { name, n: move.captured.length, a, b })
        : `${t('a11y.moveAnnounce', { name })}. ${t('a11y.turnAnnounce', {
            name: state.players[selectCurrentPlayer(state)]?.name ?? '',
          })}`
      state.announce(message)
    })
  }, [t])
}
