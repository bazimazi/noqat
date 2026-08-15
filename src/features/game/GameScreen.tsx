/**
 * The game screen.
 *
 * Layout adapts by aspect ratio rather than by breakpoint: on anything taller
 * than it is wide, the HUD stacks above and below the board; on wide screens it
 * moves to a side rail. The board itself always takes the largest square that
 * fits, because a Dots & Boxes board that is not square is a Dots & Boxes board
 * you misjudge distances on.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Board } from '../board/Board.tsx'
import { MoveHistory, PlayerCard } from './Hud.tsx'
import { BackIcon, Button, IconButton, Modal } from '../../components/ui.tsx'
import { useI18n } from '../../i18n/index.tsx'
import { getTheme } from '../../themes/registry.ts'
import { useSettings } from '../../state/settingsStore.ts'
import { useUi } from '../../state/uiStore.ts'
import {
  selectCurrentPlayer,
  selectIsHumanTurn,
  selectIsLive,
  selectLivePosition,
  selectVisiblePosition,
  useGame,
} from '../../state/gameStore.ts'
import {
  useAiTurn,
  useAutosave,
  useCommentary,
  useGameAudio,
  useGameClock,
  useOnlineSync,
  useReplayPlayback,
} from './controllers.ts'
import { closeOnlineSession } from '../../online/session.ts'
import { getAiClient } from '../../ai/client.ts'
import { getAudioEngine } from '../../audio/engine.ts'
import { remainingEdges } from '../../core/rules.ts'

export function GameScreen() {
  const { t, n } = useI18n()
  const go = useUi((s) => s.go)
  const themeId = useSettings((s) => s.themeId)
  const a11y = useSettings((s) => s.a11y)
  const confirmMoves = useSettings((s) => s.confirmMoves)
  const showCoordinates = useSettings((s) => s.showCoordinates)
  const showChainWarnings = useSettings((s) => s.showChainWarnings)
  const showKeyboardHints = useSettings((s) => s.showKeyboardHints)
  const haptics = useSettings((s) => s.haptics)

  const theme = useMemo(() => getTheme(themeId), [themeId])
  const game = useGame()
  const visible = selectVisiblePosition(game)
  const live = selectLivePosition(game)
  const isLive = selectIsLive(game)
  const humanTurn = selectIsHumanTurn(game) && isLive
  const current = selectCurrentPlayer(game)

  const [pendingEdge, setPendingEdge] = useState<number | null>(null)
  const [showQuit, setShowQuit] = useState(false)

  useAiTurn()
  useGameClock()
  useReplayPlayback()
  useAutosave()
  useGameAudio()
  useCommentary()
  useOnlineSync()

  // Finished games hand over to the result screen once the last animation lands.
  // Only from the live position, and only once: watching the replay of a
  // finished game scrubs back into the timeline, and bouncing the viewer to the
  // result screen a second later would make the replay unwatchable.
  useEffect(() => {
    if (game.status !== 'finished' || !isLive || game.resultRecorded) return
    const timer = setTimeout(() => go('result'), a11y.reducedMotion ? 200 : 1100)
    return () => clearTimeout(timer)
  }, [game.status, game.resultRecorded, isLive, go, a11y.reducedMotion])

  const commit = useCallback(
    (edge: number) => {
      if (haptics && 'vibrate' in navigator) navigator.vibrate?.(8)
      useGame.getState().play(edge)
    },
    [haptics],
  )

  const onPlay = useCallback(
    (edge: number) => {
      if (confirmMoves) setPendingEdge(edge)
      else commit(edge)
    },
    [confirmMoves, commit],
  )

  // A finished game has no clock to pause, so the transport control drives the
  // replay instead: play walks the timeline, pause holds it where it is.
  const isReplay = game.status === 'finished' && game.moves.length > 0
  const transportPlaying = isReplay ? game.replaying : game.status === 'playing'

  // A finished game is being watched, not played: there is nothing to abandon,
  // so leaving means going back to that game's result panel.
  const onBack = useCallback(() => {
    const state = useGame.getState()
    if (state.status !== 'finished') {
      setShowQuit(true)
      return
    }
    state.goLive()
    go('result')
  }, [go])

  const toggleTransport = useCallback(() => {
    const state = useGame.getState()
    if (state.status === 'finished' && state.moves.length > 0) {
      if (state.replaying) state.setReplaying(false)
      else if (selectIsLive(state)) state.watchReplay()
      else state.setReplaying(true)
      return
    }
    if (state.status === 'paused') state.resume()
    else state.pause()
  }, [])

  const onHint = useCallback(() => {
    void getAudioEngine().unlock()
    void getAiClient()
      .hint(live, game.rules, game.seed)
      .then((response) => useGame.getState().setHint(response.edge))
      .catch(() => {})
  }, [live, game.rules, game.seed])

  // Global shortcuts. Deliberately single-key: this is a game, not an editor.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target as HTMLElement | null
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return
      switch (event.key.toLowerCase()) {
        case 'u':
          useGame.getState().undo()
          break
        case 'h':
          onHint()
          break
        case 'p':
          toggleTransport()
          break
        case 'escape':
          onBack()
          break
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onBack, onHint, toggleTransport])

  // In pass-and-play every seat is human, so no single one of them is "you".
  const localSeat = game.players.some((p) => p.kind !== 'human')
    ? game.players.findIndex((p) => p.kind === 'human')
    : -1

  // Counters follow what is on screen, so they count up again during a replay
  // rather than sitting on the final tally.
  const boxesLeft = visible.boxes.reduce((count, owner) => (owner < 0 ? count + 1 : count), 0)
  // Undo rewrites the timeline, which is not something to offer someone who is
  // in the middle of watching it.
  const canUndo = isLive && game.moves.length > 0 && game.mode !== 'online' && game.mode !== 'daily'

  return (
    <div className="flex h-full flex-col gap-2 p-3 sm:p-4">
      <a className="nq-skip-link" href="#nq-board-region">
        {t('a11y.skipToBoard')}
      </a>

      <header className="flex items-center gap-2">
        <IconButton label={t('common.back')} onClick={onBack}>
          <BackIcon />
        </IconButton>
        <div className="flex-1 text-center text-xs" style={{ color: 'var(--nq-text-muted)' }}>
          {t('game.boxesLeft', { n: boxesLeft })} · {n(remainingEdges(visible))} ⁄{' '}
          {n(visible.edges.length)}
        </div>
        <IconButton
          label={transportPlaying ? t('game.pause') : isReplay ? t('game.replayPlay') : t('common.resume')}
          onClick={toggleTransport}
        >
          {transportPlaying ? <PauseIcon /> : <PlayIcon />}
        </IconButton>
        <IconButton label={t('common.settings')} onClick={() => go('settings')}>
          <GearIcon />
        </IconButton>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-2 landscape:flex-row landscape:items-stretch">
        <div className="flex gap-2 landscape:w-64 landscape:flex-col landscape:justify-center">
          {game.players.map((player, index) => (
            <div key={index} className="flex-1">
              <PlayerCard
                player={player}
                index={index}
                score={visible.scores[index] ?? 0}
                active={index === current && game.status === 'playing'}
                thinking={game.thinking && index === current}
                clockMs={game.clocks[index] ?? Number.POSITIVE_INFINITY}
                theme={theme}
                a11y={a11y}
                isLocal={index === localSeat}
              />
            </div>
          ))}
        </div>

        <div id="nq-board-region" className="relative grid min-h-0 flex-1 place-items-center">
          <div className="aspect-square h-full max-h-full w-full max-w-full" style={{ maxWidth: 'min(100%, 88vh)' }}>
            <Board
              position={visible}
              size={game.size}
              theme={theme}
              a11y={a11y}
              onPlay={humanTurn ? onPlay : null}
              interactive={humanTurn}
              hintEdge={game.hintEdge}
              lastEdge={game.cursor > 0 ? game.moves[game.cursor - 1].edge : null}
              warnLoony={showChainWarnings && humanTurn}
              showCoordinates={showCoordinates}
              showKeyboardHints={showKeyboardHints}
              playerNames={game.players.map((p) => p.name)}
            />
          </div>

          <AnimatePresence>
            {!isLive && (
              <motion.div
                className="nq-panel absolute bottom-2 flex items-center gap-2 px-3 py-1.5 text-xs"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
              >
                <IconButton
                  size="sm"
                  label={game.replaying ? t('game.pause') : t('game.replayPlay')}
                  onClick={() => useGame.getState().setReplaying(!game.replaying)}
                >
                  {game.replaying ? <PauseIcon /> : <PlayIcon />}
                </IconButton>
                <span className="nq-numeric">
                  {n(game.cursor)} ⁄ {n(game.moves.length)}
                </span>
                <Button size="sm" variant="primary" onClick={() => useGame.getState().goLive()}>
                  {t('game.replayEnd')}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {game.status === 'paused' && (
              <motion.div
                className="absolute inset-0 grid place-items-center"
                style={{ background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(6px)' }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div className="text-center">
                  <p className="nq-display mb-3 text-2xl">{t('game.paused')}</p>
                  <Button variant="primary" onClick={() => game.resume()}>
                    {t('common.resume')}
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <aside className="flex shrink-0 flex-col gap-2 landscape:w-64">
          <div className="flex gap-2">
            <Button size="sm" onClick={() => useGame.getState().undo()} disabled={!canUndo} className="flex-1">
              {t('game.undo')}
            </Button>
            <Button size="sm" onClick={onHint} disabled={!humanTurn} className="flex-1">
              {t('game.hint')}
            </Button>
          </div>
          <div className="nq-panel min-h-0 flex-1 overflow-hidden p-3 max-landscape:max-h-24">
            <MoveHistory
              moves={game.moves}
              playerNames={game.players.map((p) => p.name)}
              cursor={game.cursor}
              onScrub={(index) => useGame.getState().scrub(index)}
              theme={theme}
              a11y={a11y}
            />
          </div>
        </aside>
      </div>

      <p id="nq-board-help" className="nq-sr-only">
        {t('a11y.keyboardHelp')}
      </p>
      <div className="nq-sr-only" role="status" aria-live="polite" aria-label={t('a11y.liveRegion')}>
        {game.announcement}
      </div>

      <Modal
        open={pendingEdge !== null}
        onClose={() => setPendingEdge(null)}
        title={t('settings.confirmMoves')}
        footer={
          <>
            <Button onClick={() => setPendingEdge(null)}>{t('common.cancel')}</Button>
            <Button
              variant="primary"
              onClick={() => {
                if (pendingEdge !== null) commit(pendingEdge)
                setPendingEdge(null)
              }}
            >
              {t('common.confirm')}
            </Button>
          </>
        }
      >
        {t('game.playerTurn', { name: game.players[current]?.name ?? '' })}
      </Modal>

      <Modal
        open={showQuit}
        onClose={() => setShowQuit(false)}
        title={t('common.quit')}
        footer={
          <>
            <Button onClick={() => setShowQuit(false)}>{t('common.cancel')}</Button>
            <Button
              variant="danger"
              onClick={() => {
                setShowQuit(false)
                if (game.mode === 'online') closeOnlineSession()
                go('menu')
              }}
            >
              {t('common.quit')}
            </Button>
          </>
        }
      >
        {t('game.autosaved')}
      </Modal>
    </div>
  )
}

/* icons — inline so there is no icon-font or sprite request */

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  )
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
      <path d="M8 5.5v13l11-6.5z" />
    </svg>
  )
}

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6" strokeLinecap="round" />
    </svg>
  )
}
