/**
 * Theme → CSS custom properties.
 *
 * Components never import a theme object for styling; they read `var(--nq-*)`.
 * That keeps theme switching to a single write on `<html>` (no React re-render
 * cascade), lets CSS transitions animate the change, and means a theme can be
 * swapped mid-animation without tearing.
 */
import type { ColorMode, ThemePack } from './types.ts'

export interface AccessibilityOverrides {
  readonly highContrast: boolean
  /** Substitutes a palette that stays distinguishable for colour-blind players. */
  readonly colorblind: 'off' | 'deuteranopia' | 'protanopia' | 'tritanopia'
  readonly reducedMotion: boolean
  /** 0.25 .. 2 — scales every animation duration. */
  readonly animationSpeed: number
  /** Scales the whole type ramp and hit targets. */
  readonly uiScale: number
}

export const DEFAULT_A11Y: AccessibilityOverrides = {
  highContrast: false,
  colorblind: 'off',
  reducedMotion: false,
  animationSpeed: 1,
  uiScale: 1,
}

/**
 * Player colours chosen to stay separable under the three common forms of
 * colour blindness. Ordered by luminance as well as hue, so they also survive
 * being printed in greyscale.
 */
const COLORBLIND_PALETTES: Record<Exclude<AccessibilityOverrides['colorblind'], 'off'>, string[][]> = {
  // Blue / orange / white / black — the classic deutan-safe set.
  deuteranopia: [
    ['#0072b2', '#004c78', '#0090e0', '#4db4ff', '#ffffff'],
    ['#e69f00', '#8a5f00', '#ffb733', '#ffd280', '#1b1000'],
    ['#56b4e9', '#1f6f96', '#8ccff2', '#c2e6f9', '#04222f'],
    ['#d55e00', '#823800', '#ff8433', '#ffb480', '#2a0f00'],
  ],
  protanopia: [
    ['#0072b2', '#004c78', '#0090e0', '#4db4ff', '#ffffff'],
    ['#f0e442', '#8f8916', '#f7ee85', '#fcf7c2', '#211f00'],
    ['#009e73', '#006146', '#00d29a', '#66e8c6', '#00291d'],
    ['#cc79a7', '#8a4470', '#e0a3c4', '#f0d1e1', '#33081f'],
  ],
  tritanopia: [
    ['#d81b60', '#8c0f3d', '#f0518d', '#f8a8c6', '#ffffff'],
    ['#1e88e5', '#11548f', '#5cb0f2', '#aed7f8', '#04182b'],
    ['#004d40', '#00251f', '#00997f', '#4dc4b0', '#e0fff8'],
    ['#ffc107', '#997200', '#ffd75c', '#ffebae', '#332600'],
  ],
}

function highContrastFor(mode: ColorMode) {
  return mode === 'dark'
    ? {
        bg: '#000000',
        bgAlt: '#0a0a0a',
        surface: 'rgba(0, 0, 0, 0.92)',
        surfaceAlt: '#141414',
        border: '#ffffff',
        text: '#ffffff',
        textMuted: '#e0e0e0',
        lineIdle: 'rgba(255, 255, 255, 0.42)',
        dot: '#ffffff',
        dotCore: '#ffffff',
        boardBg: '#000000',
      }
    : {
        bg: '#ffffff',
        bgAlt: '#f2f2f2',
        surface: 'rgba(255, 255, 255, 0.98)',
        surfaceAlt: '#ececec',
        border: '#000000',
        text: '#000000',
        textMuted: '#1f1f1f',
        lineIdle: 'rgba(0, 0, 0, 0.42)',
        dot: '#000000',
        dotCore: '#000000',
        boardBg: '#ffffff',
      }
}

export function themeToCssVars(
  theme: ThemePack,
  a11y: AccessibilityOverrides = DEFAULT_A11Y,
): Record<string, string> {
  const c = theme.colors
  const hc = a11y.highContrast ? highContrastFor(theme.mode) : null
  const cbPalette = a11y.colorblind === 'off' ? null : COLORBLIND_PALETTES[a11y.colorblind]

  const vars: Record<string, string> = {
    '--nq-bg': hc?.bg ?? c.bg,
    '--nq-bg-alt': hc?.bgAlt ?? c.bgAlt,
    '--nq-surface': hc?.surface ?? c.surface,
    '--nq-surface-alt': hc?.surfaceAlt ?? c.surfaceAlt,
    '--nq-border': hc?.border ?? c.border,
    '--nq-text': hc?.text ?? c.text,
    '--nq-text-muted': hc?.textMuted ?? c.textMuted,
    '--nq-accent': c.accent,
    '--nq-accent-alt': c.accentAlt,
    '--nq-line-idle': hc?.lineIdle ?? c.lineIdle,
    '--nq-line-hover': c.lineHover,
    '--nq-dot': hc?.dot ?? c.dot,
    '--nq-dot-core': hc?.dotCore ?? c.dotCore,
    '--nq-board-bg': hc?.boardBg ?? c.boardBg,

    '--nq-font-display': theme.typography.display,
    '--nq-font-body': theme.typography.body,
    '--nq-font-numeric': theme.typography.numeric,
    '--nq-display-weight': String(theme.typography.displayWeight),
    '--nq-display-tracking': theme.typography.displayTracking,
    '--nq-type-scale': String(theme.typography.scale * a11y.uiScale),

    '--nq-radius': `${theme.shape.radius}px`,
    '--nq-radius-sm': `${Math.max(2, theme.shape.radius * 0.5)}px`,
    '--nq-radius-lg': `${theme.shape.radius * 1.6}px`,
    '--nq-glass': theme.shape.glass && !a11y.highContrast ? 'blur(18px) saturate(1.3)' : 'none',

    '--nq-ease': `cubic-bezier(${theme.motion.ease.join(', ')})`,
    '--nq-speed': String(motionSpeed(theme, a11y)),
    '--nq-dur-fast': `${Math.round(120 * motionSpeed(theme, a11y))}ms`,
    '--nq-dur': `${Math.round(260 * motionSpeed(theme, a11y))}ms`,
    '--nq-dur-slow': `${Math.round(520 * motionSpeed(theme, a11y))}ms`,
  }

  for (let i = 0; i < 4; i++) {
    const p = c.players[i]
    const cb = cbPalette?.[i]
    vars[`--nq-p${i}-line`] = cb?.[0] ?? p.line
    vars[`--nq-p${i}-fill`] = cb?.[1] ?? p.fill
    vars[`--nq-p${i}-fill-alt`] = cb?.[2] ?? p.fillAlt
    vars[`--nq-p${i}-glow`] = cb?.[3] ?? p.glow
    vars[`--nq-p${i}-on-fill`] = cb?.[4] ?? p.onFill
  }

  return vars
}

function motionSpeed(theme: ThemePack, a11y: AccessibilityOverrides): number {
  if (a11y.reducedMotion) return 0.001
  return theme.motion.speed / Math.max(0.25, a11y.animationSpeed)
}

/** Applies the variables to an element (normally `document.documentElement`). */
export function applyThemeVars(
  element: HTMLElement,
  theme: ThemePack,
  a11y: AccessibilityOverrides = DEFAULT_A11Y,
): void {
  const vars = themeToCssVars(theme, a11y)
  for (const [key, value] of Object.entries(vars)) element.style.setProperty(key, value)
  element.dataset.theme = theme.id
  element.dataset.mode = theme.mode
  element.style.colorScheme = theme.mode
}

/**
 * Resolves the player palette actually in use, honouring colour-blind
 * substitutions. The board reads this rather than the raw theme so that
 * motifs and particles match the CSS variables exactly.
 */
export function resolvedPlayerPalette(
  theme: ThemePack,
  player: number,
  a11y: AccessibilityOverrides = DEFAULT_A11Y,
) {
  const base = theme.colors.players[Math.min(3, Math.max(0, player))]
  if (a11y.colorblind === 'off') return base
  const cb = COLORBLIND_PALETTES[a11y.colorblind][Math.min(3, Math.max(0, player))]
  return { line: cb[0], fill: cb[1], fillAlt: cb[2], glow: cb[3], onFill: cb[4] }
}
