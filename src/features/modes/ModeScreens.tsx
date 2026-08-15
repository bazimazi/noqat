/**
 * Puzzle, campaign and trainer screens.
 *
 * All three funnel into the same `GameScreen` by starting a normal game with
 * pre-placed edges and different win conditions — no parallel game loop, no
 * duplicated rules. Adding a new mode means adding a generator, not a screen.
 */
import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { BackIcon, Badge, Button, IconButton, Panel } from '../../components/ui.tsx'
import { useI18n } from '../../i18n/index.tsx'
import { useUi } from '../../state/uiStore.ts'
import { useSettings } from '../../state/settingsStore.ts'
import { useProfile } from '../../state/profileStore.ts'
import { useGame } from '../../state/gameStore.ts'
import { CAMPAIGN, drillSet, puzzlePage, type CampaignLevel, type Puzzle, type TrainerDrill } from './library.ts'
import { layoutFor } from '../board/geometry.ts'
import { createPosition } from '../../core/rules.ts'
import { DEFAULT_RULES } from '../../core/types.ts'

/* ------------------------------------------------------------------ *
 * puzzles
 * ------------------------------------------------------------------ */

export function PuzzlesScreen() {
  const { t, n } = useI18n()
  const back = useUi((s) => s.back)
  const go = useUi((s) => s.go)
  const themeId = useSettings((s) => s.themeId)
  const [page, setPage] = useState(1)
  const puzzles = useMemo(() => puzzlePage(page, 9), [page])

  const play = (puzzle: Puzzle) => {
    useGame.getState().start({
      size: puzzle.size,
      mode: 'puzzle',
      themeId,
      players: [
        { kind: 'human', name: t('common.you') },
        { kind: 'ai', name: t('difficulty.grandmaster'), difficulty: 'grandmaster' },
      ],
      rules: { preplacedEdges: [...puzzle.preplacedEdges] },
      context: { puzzleId: puzzle.id, par: puzzle.par },
    })
    go('game')
  }

  return (
    <div className="nq-scroll h-full p-4 sm:p-6">
      <header className="mb-4 flex items-center gap-2">
        <IconButton label={t('common.back')} onClick={() => back()}>
          <BackIcon />
        </IconButton>
        <h1 className="nq-display flex-1 text-xl">{t('menu.puzzles')}</h1>
        <Button size="sm" onClick={() => setPage((p) => p + 1)}>
          {t('common.next')}
        </Button>
      </header>

      <ul className="mx-auto grid max-w-3xl gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {puzzles.map((puzzle, index) => (
          <motion.li
            key={puzzle.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(0.25, index * 0.04) }}
          >
            <Panel className="flex flex-col gap-2">
              <PositionThumbnail
                size={puzzle.size}
                preplaced={puzzle.preplacedEdges}
              />
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {n(puzzle.size.rows)}×{n(puzzle.size.cols)}
                </span>
                <span aria-label={`difficulty ${puzzle.difficulty}`} className="text-xs">
                  {'★'.repeat(puzzle.difficulty)}
                  <span style={{ opacity: 0.3 }}>{'★'.repeat(5 - puzzle.difficulty)}</span>
                </span>
              </div>
              <p className="text-xs" style={{ color: 'var(--nq-text-muted)' }}>
                {t('game.boxesLeft', { n: puzzle.boxesLeft })} · {t('result.finalScore')} ≥ {n(puzzle.par)}
              </p>
              <Button size="sm" block variant="primary" onClick={() => play(puzzle)}>
                {t('common.play')}
              </Button>
            </Panel>
          </motion.li>
        ))}
      </ul>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * campaign
 * ------------------------------------------------------------------ */

export function CampaignScreen() {
  const { t, n } = useI18n()
  const back = useUi((s) => s.back)
  const go = useUi((s) => s.go)
  const themeId = useSettings((s) => s.themeId)
  const progress = useProfile((s) => s.campaignProgress)

  const highestCleared = CAMPAIGN.reduce(
    (best, level) => ((progress[level.id]?.stars ?? 0) > 0 ? Math.max(best, level.index) : best),
    -1,
  )

  const play = (level: CampaignLevel) => {
    useGame.getState().start({
      size: level.size,
      mode: 'campaign',
      themeId,
      players: [
        { kind: 'human', name: t('common.you') },
        { kind: 'ai', name: t(`difficulty.${level.difficulty}` as 'difficulty.medium'), difficulty: level.difficulty },
      ],
      rules: {
        ...(level.misere ? { misere: true } : {}),
        ...(level.moveTimeLimit ? { moveTimeLimit: level.moveTimeLimit } : {}),
      },
      // Without this the result screen cannot tell which level was cleared, and
      // the campaign never unlocks past the first.
      context: { campaignLevelId: level.id },
    })
    go('game')
  }

  return (
    <div className="nq-scroll h-full p-4 sm:p-6">
      <header className="mb-4 flex items-center gap-2">
        <IconButton label={t('common.back')} onClick={() => back()}>
          <BackIcon />
        </IconButton>
        <h1 className="nq-display text-xl">{t('menu.campaign')}</h1>
      </header>

      <ol className="mx-auto grid max-w-3xl gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {CAMPAIGN.map((level) => {
          // One level ahead of your best is always available, so a hard level
          // can never wall the campaign off entirely.
          const unlocked = level.index <= highestCleared + 1
          const stars = progress[level.id]?.stars ?? 0
          return (
            <li key={level.id}>
              <Panel className="flex items-center gap-3">
                <span
                  className="nq-numeric grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-bold"
                  style={{
                    background: unlocked ? 'var(--nq-accent)' : 'var(--nq-surface-alt)',
                    color: unlocked ? 'var(--nq-bg)' : 'var(--nq-text-muted)',
                  }}
                >
                  {n(level.index + 1)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-sm font-medium">
                    {n(level.size.rows)}×{n(level.size.cols)}
                    {level.misere && <Badge>misère</Badge>}
                    {level.moveTimeLimit && <Badge>{n(level.moveTimeLimit)}s</Badge>}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--nq-text-muted)' }}>
                    {t(`difficulty.${level.difficulty}` as 'difficulty.medium')} ·{' '}
                    <span aria-label={`${stars} stars`}>
                      {'★'.repeat(stars)}
                      <span style={{ opacity: 0.3 }}>{'★'.repeat(3 - stars)}</span>
                    </span>
                  </div>
                </div>
                <Button size="sm" disabled={!unlocked} onClick={() => play(level)}>
                  {unlocked ? t('common.play') : t('common.locked')}
                </Button>
              </Panel>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * trainer
 * ------------------------------------------------------------------ */

export function TrainerScreen() {
  const { t, n } = useI18n()
  const back = useUi((s) => s.back)
  const go = useUi((s) => s.go)
  const themeId = useSettings((s) => s.themeId)
  const drills = useMemo(() => drillSet(6), [])
  const [revealed, setRevealed] = useState<string | null>(null)

  const play = (drill: TrainerDrill) => {
    useGame.getState().start({
      size: drill.size,
      mode: 'trainer',
      themeId,
      players: [
        { kind: 'human', name: t('common.you') },
        { kind: 'ai', name: t('difficulty.grandmaster'), difficulty: 'grandmaster' },
      ],
      rules: { preplacedEdges: [...drill.preplacedEdges] },
    })
    go('game')
  }

  return (
    <div className="nq-scroll h-full p-4 sm:p-6">
      <header className="mb-2 flex items-center gap-2">
        <IconButton label={t('common.back')} onClick={() => back()}>
          <BackIcon />
        </IconButton>
        <h1 className="nq-display text-xl">{t('menu.trainer')}</h1>
      </header>
      <p className="mx-auto mb-4 max-w-2xl text-sm" style={{ color: 'var(--nq-text-muted)' }}>
        {t('howto.tip')}
      </p>

      <ul className="mx-auto grid max-w-3xl gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {drills.map((drill) => (
          <li key={drill.id}>
            <Panel className="flex flex-col gap-2">
              <PositionThumbnail
                size={drill.size}
                preplaced={drill.preplacedEdges}
                highlight={revealed === drill.id ? drill.bestEdge : null}
              />
              <p className="text-xs" style={{ color: 'var(--nq-text-muted)' }}>
                {t('game.chainWarning')} — {t('result.finalScore')} {n(drill.bestValue)} vs {n(drill.greedyValue)}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button size="sm" onClick={() => setRevealed(revealed === drill.id ? null : drill.id)}>
                  {t('game.hint')}
                </Button>
                <Button size="sm" variant="primary" onClick={() => play(drill)}>
                  {t('common.play')}
                </Button>
              </div>
            </Panel>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * shared thumbnail
 * ------------------------------------------------------------------ */

function PositionThumbnail({
  size,
  preplaced,
  highlight = null,
}: {
  size: { rows: number; cols: number }
  preplaced: readonly number[]
  highlight?: number | null
}) {
  const layout = layoutFor(size)
  const position = useMemo(
    () => createPosition(size, { ...DEFAULT_RULES, preplacedEdges: [...preplaced] }),
    [size, preplaced],
  )

  return (
    <svg viewBox={layout.viewBox} className="mx-auto h-24 w-full" aria-hidden="true">
      {layout.edges.map((edge) => {
        const drawn = position.edges[edge.id] !== 0
        const isHighlight = edge.id === highlight
        return (
          <line
            key={edge.id}
            x1={edge.x1}
            y1={edge.y1}
            x2={edge.x2}
            y2={edge.y2}
            stroke={isHighlight ? 'var(--nq-accent)' : drawn ? 'var(--nq-text-muted)' : 'var(--nq-line-idle)'}
            strokeWidth={isHighlight ? 0.14 : drawn ? 0.08 : 0.04}
            strokeDasharray={drawn || isHighlight ? undefined : '0.06 0.08'}
            strokeLinecap="round"
          />
        )
      })}
      {layout.dots.map((dot, index) => (
        <circle key={index} cx={dot.x} cy={dot.y} r={0.06} fill="var(--nq-dot)" />
      ))}
    </svg>
  )
}
