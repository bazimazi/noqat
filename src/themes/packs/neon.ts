/**
 * Neon Cyberpunk
 *
 * Holographic UI over a synthwave horizon. Lines arrive as a charge rather than
 * a stroke, boxes light up as scan-lined cells, and everything glows. This is
 * the one theme allowed to be loud — motion is fast, easing is snappy, and the
 * soundtrack is an arpeggiated minor synth instead of an acoustic instrument.
 */
import { SynthwaveBackdrop } from '../backdrops.tsx'
import { NeonCell } from '../motifs.tsx'
import type { ThemePack } from '../types.ts'

export const neonTheme: ThemePack = {
  id: 'neon',
  name: 'Neon',
  nativeName: 'ネオン',
  blurb: 'Holograms, synthwave and glowing grids.',
  inspiration: ['Synthwave', 'Holographic HUDs', 'Arcade cabinets', 'Blade Runner rain'],
  mode: 'dark',
  colors: {
    bg: '#06040f',
    bgAlt: '#120a2b',
    surface: 'rgba(18, 10, 43, 0.7)',
    surfaceAlt: 'rgba(31, 17, 68, 0.86)',
    border: 'rgba(0, 245, 212, 0.34)',
    text: '#e6f7ff',
    textMuted: 'rgba(230, 247, 255, 0.6)',
    accent: '#00f5d4',
    accentAlt: '#f72585',
    lineIdle: 'rgba(230, 247, 255, 0.12)',
    lineHover: 'rgba(0, 245, 212, 0.55)',
    dot: '#00f5d4',
    dotCore: '#ffffff',
    boardBg: 'rgba(6, 4, 15, 0.55)',
    players: [
      { line: '#00f5d4', fill: '#03332f', fillAlt: '#054e46', glow: '#5cffe8', onFill: '#eafffb' },
      { line: '#f72585', fill: '#3d0524', fillAlt: '#5c0936', glow: '#ff6bb0', onFill: '#ffeef6' },
      { line: '#ffd60a', fill: '#3d3103', fillAlt: '#5c4a06', glow: '#ffe75c', onFill: '#fffbe6' },
      { line: '#7b61ff', fill: '#211547', fillAlt: '#332169', glow: '#a894ff', onFill: '#f1eeff' },
    ],
  },
  typography: {
    display: '"Eurostile", "Bahnschrift", "Chakra Petch", "Segoe UI", system-ui, sans-serif',
    body: '"Bahnschrift", "Segoe UI", system-ui, sans-serif',
    numeric: '"SF Mono", "Cascadia Mono", ui-monospace, monospace',
    displayWeight: 700,
    displayTracking: '0.14em',
    scale: 0.98,
  },
  shape: {
    radius: 2,
    dotRadius: 0.06,
    lineWidth: 0.09,
    lineCap: 'butt',
    boxInset: 0.02,
    boxRadius: 0.01,
    glass: true,
  },
  motion: {
    ease: [0.16, 1, 0.3, 1],
    speed: 0.7,
    boxReveal: 'shatter',
    lineDraw: 'zap',
  },
  particles: {
    kind: 'sparks',
    colors: ['#00f5d4', '#f72585', '#ffd60a'],
    density: 7,
    speed: 0.6,
    size: [1, 2.6],
    drift: -1.5,
  },
  defaultWeather: 'rain',
  victory: { kind: 'glow', colors: ['#00f5d4', '#f72585', '#7b61ff', '#ffd60a'] },
  audio: {
    // Natural minor with an added ♭5 — the synthwave stock in trade.
    scale: [0, 200, 300, 500, 600, 700, 1000],
    root: 110, // A2
    tempo: 112,
    lead: 'synth',
    pad: 'pad',
    percussion: 'synth',
    reverb: 0.28,
    place: 'synth',
    capture: 'synth',
    ambience: 'city',
    ambienceLevel: 0.1,
  },
  boxMotif: NeonCell,
  pageBackdrop: SynthwaveBackdrop,
  suggestedLocales: [],
}

export default neonTheme
