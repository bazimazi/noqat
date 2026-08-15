/**
 * Application shell.
 *
 * Routing is a single piece of state rather than a router: the game is a small
 * number of full-screen views with animated transitions between them, and URLs
 * only matter for two entry points (a shared replay and an online room), which
 * are handled explicitly on boot.
 *
 * Heavy screens are lazily loaded so the first paint only pays for the menu.
 */
import { Suspense, lazy, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ThemeShell } from './features/shell/ThemeShell.tsx'
import { MenuScreen } from './features/menu/MenuScreen.tsx'
import { useUi, type Screen } from './state/uiStore.ts'
import { useSettings, systemA11yDefaults } from './state/settingsStore.ts'
import { useProfile } from './state/profileStore.ts'
import { useI18n } from './i18n/index.tsx'
import { isLocale } from './i18n/locales.ts'
import { decodeShareCode } from './core/serialization.ts'
import { useGame } from './state/gameStore.ts'
import { requestPersistence } from './persistence/db.ts'

const SetupScreen = lazy(() => import('./features/menu/SetupScreen.tsx').then((m) => ({ default: m.SetupScreen })))
const GameScreen = lazy(() => import('./features/game/GameScreen.tsx').then((m) => ({ default: m.GameScreen })))
const ResultScreen = lazy(() => import('./features/result/ResultScreen.tsx').then((m) => ({ default: m.ResultScreen })))
const ThemeGallery = lazy(() => import('./features/themes/ThemeGallery.tsx').then((m) => ({ default: m.ThemeGallery })))
const SettingsScreen = lazy(() => import('./features/settings/SettingsScreen.tsx').then((m) => ({ default: m.SettingsScreen })))
const StatsScreen = lazy(() => import('./features/stats/StatsScreen.tsx').then((m) => ({ default: m.StatsScreen })))
const HowToScreen = lazy(() => import('./features/help/HowToScreen.tsx').then((m) => ({ default: m.HowToScreen })))
const OnlineScreen = lazy(() => import('./features/online/OnlineScreen.tsx').then((m) => ({ default: m.OnlineScreen })))
const PuzzlesScreen = lazy(() => import('./features/modes/ModeScreens.tsx').then((m) => ({ default: m.PuzzlesScreen })))
const CampaignScreen = lazy(() => import('./features/modes/ModeScreens.tsx').then((m) => ({ default: m.CampaignScreen })))
const TrainerScreen = lazy(() => import('./features/modes/ModeScreens.tsx').then((m) => ({ default: m.TrainerScreen })))

export default function App() {
  const screen = useUi((s) => s.screen)
  const go = useUi((s) => s.go)
  const setOnline = useUi((s) => s.setOnline)
  const setInstallPromptAvailable = useUi((s) => s.setInstallPromptAvailable)
  const reducedMotion = useSettings((s) => s.a11y.reducedMotion)
  const settingsLocale = useSettings((s) => s.locale)
  const setA11y = useSettings((s) => s.setA11y)
  const loadProfile = useProfile((s) => s.load)
  const { setLocale } = useI18n()
  const [burst, setBurst] = useState<{ at: number; colors: readonly string[]; kind: string } | null>(null)

  // ---- boot -------------------------------------------------------------
  useEffect(() => {
    void loadProfile()
    void requestPersistence()
    document.getElementById('boot')?.classList.add('done')
    setTimeout(() => document.getElementById('boot')?.remove(), 700)

    // Adopt the OS accessibility preferences on first run only, so a later
    // in-game choice is never overwritten.
    if (!useSettings.getState().onboarded) {
      setA11y(systemA11yDefaults())
      useSettings.getState().patch({ onboarded: true })
    }
  }, [loadProfile, setA11y])

  useEffect(() => {
    if (settingsLocale !== 'auto' && isLocale(settingsLocale)) setLocale(settingsLocale)
  }, [settingsLocale, setLocale])

  // ---- deep links -------------------------------------------------------
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const replay = params.get('replay')
    const room = params.get('room')
    const shortcut = params.get('shortcut')

    if (replay) {
      try {
        const decoded = decodeShareCode(replay)
        useGame.getState().start({
          size: { rows: decoded.rows, cols: decoded.cols },
          players: [
            { kind: 'human', name: 'A' },
            { kind: 'human', name: 'B' },
          ],
          resume: decoded,
          // Somebody else's game: watchable, but it must never be paid out into
          // this player's XP or statistics.
          resultRecorded: true,
        })
        useGame.getState().watchReplay()
        go('game')
      } catch {
        /* a corrupted link should not break the app */
      }
    } else if (room) {
      go('online')
    } else if (shortcut === 'ai' || shortcut === 'local') {
      go('setup')
    } else if (shortcut === 'daily') {
      go('setup')
    }
  }, [go])

  // ---- connectivity and install prompt ----------------------------------
  useEffect(() => {
    const online = () => setOnline(true)
    const offline = () => setOnline(false)
    window.addEventListener('online', online)
    window.addEventListener('offline', offline)

    let deferred: Event | null = null
    const onBeforeInstall = (event: Event) => {
      event.preventDefault()
      deferred = event
      setInstallPromptAvailable(true)
    }
    const onInstallRequest = () => {
      ;(deferred as unknown as { prompt?: () => void })?.prompt?.()
      deferred = null
      setInstallPromptAvailable(false)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('noqat:install', onInstallRequest)

    return () => {
      window.removeEventListener('online', online)
      window.removeEventListener('offline', offline)
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('noqat:install', onInstallRequest)
    }
  }, [setOnline, setInstallPromptAvailable])

  return (
    <ThemeShell burst={burst}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.main
          key={screen}
          className="h-full"
          initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.995 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.997 }}
          transition={{ duration: reducedMotion ? 0 : 0.26, ease: [0.22, 1, 0.36, 1] }}
        >
          <Suspense fallback={<ScreenFallback />}>
            <ScreenRouter screen={screen} onBurst={setBurst} />
          </Suspense>
        </motion.main>
      </AnimatePresence>
      <Toasts />
    </ThemeShell>
  )
}

function ScreenRouter({
  screen,
  onBurst,
}: {
  screen: Screen
  onBurst: (burst: { at: number; colors: readonly string[]; kind: string }) => void
}) {
  switch (screen) {
    case 'setup':
      return <SetupScreen />
    case 'game':
      return <GameScreen />
    case 'result':
      return <ResultScreen onBurst={onBurst} />
    case 'themes':
      return <ThemeGallery />
    case 'settings':
      return <SettingsScreen />
    case 'stats':
      return <StatsScreen />
    case 'howto':
      return <HowToScreen />
    case 'online':
      return <OnlineScreen />
    case 'puzzles':
      return <PuzzlesScreen />
    case 'campaign':
      return <CampaignScreen />
    case 'trainer':
      return <TrainerScreen />
    case 'menu':
    default:
      return <MenuScreen />
  }
}

function ScreenFallback() {
  const { t } = useI18n()
  return (
    <div className="grid h-full place-items-center" role="status" aria-live="polite">
      <span className="text-sm" style={{ color: 'var(--nq-text-muted)' }}>
        {t('common.loading')}
      </span>
    </div>
  )
}

function Toasts() {
  const toasts = useUi((s) => s.toasts)
  const dismiss = useUi((s) => s.dismissToast)
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-50 grid justify-items-center gap-2 px-3">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            role="status"
            className="nq-panel pointer-events-auto max-w-sm px-4 py-2 text-sm"
            style={{ borderColor: toast.tone === 'success' ? 'var(--nq-accent)' : undefined }}
            initial={{ opacity: 0, y: -14, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.97 }}
            onClick={() => dismiss(toast.id)}
          >
            {toast.icon && <span className="me-2">{toast.icon}</span>}
            {toast.message}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
