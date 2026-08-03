/**
 * Minimal
 *
 * Apple HIG in spirit: system type, generous whitespace, one accent colour, and
 * motion that exists only to explain what changed. Every other theme is
 * expressive; this one is the reference implementation that proves the engine
 * looks right with the decoration turned off. It is also the default for
 * high-contrast and reduced-motion users.
 */
import { CleanBackdrop } from '../backdrops.tsx'
import { MinimalTile } from '../motifs.tsx'
import type { ThemePack } from '../types.ts'

export const minimalTheme: ThemePack = {
  id: 'minimal',
  name: 'Minimal',
  nativeName: 'Minimal',
  blurb: 'Clean, quiet and out of the way.',
  inspiration: ['Apple Human Interface Guidelines', 'Swiss typography', 'Dieter Rams'],
  mode: 'light',
  colors: {
    bg: '#fbfbfd',
    bgAlt: '#f1f1f4',
    surface: 'rgba(255, 255, 255, 0.86)',
    surfaceAlt: 'rgba(242, 242, 245, 0.96)',
    border: 'rgba(0, 0, 0, 0.1)',
    text: '#1d1d1f',
    textMuted: 'rgba(29, 29, 31, 0.56)',
    accent: '#0071e3',
    accentAlt: '#30d158',
    lineIdle: 'rgba(0, 0, 0, 0.1)',
    lineHover: 'rgba(0, 113, 227, 0.36)',
    dot: '#1d1d1f',
    dotCore: '#48484a',
    boardBg: 'rgba(255, 255, 255, 0.7)',
    players: [
      { line: '#0071e3', fill: '#dceafb', fillAlt: '#b9d5f7', glow: '#4b9bf0', onFill: '#0a2540' },
      { line: '#ff9f0a', fill: '#ffeeda', fillAlt: '#ffdcb0', glow: '#ffbe57', onFill: '#412200' },
      { line: '#30d158', fill: '#daf7e2', fillAlt: '#b3eec6', glow: '#69e08a', onFill: '#0c3418' },
      { line: '#bf5af2', fill: '#f2e0fb', fillAlt: '#e2c1f7', glow: '#d18ef6', onFill: '#340a45' },
    ],
  },
  typography: {
    display:
      '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI Variable Display", "Segoe UI", system-ui, sans-serif',
    body: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, sans-serif',
    numeric: '"SF Mono", "Cascadia Mono", ui-monospace, monospace',
    displayWeight: 600,
    displayTracking: '-0.02em',
    scale: 1,
  },
  shape: {
    radius: 16,
    dotRadius: 0.055,
    lineWidth: 0.085,
    lineCap: 'round',
    boxInset: 0.06,
    boxRadius: 0.12,
    glass: true,
  },
  motion: {
    ease: [0.32, 0.72, 0, 1],
    speed: 0.9,
    boxReveal: 'fade',
    lineDraw: 'sweep',
  },
  particles: {
    kind: 'none',
    colors: [],
    density: 0,
    speed: 0,
    size: [0, 0],
    drift: 0,
  },
  defaultWeather: 'none',
  victory: { kind: 'confetti', colors: ['#0071e3', '#30d158', '#ff9f0a', '#bf5af2'] },
  audio: {
    scale: [0, 200, 400, 700, 900],
    root: 330, // E4
    tempo: 74,
    lead: 'marimba',
    pad: 'pad',
    percussion: null,
    reverb: 0.18,
    place: 'ceramic',
    capture: 'marimba',
    ambience: 'none',
    ambienceLevel: 0,
  },
  boxMotif: MinimalTile,
  pageBackdrop: CleanBackdrop,
  suggestedLocales: ['en'],
}

export default minimalTheme
