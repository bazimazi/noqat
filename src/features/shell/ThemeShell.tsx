/**
 * The theme shell: page backdrop, ambient particles, and the single place
 * where theme tokens are written to the document.
 *
 * Switching theme cross-fades the backdrop rather than cutting, because a hard
 * cut between, say, the Persian night and the Japanese paper room is jarring
 * enough to feel like a bug.
 */
import { useEffect, useMemo, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { getTheme } from '../../themes/registry.ts'
import { applyThemeVars, type AccessibilityOverrides } from '../../themes/tokens.ts'
import type { WeatherKind } from '../../themes/types.ts'
import { ParticleField } from '../effects/ParticleField.tsx'
import { useSettings } from '../../state/settingsStore.ts'
import { useUi } from '../../state/uiStore.ts'

export function ThemeShell({
  children,
  burst,
}: {
  children: ReactNode
  burst?: { at: number; colors: readonly string[]; kind: string } | null
}) {
  const themeId = useSettings((s) => s.themeId)
  const a11y = useSettings((s) => s.a11y)
  const weatherSetting = useSettings((s) => s.weather)
  const particlesEnabled = useSettings((s) => s.particles)
  const setThemeTransition = useUi((s) => s.setThemeTransition)

  const theme = useMemo(() => getTheme(themeId), [themeId])

  useEffect(() => {
    applyThemeVars(document.documentElement, theme, a11y as AccessibilityOverrides)
    document.documentElement.dataset.reducedMotion = String(a11y.reducedMotion)
    const meta = document.querySelector('meta[name="theme-color"]')
    meta?.setAttribute('content', theme.colors.bg)
  }, [theme, a11y])

  useEffect(() => {
    setThemeTransition(true)
    const timer = setTimeout(() => setThemeTransition(false), 620)
    return () => clearTimeout(timer)
  }, [themeId, setThemeTransition])

  const weather: WeatherKind =
    weatherSetting === 'off' ? 'none' : weatherSetting === 'auto' ? theme.defaultWeather : weatherSetting

  const Backdrop = theme.pageBackdrop

  return (
    <div className="nq-app nq-stage relative overflow-hidden" data-theme={theme.id}>
      <AnimatePresence mode="wait">
        <motion.div
          key={theme.id}
          className="nq-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: a11y.reducedMotion ? 0 : 0.6 }}
        >
          {Backdrop ? <Backdrop seed={1} colors={theme.colors} /> : null}
        </motion.div>
      </AnimatePresence>

      <ParticleField
        particles={theme.particles}
        weather={weather}
        enabled={particlesEnabled}
        reducedMotion={a11y.reducedMotion}
        burst={burst ?? null}
      />

      <div className="relative z-10 h-full">{children}</div>
    </div>
  )
}
