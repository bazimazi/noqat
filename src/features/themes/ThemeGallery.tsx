/**
 * The theme gallery.
 *
 * Each card renders a *real* miniature board using that theme's own motif,
 * palette and dot style — not a screenshot and not a colour swatch. Themes are
 * where most of this game's personality lives, so choosing one should feel like
 * browsing tiles, and every card credits what it draws from.
 */
import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { BackIcon, Button, IconButton } from '../../components/ui.tsx'
import { useI18n } from '../../i18n/index.tsx'
import { useUi } from '../../state/uiStore.ts'
import { useSettings } from '../../state/settingsStore.ts'
import { useProfile, unlockedThemesFor } from '../../state/profileStore.ts'
import { allThemes, THEME_UNLOCKS } from '../../themes/registry.ts'
import type { ThemePack } from '../../themes/types.ts'
import { getAudioEngine } from '../../audio/engine.ts'

export function ThemeGallery() {
  const { t, n } = useI18n()
  const go = useUi((s) => s.go)
  const themeId = useSettings((s) => s.themeId)
  const setTheme = useSettings((s) => s.setTheme)
  const level = useProfile((s) => s.level)
  const explicit = useProfile((s) => s.unlockedThemes)

  const unlocked = useMemo(() => new Set(unlockedThemesFor(level, explicit)), [level, explicit])
  const themes = allThemes()

  return (
    <div className="nq-scroll h-full p-4 sm:p-6">
      <header className="mb-4 flex items-center gap-2">
        <IconButton label={t('common.back')} onClick={() => go('menu')}>
          <BackIcon />
        </IconButton>
        <h1 className="nq-display text-xl">{t('themes.title')}</h1>
      </header>

      <ul className="mx-auto grid max-w-4xl gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {themes.map((theme, index) => {
          const isUnlocked = unlocked.has(theme.id)
          const active = theme.id === themeId
          return (
            <motion.li
              key={theme.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(0.3, index * 0.03), duration: 0.35 }}
            >
              <article
                className="nq-panel overflow-hidden p-0"
                style={{ borderColor: active ? 'var(--nq-accent)' : undefined }}
                aria-current={active ? 'true' : undefined}
              >
                <ThemeThumbnail theme={theme} locked={!isUnlocked} />
                <div className="p-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <h2 className="nq-display text-base">{theme.name}</h2>
                    <span className="text-sm" style={{ color: 'var(--nq-text-muted)' }} lang="und">
                      {theme.nativeName}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs" style={{ color: 'var(--nq-text-muted)' }}>
                    {theme.blurb}
                  </p>
                  <p className="mt-1.5 text-[11px]" style={{ color: 'var(--nq-text-muted)' }}>
                    <span className="font-medium">{t('themes.inspiredBy')}: </span>
                    {theme.inspiration.join(' · ')}
                  </p>
                  <div className="mt-3">
                    {isUnlocked ? (
                      <Button
                        size="sm"
                        block
                        variant={active ? 'primary' : 'secondary'}
                        onClick={() => {
                          setTheme(theme.id)
                          const engine = getAudioEngine()
                          engine.setTheme(theme.audio)
                          engine.play('select')
                        }}
                      >
                        {active ? t('common.done') : t('themes.apply')}
                      </Button>
                    ) : (
                      <Button size="sm" block disabled>
                        {t('themes.unlockAt', { n: THEME_UNLOCKS[theme.id]?.level ?? 0 })}
                      </Button>
                    )}
                  </div>
                </div>
              </article>
            </motion.li>
          )
        })}
      </ul>

      <p className="mt-6 text-center text-xs" style={{ color: 'var(--nq-text-muted)' }}>
        {t('common.level', { n: level })} · {n(unlocked.size)}/{n(themes.length)}
      </p>
    </div>
  )
}

/**
 * A three-by-two board in the theme's own language: its background colour, its
 * dots, its line weight, and two captured boxes drawn with its actual motif.
 */
function ThemeThumbnail({ theme, locked }: { theme: ThemePack; locked: boolean }) {
  const rows = 2
  const cols = 3
  const captured: { box: number; player: number }[] = [
    { box: 0, player: 0 },
    { box: 4, player: 1 },
    { box: 2, player: 1 },
  ]

  return (
    <div
      className="relative"
      style={{ background: theme.colors.bg, filter: locked ? 'grayscale(0.85) brightness(0.6)' : undefined }}
    >
      <svg viewBox="-0.6 -0.6 4.2 3.2" className="block h-28 w-full" aria-hidden="true">
        <rect x={-0.6} y={-0.6} width={4.2} height={3.2} fill={theme.colors.boardBg} />
        {captured.map(({ box, player }) => {
          const palette = theme.colors.players[player]
          const x = box % cols
          const y = Math.floor(box / cols)
          const inset = theme.shape.boxInset
          return (
            <g key={box} transform={`translate(${x + inset} ${y + inset}) scale(${1 - inset * 2})`}>
              {theme.boxMotif({ player, palette, seed: box + 3, size: 1 })}
            </g>
          )
        })}
        {[
          { x1: 0, y1: 0, x2: 1, y2: 0, p: 0 },
          { x1: 0, y1: 1, x2: 1, y2: 1, p: 0 },
          { x1: 0, y1: 0, x2: 0, y2: 1, p: 0 },
          { x1: 1, y1: 0, x2: 1, y2: 1, p: 1 },
          { x1: 2, y1: 0, x2: 3, y2: 0, p: 1 },
          { x1: 1, y1: 2, x2: 2, y2: 2, p: 1 },
        ].map((line, index) => (
          <line
            key={index}
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            stroke={theme.colors.players[line.p].line}
            strokeWidth={theme.shape.lineWidth}
            strokeLinecap={theme.shape.lineCap}
          />
        ))}
        {Array.from({ length: (rows + 1) * (cols + 1) }, (_, index) => {
          const x = index % (cols + 1)
          const y = Math.floor(index / (cols + 1))
          return (
            <g key={`d${index}`}>
              <circle cx={x} cy={y} r={theme.shape.dotRadius} fill={theme.colors.dot} />
              <circle cx={x} cy={y} r={theme.shape.dotRadius * 0.42} fill={theme.colors.dotCore} />
            </g>
          )
        })}
      </svg>
      {locked && (
        <div className="absolute inset-0 grid place-items-center">
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="#fff" strokeWidth="1.8">
            <rect x="5" y="10.5" width="14" height="9.5" rx="2" />
            <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
          </svg>
        </div>
      )}
    </div>
  )
}
