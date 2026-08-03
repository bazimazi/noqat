/**
 * Turkish — Türk
 *
 * Iznik ceramics: the cobalt, turquoise and *Armenian bole* red that potters
 * perfected in the sixteenth century, on a tin-white ground. Captured boxes
 * carry the Iznik carnation. Music is ney and kanun in makam Hicaz, tuned with
 * Turkish comma inflections rather than equal temperament.
 */
import { TileworkBackdrop } from '../backdrops.tsx'
import { IznikTulip } from '../motifs.tsx'
import type { ThemePack } from '../types.ts'

export const turkishTheme: ThemePack = {
  id: 'turkish',
  name: 'Turkish',
  nativeName: 'Türk',
  blurb: 'Iznik tiles and Bosphorus blues.',
  inspiration: ['Iznik ceramics', 'Ottoman tugra', 'Bosphorus light', 'Ottoman tulips'],
  mode: 'light',
  colors: {
    bg: '#f2f6f8',
    bgAlt: '#e3edf2',
    surface: 'rgba(255, 255, 255, 0.8)',
    surfaceAlt: 'rgba(226, 238, 244, 0.94)',
    border: 'rgba(20, 66, 114, 0.16)',
    text: '#12354f',
    textMuted: 'rgba(18, 53, 79, 0.58)',
    accent: '#1b6ca8',
    accentAlt: '#c8442f',
    lineIdle: 'rgba(18, 53, 79, 0.13)',
    lineHover: 'rgba(27, 108, 168, 0.42)',
    dot: '#144272',
    dotCore: '#2b7fbe',
    boardBg: 'rgba(255, 255, 255, 0.6)',
    players: [
      { line: '#1b6ca8', fill: '#d3e6f4', fillAlt: '#a9cde9', glow: '#3f9ad8', onFill: '#0d2b41' },
      { line: '#c8442f', fill: '#f8dcd6', fillAlt: '#efb8ac', glow: '#e4715c', onFill: '#4a150d' },
      { line: '#2a9d8f', fill: '#d3ece8', fillAlt: '#a6d8d0', glow: '#4fc3b3', onFill: '#0f3b36' },
      { line: '#7b5ea7', fill: '#e3dcf0', fillAlt: '#c7bbe2', glow: '#a289cc', onFill: '#2e2044' },
    ],
  },
  typography: {
    display: '"Georgia", "Palatino Linotype", "Noto Serif", serif',
    body: '"Segoe UI", "Helvetica Neue", system-ui, sans-serif',
    numeric: '"Segoe UI", ui-monospace, monospace',
    displayWeight: 600,
    displayTracking: '0.02em',
    scale: 1,
  },
  shape: {
    radius: 12,
    dotRadius: 0.07,
    lineWidth: 0.1,
    lineCap: 'round',
    boxInset: 0.035,
    boxRadius: 0.04,
    glass: true,
  },
  motion: {
    ease: [0.25, 1, 0.4, 1],
    speed: 1,
    boxReveal: 'bloom',
    lineDraw: 'sweep',
  },
  particles: {
    kind: 'dust',
    colors: ['#1b6ca8', '#c8442f', '#2a9d8f'],
    density: 4,
    speed: 0.18,
    size: [1, 2.4],
    drift: -1.2,
  },
  defaultWeather: 'none',
  victory: { kind: 'tiles', colors: ['#1b6ca8', '#c8442f', '#2a9d8f', '#ffffff'] },
  audio: {
    // Makam Hicaz with Turkish comma inflections (Bayati-adjacent tuning).
    scale: [0, 90, 400, 498, 702, 792, 996],
    root: 208, // G♯3
    tempo: 60,
    lead: 'pluck',
    pad: 'flute',
    percussion: 'ceramic',
    reverb: 0.32,
    place: 'ceramic',
    capture: 'bell',
    ambience: 'water',
    ambienceLevel: 0.09,
  },
  boxMotif: IznikTulip,
  pageBackdrop: TileworkBackdrop,
  suggestedLocales: ['tr'],
}

export default turkishTheme
