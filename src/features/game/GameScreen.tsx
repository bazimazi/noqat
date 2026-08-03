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
import { Button, IconButton, Modal } from '../../components/ui.tsx'
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
import { useAiTurn, useAutosave, useCommentary, useGameAudio, useGameClock, useOnlineSync } from './controllers.ts'
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
          if (useGame.getState().status === 'playing') useGame.getState().pause()
          else useGame.getState().resume()
          break
        case 'escape':
          setShowQuit(true)
          break
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onHint])

  // In pass-and-play every seat is human, so no single one of them is "you".
  const localSeat = game.players.some((p) => p.kind !== 'human')
    ? game.players.findIndex((p) => p.kind === 'human')
    : -1

  const boxesLeft = live.boxes.reduce((count, owner) => (owner < 0 ? count + 1 : count), 0)
  const canUndo = game.moves.length > 0 && game.mode !== 'online' && game.mode !== 'daily'

  return (
    <div className="flex h-full flex-col gap-2 p-3 sm:p-4">
      <a className="nq-skip-link" href="#nq-board-region">
        {t('a11y.skipToBoard')}
      </a>

      <header className="flex items-center gap-2">
        <IconButton label={t('common.back')} onClick={() => setShowQuit(true)}>
          <BackIcon />
        </IconButton>
        <div className="flex-1 text-center text-xs" style={{ color: 'var(--nq-text-muted)' }}>
          {t('game.boxesLeft', { n: boxesLeft })} · {n(remainingEdges(live))} ⁄{' '}
          {n(live.edges.length)}
        </div>
        <IconButton
          label={game.status === 'paused' ? t('common.resume') : t('game.pause')}
          onClick={() => (game.status === 'paused' ? game.resume() : game.pause())}
        >
          {game.status === 'paused' ? <PlayIcon /> : <PauseIcon />}
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
                score={live.scores[index] ?? 0}
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
              lastEdge={game.moves.length ? game.moves[game.moves.length - 1].edge : null}
              warnLoony={showChainWarnings && humanTurn}
              showCoordinates={showCoordinates}
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
                <span>{t('game.moveHistory')}</span>
                <Button size="sm" variant="primary" onClick={() => useGame.getState().goLive()}>
                  {t('common.resume')}
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

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M15 5 8 12l7 7" strokeLinecap="round" strokeLinejoin="round" className="rtl:hidden" />
      <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" className="hidden rtl:block" />
    </svg>
  )
}

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
