/**
 * Ephemeral UI state: which screen is showing, which sheet is open, toasts.
 * Nothing here survives a reload — that is the point.
 */
import { create } from 'zustand'

export type Screen =
  | 'menu'
  | 'setup'
  | 'game'
  | 'result'
  | 'themes'
  | 'settings'
  | 'stats'
  | 'howto'
  | 'online'
  | 'replays'
  | 'puzzles'
  | 'campaign'
  | 'trainer'

export interface Toast {
  readonly id: number
  readonly message: string
  readonly tone: 'info' | 'success' | 'warning'
  readonly icon?: string
}

export interface UiState {
  screen: Screen
  previous: Screen | null
  sheet: 'none' | 'settings' | 'history' | 'chat' | 'pause'
  toasts: Toast[]
  /** Set while a theme change is cross-fading, to suppress layout thrash. */
  themeTransition: boolean
  installPromptAvailable: boolean
  online: boolean

  go: (screen: Screen) => void
  back: () => void
  openSheet: (sheet: UiState['sheet']) => void
  closeSheet: () => void
  toast: (message: string, tone?: Toast['tone'], icon?: string) => void
  dismissToast: (id: number) => void
  setThemeTransition: (value: boolean) => void
  setInstallPromptAvailable: (value: boolean) => void
  setOnline: (value: boolean) => void
}

let toastId = 0

export const useUi = create<UiState>()((set, get) => ({
  screen: 'menu',
  previous: null,
  sheet: 'none',
  toasts: [],
  themeTransition: false,
  installPromptAvailable: false,
  online: typeof navigator === 'undefined' ? true : navigator.onLine,

  go: (screen) => set((state) => ({ screen, previous: state.screen, sheet: 'none' })),
  back: () => set((state) => ({ screen: state.previous ?? 'menu', previous: null, sheet: 'none' })),
  openSheet: (sheet) => set({ sheet }),
  closeSheet: () => set({ sheet: 'none' }),

  toast: (message, tone = 'info', icon) => {
    const id = ++toastId
    set((state) => ({ toasts: [...state.toasts, { id, message, tone, icon }] }))
    setTimeout(() => get().dismissToast(id), 3200)
  },
  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

  setThemeTransition: (themeTransition) => set({ themeTransition }),
  setInstallPromptAvailable: (installPromptAvailable) => set({ installPromptAvailable }),
  setOnline: (online) => set({ online }),
}))
