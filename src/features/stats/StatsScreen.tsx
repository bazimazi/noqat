/**
 * Statistics.
 *
 * Two charts, both drawn as plain SVG from real data: a heatmap of where the
 * player draws lines on the board, and a running win-rate. No chart library —
 * these are twenty lines each and stay perfectly on-theme.
 */
import { useEffect, useMemo, useState } from 'react'
import { BackIcon, IconButton, Panel, Stat } from '../../components/ui.tsx'
import { useI18n } from '../../i18n/index.tsx'
import { formatDuration, formatPercent } from '../../i18n/format.ts'
import { useUi } from '../../state/uiStore.ts'
import { getStats } from '../../persistence/repositories.ts'
import type { StatsRecord } from '../../persistence/db.ts'
import { getTheme } from '../../themes/registry.ts'
import { layoutFor } from '../board/geometry.ts'
import { DIFFICULTIES } from '../../ai/types.ts'

export function StatsScreen() {
  const { t, n, locale } = useI18n()
  const back = useUi((s) => s.back)
  const [stats, setStats] = useState<StatsRecord | null>(null)

  useEffect(() => {
    void getStats().then(setStats)
  }, [])

  const favouriteSize = useMemo(() => topKey(stats?.bySize), [stats])
  const favouriteTheme = useMemo(() => topKey(stats?.byTheme), [stats])

  if (!stats) {
    return (
      <div className="grid h-full place-items-center">
        <p style={{ color: 'var(--nq-text-muted)' }}>{t('common.loading')}</p>
      </div>
    )
  }

  const played = stats.gamesPlayed
  const winRate = played > 0 ? stats.wins / played : 0
  const avgMove = stats.totalMoves > 0 ? stats.totalThinkMs / stats.totalMoves : 0

  return (
    <div className="nq-scroll h-full p-4 sm:p-6">
      <header className="mb-4 flex items-center gap-2">
        <IconButton label={t('common.back')} onClick={() => back()}>
          <BackIcon />
        </IconButton>
        <h1 className="nq-display text-xl">{t('stats.title')}</h1>
      </header>

      {played === 0 ? (
        <p className="mx-auto max-w-md text-center text-sm" style={{ color: 'var(--nq-text-muted)' }}>
          {t('stats.noData')}
        </p>
      ) : (
        <div className="mx-auto grid max-w-3xl gap-4 pb-10">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label={t('stats.gamesPlayed')} value={n(played)} />
            <Stat label={t('stats.winRate')} value={formatPercent(locale, winRate)} sub={`${n(stats.wins)}–${n(stats.losses)}–${n(stats.draws)}`} />
            <Stat label={t('stats.streak')} value={n(stats.longestStreak)} />
            <Stat label={t('stats.avgMoveTime')} value={avgMove ? formatDuration(locale, avgMove) : '—'} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Panel>
              <h2 className="mb-2 text-sm font-semibold">{t('stats.performance')}</h2>
              <WinRateChart recent={stats.recent} />
            </Panel>

            <Panel>
              <h2 className="mb-2 text-sm font-semibold">{t('stats.heatmap')}</h2>
              <Heatmap heatmaps={stats.heatmaps} />
            </Panel>
          </div>

          <Panel>
            <h2 className="mb-2 text-sm font-semibold">{t('stats.byDifficulty')}</h2>
            <ul className="grid gap-1.5">
              {DIFFICULTIES.map((difficulty) => {
                const entry = stats.byDifficulty[difficulty]
                const rate = entry && entry.played > 0 ? entry.won / entry.played : 0
                return (
                  <li key={difficulty} className="flex items-center gap-3 text-sm">
                    <span className="w-28 shrink-0">{t(`difficulty.${difficulty}` as 'difficulty.medium')}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full" style={{ background: 'var(--nq-surface-alt)' }}>
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${rate * 100}%`, background: 'var(--nq-accent)' }}
                      />
                    </div>
                    <span className="nq-numeric w-20 text-end text-xs" style={{ color: 'var(--nq-text-muted)' }}>
                      {entry ? `${n(entry.won)}/${n(entry.played)}` : '—'}
                    </span>
                  </li>
                )
              })}
            </ul>
          </Panel>

          <div className="grid grid-cols-2 gap-2">
            <Stat label={t('stats.favoriteSize')} value={favouriteSize ?? '—'} />
            <Stat
              label={t('stats.favoriteTheme')}
              value={favouriteTheme ? getTheme(favouriteTheme).name : '—'}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function topKey(record: Record<string, number> | undefined): string | null {
  if (!record) return null
  let best: string | null = null
  let bestValue = -1
  for (const [key, value] of Object.entries(record)) {
    if (value > bestValue) {
      bestValue = value
      best = key
    }
  }
  return best
}

/** Cumulative win rate over the recorded games. */
function WinRateChart({ recent }: { recent: StatsRecord['recent'] }) {
  const { t } = useI18n()
  if (recent.length < 2) {
    return (
      <p className="text-xs" style={{ color: 'var(--nq-text-muted)' }}>
        {t('stats.noData')}
      </p>
    )
  }

  const points: string[] = []
  let wins = 0
  recent.forEach((entry, index) => {
    if (entry.result === 1) wins++
    const x = (index / (recent.length - 1)) * 100
    const y = 40 - (wins / (index + 1)) * 38
    points.push(`${x.toFixed(2)},${y.toFixed(2)}`)
  })

  return (
    <svg viewBox="0 0 100 44" className="h-24 w-full" role="img" aria-label={t('stats.performance')}>
      <line x1="0" y1="21" x2="100" y2="21" stroke="var(--nq-border)" strokeWidth="0.4" strokeDasharray="2 2" />
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke="var(--nq-accent)"
        strokeWidth="1.4"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <polygon points={`0,42 ${points.join(' ')} 100,42`} fill="var(--nq-accent)" opacity="0.12" />
    </svg>
  )
}

/**
 * Where the player draws. Each edge is shaded by how often it has been played
 * on that board size, which quickly reveals habits — most people over-play the
 * borders and under-play the centre, which is exactly backwards.
 */
function Heatmap({ heatmaps }: { heatmaps: StatsRecord['heatmaps'] }) {
  const { t } = useI18n()
  const entries = Object.entries(heatmaps)
  if (entries.length === 0) {
    return (
      <p className="text-xs" style={{ color: 'var(--nq-text-muted)' }}>
        {t('stats.noData')}
      </p>
    )
  }
  const [key, counts] = entries.reduce((best, entry) =>
    entry[1].reduce((a, b) => a + b, 0) > best[1].reduce((a, b) => a + b, 0) ? entry : best,
  )
  const [rows, cols] = key.split('x').map(Number)
  const layout = layoutFor({ rows, cols })
  const max = Math.max(1, ...counts)

  return (
    <svg viewBox={layout.viewBox} className="mx-auto h-40 w-40" role="img" aria-label={t('stats.heatmap')}>
      {layout.edges.map((edge) => {
        const intensity = (counts[edge.id] ?? 0) / max
        return (
          <line
            key={edge.id}
            x1={edge.x1}
            y1={edge.y1}
            x2={edge.x2}
            y2={edge.y2}
            stroke="var(--nq-accent)"
            strokeOpacity={0.1 + intensity * 0.9}
            strokeWidth={0.06 + intensity * 0.12}
            strokeLinecap="round"
          />
        )
      })}
      {layout.dots.map((dot, index) => (
        <circle key={index} cx={dot.x} cy={dot.y} r={0.05} fill="var(--nq-dot)" />
      ))}
    </svg>
  )
}
