/**
 * European Classic — the chess club
 *
 * Aged parchment, iron-gall ink, walnut and brass. Captured boxes are engraved
 * guilloche rosettes, the lathe-turned ornament of banknotes and pocket
 * watches. Everything is quiet, warm and slightly worn; the only bright thing
 * on the page is the ink you just drew.
 */
import { ParchmentBackdrop } from '../backdrops.tsx'
import { Guilloche } from '../motifs.tsx'
import type { ThemePack } from '../types.ts'

export const europeanTheme: ThemePack = {
  id: 'european',
  name: 'European Classic',
  nativeName: 'Classique',
  blurb: 'Parchment, fountain pens and walnut.',
  inspiration: ['Iron-gall ink', 'Guilloche engraving', 'Walnut chess cabinets', 'Letterpress'],
  mode: 'light',
  colors: {
    bg: '#f4ecdc',
    bgAlt: '#e8dcc4',
    surface: 'rgba(252, 247, 236, 0.84)',
    surfaceAlt: 'rgba(233, 221, 198, 0.94)',
    border: 'rgba(72, 54, 34, 0.2)',
    text: '#2f2418',
    textMuted: 'rgba(47, 36, 24, 0.58)',
    accent: '#7c4a2d',
    accentAlt: '#2d4a5c',
    lineIdle: 'rgba(47, 36, 24, 0.14)',
    lineHover: 'rgba(124, 74, 45, 0.42)',
    dot: '#2f2418',
    dotCore: '#5c4a34',
    boardBg: 'rgba(252, 247, 236, 0.6)',
    players: [
      { line: '#2d3a5c', fill: '#dde2ee', fillAlt: '#b9c3dc', glow: '#5a6c96', onFill: '#161d31' },
      { line: '#8c3a2c', fill: '#f0dcd6', fillAlt: '#dfbcb1', glow: '#b8604f', onFill: '#3b120b' },
      { line: '#3f6b4a', fill: '#dde9df', fillAlt: '#bbd2bf', glow: '#6b9c78', onFill: '#152b1c' },
      { line: '#7a6428', fill: '#efe6c8', fillAlt: '#dccfa1', glow: '#a89154', onFill: '#33290a' },
    ],
  },
  typography: {
    display: '"Baskerville", "Libre Baskerville", "Times New Roman", Georgia, serif',
    body: '"Iowan Old Style", "Palatino Linotype", Georgia, serif',
    numeric: '"Palatino Linotype", ui-monospace, monospace',
    displayWeight: 600,
    displayTracking: '0.02em',
    scale: 1,
  },
  shape: {
    radius: 3,
    dotRadius: 0.06,
    lineWidth: 0.09,
    lineCap: 'round',
    boxInset: 0.05,
    boxRadius: 0.01,
    glass: false,
  },
  motion: {
    ease: [0.4, 0, 0.2, 1],
    speed: 1.1,
    boxReveal: 'ink',
    lineDraw: 'brush',
  },
  particles: {
    kind: 'dust',
    colors: ['#7c4a2d', '#2d4a5c', '#c9b48a'],
    density: 3,
    speed: 0.12,
    size: [0.9, 2],
    drift: -1.45,
  },
  defaultWeather: 'none',
  victory: { kind: 'confetti', colors: ['#7c4a2d', '#2d4a5c', '#c9b48a'] },
  audio: {
    scale: [0, 200, 400, 500, 700, 900, 1100],
    root: 262, // C4
    tempo: 68,
    lead: 'marimba',
    pad: 'pad',
    percussion: null,
    reverb: 0.3,
    place: 'ceramic',
    capture: 'bell',
    ambience: 'room',
    ambienceLevel: 0.09,
  },
  boxMotif: Guilloche,
  pageBackdrop: ParchmentBackdrop,
  suggestedLocales: ['fr', 'de', 'en'],
}

export default europeanTheme
