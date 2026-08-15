/**
 * Settings.
 *
 * Kept in localStorage rather than IndexedDB because they must be readable
 * synchronously on the very first paint — theme and direction have to be right
 * before anything renders, or the app flashes the wrong colours.
 */
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { DEFAULT_THEME } from '../themes/registry.ts'
import type { ThemeId, WeatherKind } from '../themes/types.ts'
import type { AccessibilityOverrides } from '../themes/tokens.ts'
import { DEFAULT_LEVELS, type AudioLevels } from '../audio/engine.ts'
import type { Locale } from '../i18n/locales.ts'
import type { Difficulty } from '../ai/types.ts'
import type { BoardSize } from '../core/types.ts'

export interface SettingsState {
  themeId: ThemeId
  /** 'auto' follows the theme's own light/dark preference. */
  colorMode: 'auto' | 'light' | 'dark'
  locale: Locale | 'auto'
  audio: AudioLevels
  musicEnabled: boolean
  a11y: AccessibilityOverrides
  weather: WeatherKind | 'auto' | 'off'
  particles: boolean
  haptics: boolean
  confirmMoves: boolean
  showCoordinates: boolean
  showChainWarnings: boolean
  /**
   * Keep the board's keyboard cursor visible at all times. Off by default: the
   * board still reveals it the moment someone actually navigates by key, so
   * pointer players never see a marker they did not ask for.
   */
  showKeyboardHints: boolean
  lastBoardSize: BoardSize
  lastDifficulty: Difficulty
  playerName: string
  /** Set once the player has seen the tutorial. */
  onboarded: boolean

  setTheme: (themeId: ThemeId) => void
  setLocale: (locale: Locale | 'auto') => void
  setAudio: (patch: Partial<AudioLevels>) => void
  setA11y: (patch: Partial<AccessibilityOverrides>) => void
  setWeather: (weather: SettingsState['weather']) => void
  patch: (patch: Partial<SettingsState>) => void
  reset: () => void
}

const DEFAULTS = {
  themeId: DEFAULT_THEME,
  colorMode: 'auto' as const,
  locale: 'auto' as const,
  audio: DEFAULT_LEVELS,
  musicEnabled: true,
  a11y: {
    highContrast: false,
    colorblind: 'off' as const,
    reducedMotion: false,
    animationSpeed: 1,
    uiScale: 1,
  },
  weather: 'auto' as const,
  particles: true,
  haptics: true,
  confirmMoves: false,
  showCoordinates: false,
  showChainWarnings: true,
  showKeyboardHints: false,
  lastBoardSize: { rows: 5, cols: 5 },
  lastDifficulty: 'medium' as Difficulty,
  playerName: '',
  onboarded: false,
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      setTheme: (themeId) => set({ themeId }),
      setLocale: (locale) => set({ locale }),
      setAudio: (patch) => set((state) => ({ audio: { ...state.audio, ...patch } })),
      setA11y: (patch) => set((state) => ({ a11y: { ...state.a11y, ...patch } })),
      setWeather: (weather) => set({ weather }),
      patch: (patch) => set(patch),
      reset: () => set(DEFAULTS),
    }),
    {
      name: 'noqat.settings',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ setTheme: _a, setLocale: _b, setAudio: _c, setA11y: _d, setWeather: _e, patch: _f, reset: _g, ...rest }) => rest,
    },
  ),
)

/**
 * The OS-level accessibility preferences, merged over the user's explicit
 * choices. A player who has asked their system for reduced motion gets it by
 * default, but can still turn animation back on inside the game.
 */
export function systemA11yDefaults(): Partial<AccessibilityOverrides> {
  if (typeof matchMedia !== 'function') return {}
  return {
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    highContrast: matchMedia('(prefers-contrast: more)').matches,
  }
}
