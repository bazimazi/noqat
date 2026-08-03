/**
 * Heads-up display: player cards, clocks, move history.
 *
 * The score is the thing players glance at most often, so it gets the strongest
 * type and a pulse whenever it changes; everything else stays quiet. The active
 * player's card lifts rather than flashing — a state change you can see in
 * peripheral vision without it demanding attention.
 */
import { memo, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import clsx from 'clsx'
import { useI18n } from '../../i18n/index.tsx'
import { formatClock } from '../../i18n/format.ts'
import type { PlayerConfig } from '../../state/gameStore.ts'
import type { ThemePack } from '../../themes/types.ts'
import { resolvedPlayerPalette, type AccessibilityOverrides } from '../../themes/tokens.ts'
import { DIFFICULTY_PROFILES } from '../../ai/types.ts'

export interface PlayerCardProps {
  readonly player: PlayerConfig
  readonly index: number
  readonly score: number
  readonly active: boolean
  readonly thinking: boolean
  readonly clockMs: number
  readonly theme: ThemePack
  readonly a11y: AccessibilityOverrides
  /** 0..1 — how well the AI thinks it is doing; drives the avatar mood. */
  readonly confidence?: number
  /** False in pass-and-play, where neither seat is "you" in particular. */
  readonly isLocal?: boolean
}

export const PlayerCard = memo(function PlayerCard({
  player,
  index,
  score,
  active,
  thinking,
  clockMs,
  theme,
  a11y,
  confidence,
  isLocal = true,
}: PlayerCardProps) {
  const { t, locale, n } = useI18n()
  const palette = resolvedPlayerPalette(theme, index, a11y)
  const [pulse, setPulse] = useState(0)
  const previousScore = useRef(score)

  useEffect(() => {
    if (score !== previousScore.current) {
      previousScore.current = score
      setPulse((p) => p + 1)
    }
  }, [score])

  const subtitle =
    player.kind === 'ai'
      ? `${t(`difficulty.${player.difficulty ?? 'medium'}` as 'difficulty.medium')} · ${t('difficulty.rating', {
          n: DIFFICULTY_PROFILES[player.difficulty ?? 'medium'].elo,
        })}`
      : player.kind === 'remote'
        ? t('online.rating')
        : isLocal
          ? t('common.you')
          : t('common.player', { n: index + 1 })

  return (
    <motion.div
      className={clsx('nq-panel flex items-center gap-3 px-3 py-2.5', active && 'shadow-lg')}
      animate={{
        y: active ? -3 : 0,
        borderColor: active ? palette.line : 'var(--nq-border)',
      }}
      transition={{ type: 'spring', stiffness: 320, damping: 28 }}
      aria-current={active ? 'true' : undefined}
    >
      <Avatar palette={palette} thinking={thinking} confidence={confidence} kind={player.kind} />

      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{player.name}</div>
        <div className="truncate text-xs" style={{ color: 'var(--nq-text-muted)' }}>
          {thinking ? t('game.thinking') : subtitle}
        </div>
      </div>

      {Number.isFinite(clockMs) && (
        <div
          className={clsx('nq-numeric text-sm tabular-nums')}
          style={{ color: clockMs < 15_000 ? '#ff8080' : 'var(--nq-text-muted)' }}
          aria-label={t('game.timeLeft')}
        >
          {formatClock(locale, clockMs / 1000)}
        </div>
      )}

      <motion.div
        key={pulse}
        className="nq-numeric min-w-9 text-end text-2xl font-bold"
        style={{ color: palette.line }}
        initial={pulse === 0 ? false : { scale: 1.45 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 500, damping: 18 }}
      >
        {n(score)}
      </motion.div>
    </motion.div>
  )
})

/**
 * The opponent avatar. For the AI it is a small face whose expression tracks
 * the evaluation — pleased when ahead, uneasy when behind. It is the cheapest
 * personality the game has, and players read it instantly.
 */
function Avatar({
  palette,
  thinking,
  confidence,
  kind,
}: {
  palette: ReturnType<typeof resolvedPlayerPalette>
  thinking: boolean
  confidence?: number
  kind: PlayerConfig['kind']
}) {
  const mood = confidence ?? 0.5
  const smile = (mood - 0.5) * 8
  return (
    <div
      className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full"
      style={{ background: palette.fill, border: `2px solid ${palette.line}` }}
      aria-hidden="true"
    >
      {kind === 'ai' ? (
        <svg viewBox="0 0 24 24" className="h-6 w-6">
          <circle cx="8.5" cy="10" r="1.6" fill={palette.line} />
          <circle cx="15.5" cy="10" r="1.6" fill={palette.line} />
          <path
            d={`M7.5 15.5 Q12 ${15.5 + smile} 16.5 15.5`}
            fill="none"
            stroke={palette.line}
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-6 w-6">
          <circle cx="12" cy="8.5" r="3.6" fill={palette.line} />
          <path d="M4.5 20a7.5 7.5 0 0 1 15 0Z" fill={palette.line} />
        </svg>
      )}
      <AnimatePresence>
        {thinking && (
          <motion.span
            className="absolute -bottom-1 -end-1 flex gap-0.5 rounded-full px-1 py-0.5"
            style={{ background: palette.line }}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
          >
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="block h-1 w-1 rounded-full"
                style={{ background: palette.onFill }}
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.16 }}
              />
            ))}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  )
}

export function MoveHistory({
  moves,
  playerNames,
  cursor,
  onScrub,
  theme,
  a11y,
}: {
  moves: readonly { edge: number; player: number; captured: readonly number[] }[]
  playerNames: readonly string[]
  cursor: number
  onScrub: (index: number) => void
  theme: ThemePack
  a11y: AccessibilityOverrides
}) {
  const { t, n } = useI18n()
  const listRef = useRef<HTMLOListElement>(null)

  useEffect(() => {
    const current = listRef.current?.querySelector('[data-current="true"]')
    // Guarded: not every host implements scrollIntoView (jsdom, some webviews).
    current?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
  }, [cursor])

  return (
    <nav aria-label={t('game.moveHistory')} className="flex min-h-0 flex-col">
      <h3 className="mb-1.5 text-xs font-semibold uppercase" style={{ color: 'var(--nq-text-muted)' }}>
        {t('game.moveHistory')}
      </h3>
      <ol ref={listRef} className="nq-scroll flex flex-wrap content-start gap-1 pe-1">
        {moves.map((move, index) => {
          const palette = resolvedPlayerPalette(theme, move.player, a11y)
          const current = index + 1 === cursor
          return (
            <li key={index}>
              <button
                type="button"
                data-current={current}
                onClick={() => onScrub(index + 1)}
                className="nq-focus-ring nq-numeric min-h-8 rounded px-1.5 text-xs"
                style={{
                  background: current ? palette.line : 'var(--nq-surface-alt)',
                  color: current ? palette.onFill : 'var(--nq-text-muted)',
                  borderInlineStart: `3px solid ${palette.line}`,
                }}
                aria-label={`${t('game.moves')} ${index + 1}, ${playerNames[move.player] ?? ''}`}
              >
                {n(index + 1)}
                {move.captured.length > 0 && <span aria-hidden="true"> ◆</span>}
              </button>
            </li>
          )
        })}
        {moves.length === 0 && (
          <li className="text-xs" style={{ color: 'var(--nq-text-muted)' }}>
            —
          </li>
        )}
      </ol>
    </nav>
  )
}
