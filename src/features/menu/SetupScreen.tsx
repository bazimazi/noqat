/**
 * New-game setup.
 *
 * Every control shows a live preview of what it changes: picking a board size
 * redraws the miniature, picking a difficulty shows the opponent's rating.
 * Choices are remembered, so the second game is one tap away.
 */
import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { BackIcon, Button, IconButton, Panel, Segmented, Slider } from '../../components/ui.tsx'
import { useI18n } from '../../i18n/index.tsx'
import { useUi } from '../../state/uiStore.ts'
import { useSettings } from '../../state/settingsStore.ts'
import { useGame, type GameContext, type GameMode, type PlayerConfig } from '../../state/gameStore.ts'
import { DIFFICULTIES, DIFFICULTY_PROFILES, type Difficulty } from '../../ai/types.ts'
import { getTheme } from '../../themes/registry.ts'
import { clampBoardSize, MAX_BOARD, MIN_BOARD } from '../../core/board.ts'
import { dailyChallenge } from '../modes/library.ts'
import type { BoardSize } from '../../core/types.ts'

const PRESETS: { label: string; size: BoardSize }[] = [
  { label: '3×3', size: { rows: 3, cols: 3 } },
  { label: '4×4', size: { rows: 4, cols: 4 } },
  { label: '5×5', size: { rows: 5, cols: 5 } },
  { label: '6×6', size: { rows: 6, cols: 6 } },
]

type Opponent = 'ai' | 'human'

export function SetupScreen() {
  const { t, n } = useI18n()
  const go = useUi((s) => s.go)
  const settings = useSettings()
  const theme = useMemo(() => getTheme(settings.themeId), [settings.themeId])

  const [size, setSize] = useState<BoardSize>(settings.lastBoardSize)
  const [custom, setCustom] = useState(
    !PRESETS.some((p) => p.size.rows === settings.lastBoardSize.rows && p.size.cols === settings.lastBoardSize.cols),
  )
  const [opponent, setOpponent] = useState<Opponent>('ai')
  const [difficulty, setDifficulty] = useState<Difficulty>(settings.lastDifficulty)
  const [mode, setMode] = useState<GameMode>('classic')
  const [playerCount, setPlayerCount] = useState(2)

  const start = (overrides?: {
    mode?: GameMode
    size?: BoardSize
    difficulty?: Difficulty
    preplaced?: readonly number[]
    seed?: number
    context?: GameContext
    opponent?: Opponent
  }) => {
    const finalSize = overrides?.size ?? size
    const finalDifficulty = overrides?.difficulty ?? difficulty
    const finalOpponent = overrides?.opponent ?? opponent
    const players: PlayerConfig[] =
      finalOpponent === 'ai'
        ? [
            { kind: 'human', name: settings.playerName || t('common.you') },
            { kind: 'ai', name: t(`difficulty.${finalDifficulty}` as 'difficulty.medium'), difficulty: finalDifficulty },
          ]
        : Array.from({ length: playerCount }, (_, i) => ({
            kind: 'human' as const,
            name: t('common.player', { n: i + 1 }),
          }))

    settings.patch({ lastBoardSize: finalSize, lastDifficulty: finalDifficulty })
    useGame.getState().start({
      size: finalSize,
      players,
      mode: overrides?.mode ?? mode,
      themeId: settings.themeId,
      ...(overrides?.seed !== undefined ? { seed: overrides.seed } : {}),
      ...(overrides?.preplaced ? { rules: { preplacedEdges: [...overrides.preplaced] } } : {}),
      ...(overrides?.context ? { context: overrides.context } : {}),
    })
    go('game')
  }

  const startDaily = () => {
    const challenge = dailyChallenge()
    setOpponent('ai')
    start({
      // Explicit, not via `setOpponent`: that state lands next render, long
      // after this call has already read it.
      opponent: 'ai',
      mode: 'daily',
      size: challenge.size,
      difficulty: challenge.difficulty,
      preplaced: challenge.preplacedEdges,
      seed: challenge.seed,
      // Carried to the result screen, which is what records the day as played.
      context: { dailyDate: challenge.isoDate, par: challenge.par },
    })
  }

  return (
    <div className="nq-scroll flex h-full flex-col gap-4 p-4 sm:p-6">
      <header className="flex items-center gap-2">
        <IconButton label={t('common.back')} onClick={() => go('menu')}>
          <BackIcon />
        </IconButton>
        <h1 className="nq-display text-xl">{t('setup.title')}</h1>
      </header>

      <div className="mx-auto grid w-full max-w-2xl gap-4">
        <Panel>
          <h2 className="mb-2 text-sm font-semibold">{t('setup.boardSize')}</h2>
          <div className="flex items-start gap-4">
            <div className="flex-1">
              <Segmented
                label={t('setup.boardSize')}
                value={custom ? 'custom' : `${size.rows}x${size.cols}`}
                onChange={(value) => {
                  if (value === 'custom') {
                    setCustom(true)
                    return
                  }
                  const preset = PRESETS.find((p) => `${p.size.rows}x${p.size.cols}` === value)
                  if (preset) {
                    setCustom(false)
                    setSize(preset.size)
                  }
                }}
                options={[
                  ...PRESETS.map((p) => ({ value: `${p.size.rows}x${p.size.cols}`, label: p.label })),
                  { value: 'custom', label: t('setup.custom') },
                ]}
              />
              {custom && (
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <Slider
                    label={t('setup.rows')}
                    valueLabel={n(size.rows)}
                    min={MIN_BOARD}
                    max={MAX_BOARD}
                    step={1}
                    value={size.rows}
                    onChange={(rows) => setSize(clampBoardSize({ ...size, rows }))}
                  />
                  <Slider
                    label={t('setup.cols')}
                    valueLabel={n(size.cols)}
                    min={MIN_BOARD}
                    max={MAX_BOARD}
                    step={1}
                    value={size.cols}
                    onChange={(cols) => setSize(clampBoardSize({ ...size, cols }))}
                  />
                </div>
              )}
            </div>
            <BoardPreview size={size} />
          </div>
        </Panel>

        <Panel>
          <h2 className="mb-2 text-sm font-semibold">{t('setup.opponent')}</h2>
          <Segmented
            label={t('setup.opponent')}
            value={opponent}
            onChange={(value) => setOpponent(value)}
            options={[
              { value: 'ai', label: t('setup.computer') },
              { value: 'human', label: t('menu.passAndPlay') },
            ]}
          />
          {opponent === 'ai' ? (
            <div className="mt-3">
              <Segmented
                label={t('setup.difficulty')}
                value={difficulty}
                onChange={(value) => setDifficulty(value)}
                options={DIFFICULTIES.map((id) => ({
                  value: id,
                  label: t(`difficulty.${id}` as 'difficulty.medium'),
                  hint: t('difficulty.rating', { n: DIFFICULTY_PROFILES[id].elo }),
                }))}
              />
              <p className="mt-2 text-xs" style={{ color: 'var(--nq-text-muted)' }}>
                {t('difficulty.rating', { n: DIFFICULTY_PROFILES[difficulty].elo })}
                {difficulty === 'beginner' && ' · ' + t('howto.tip')}
              </p>
            </div>
          ) : (
            <div className="mt-3">
              <Segmented
                label={t('setup.players')}
                value={String(playerCount)}
                onChange={(value) => setPlayerCount(Number(value))}
                options={[
                  { value: '2', label: n(2) },
                  { value: '3', label: n(3) },
                  { value: '4', label: n(4) },
                ]}
              />
            </div>
          )}
        </Panel>

        <Panel>
          <h2 className="mb-2 text-sm font-semibold">{t('setup.mode')}</h2>
          <Segmented
            label={t('setup.mode')}
            value={mode}
            onChange={(value) => setMode(value)}
            options={[
              { value: 'classic', label: t('mode.classic'), hint: t('mode.classicDesc') },
              { value: 'speed', label: t('mode.speed'), hint: t('mode.speedDesc') },
              { value: 'blitz', label: t('mode.blitz'), hint: t('mode.blitzDesc') },
            ]}
          />
          <p className="mt-2 text-xs" style={{ color: 'var(--nq-text-muted)' }}>
            {mode === 'classic' ? t('mode.classicDesc') : mode === 'speed' ? t('mode.speedDesc') : t('mode.blitzDesc')}
          </p>
        </Panel>

        <div className="grid gap-2 sm:grid-cols-2">
          <Button variant="primary" size="lg" block onClick={() => start()}>
            {t('setup.start')}
          </Button>
          <Button size="lg" block onClick={startDaily}>
            {t('menu.daily')}
          </Button>
        </div>
      </div>

      <div className="sr-only" aria-live="polite">
        {t('a11y.boardLabel', { rows: size.rows, cols: size.cols })}
      </div>

      <span className="sr-only">{theme.name}</span>
    </div>
  )
}

/** A live miniature of the chosen board — cheaper to read than "6×6". */
function BoardPreview({ size }: { size: BoardSize }) {
  const dots: { x: number; y: number }[] = []
  for (let r = 0; r <= size.rows; r++) {
    for (let c = 0; c <= size.cols; c++) dots.push({ x: c, y: r })
  }
  const radius = Math.max(0.06, 0.42 / Math.max(size.rows, size.cols))
  return (
    <motion.svg
      className="shrink-0"
      width="92"
      height="92"
      viewBox={`-0.5 -0.5 ${size.cols + 1} ${size.rows + 1}`}
      aria-hidden="true"
      initial={{ opacity: 0.6, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      key={`${size.rows}x${size.cols}`}
    >
      {dots.map((dot, index) => (
        <circle key={index} cx={dot.x} cy={dot.y} r={radius} fill="var(--nq-dot)" />
      ))}
    </motion.svg>
  )
}
