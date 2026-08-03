/**
 * Greek — Ελληνικό
 *
 * Cycladic whitewash and Aegean blue, with the meander (Greek key) as the box
 * motif — a single unbroken line, which is a rather good emblem for a game
 * about drawing them. Marble veining runs behind the board; the mode is Dorian.
 */
import { MarbleBackdrop } from '../backdrops.tsx'
import { Meander } from '../motifs.tsx'
import type { ThemePack } from '../types.ts'

export const greekTheme: ThemePack = {
  id: 'greek',
  name: 'Greek',
  nativeName: 'Ελληνικό',
  blurb: 'Marble, whitewash and the Aegean.',
  inspiration: ['Cycladic architecture', 'Pentelic marble', 'Meander patterns', 'Aegean blue'],
  mode: 'light',
  colors: {
    bg: '#f7f8f7',
    bgAlt: '#e8eef2',
    surface: 'rgba(255, 255, 255, 0.82)',
    surfaceAlt: 'rgba(232, 238, 242, 0.94)',
    border: 'rgba(24, 62, 92, 0.14)',
    text: '#1c3144',
    textMuted: 'rgba(28, 49, 68, 0.56)',
    accent: '#2a6f9e',
    accentAlt: '#7fa8c4',
    lineIdle: 'rgba(28, 49, 68, 0.12)',
    lineHover: 'rgba(42, 111, 158, 0.4)',
    dot: '#1c3144',
    dotCore: '#3d5c78',
    boardBg: 'rgba(255, 255, 255, 0.66)',
    players: [
      { line: '#2a6f9e', fill: '#d8e7f1', fillAlt: '#b0cee2', glow: '#4b96c6', onFill: '#102a3d' },
      { line: '#c9803a', fill: '#f6e5d3', fillAlt: '#e8c9a5', glow: '#dda261', onFill: '#432508' },
      { line: '#5c8a6a', fill: '#dcebe0', fillAlt: '#b8d5c1', glow: '#84b494', onFill: '#1b3423' },
      { line: '#8e6f9e', fill: '#e9e0ef', fillAlt: '#d1c0de', glow: '#ac91bb', onFill: '#33203c' },
    ],
  },
  typography: {
    display: '"Optima", "Palatino Linotype", "Noto Serif", Georgia, serif',
    body: '"Helvetica Neue", "Segoe UI", system-ui, sans-serif',
    numeric: '"Helvetica Neue", ui-monospace, monospace',
    displayWeight: 600,
    displayTracking: '0.1em',
    scale: 1,
  },
  shape: {
    radius: 6,
    dotRadius: 0.06,
    lineWidth: 0.095,
    lineCap: 'square',
    boxInset: 0.02,
    boxRadius: 0,
    glass: false,
  },
  motion: {
    ease: [0.4, 0, 0.2, 1],
    speed: 1.05,
    boxReveal: 'stamp',
    lineDraw: 'sweep',
  },
  particles: {
    kind: 'dust',
    colors: ['#7fa8c4', '#ffffff', '#2a6f9e'],
    density: 3,
    speed: 0.14,
    size: [1, 2.2],
    drift: -1.4,
  },
  defaultWeather: 'none',
  victory: { kind: 'confetti', colors: ['#2a6f9e', '#ffffff', '#7fa8c4'] },
  audio: {
    // Dorian mode — the ancient Greek ethos of steadiness.
    scale: [0, 200, 300, 500, 700, 900, 1000],
    root: 247, // B3
    tempo: 64,
    lead: 'pluck',
    pad: 'pad',
    percussion: null,
    reverb: 0.4,
    place: 'ceramic',
    capture: 'marimba',
    ambience: 'water',
    ambienceLevel: 0.11,
  },
  boxMotif: Meander,
  pageBackdrop: MarbleBackdrop,
  suggestedLocales: [],
}

export default greekTheme
