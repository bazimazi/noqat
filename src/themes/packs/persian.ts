/**
 * Persian — نقش ایرانی
 *
 * The palette is taken from Safavid tilework: turquoise (fīrūzeh) and lapis
 * (lājvard) with saffron and gold, on the warm cream of unglazed clay. Captured
 * boxes become khatam stars, the eight-point rosette that tiles the domes of
 * Isfahan. The soundtrack is a santoor over a ney drone in Dastgāh-e Shur,
 * whose second degree sits a quarter-tone flat — hence the 150-cent step.
 */
import { TileworkBackdrop } from '../backdrops.tsx'
import { KhatamStar } from '../motifs.tsx'
import type { ThemePack } from '../types.ts'

export const persianTheme: ThemePack = {
  id: 'persian',
  name: 'Persian',
  nativeName: 'ایرانی',
  blurb: 'Isfahan tilework in turquoise, lapis and gold.',
  inspiration: ['Safavid tilework', 'Persian miniature', 'Kashan carpets', 'Girih geometry'],
  mode: 'dark',
  colors: {
    bg: '#0b1a2b',
    bgAlt: '#12293f',
    surface: 'rgba(19, 44, 68, 0.72)',
    surfaceAlt: 'rgba(27, 60, 90, 0.85)',
    border: 'rgba(212, 175, 55, 0.28)',
    text: '#f6f1e3',
    textMuted: 'rgba(246, 241, 227, 0.62)',
    accent: '#2ec4b6',
    accentAlt: '#e0b354',
    lineIdle: 'rgba(246, 241, 227, 0.14)',
    lineHover: 'rgba(46, 196, 182, 0.55)',
    dot: '#e8d9a8',
    dotCore: '#fffaf0',
    boardBg: 'rgba(9, 24, 40, 0.62)',
    players: [
      { line: '#2ec4b6', fill: '#124e57', fillAlt: '#1a6f76', glow: '#5fe0d2', onFill: '#f6f1e3' },
      { line: '#e9a23b', fill: '#6b3410', fillAlt: '#8f5216', glow: '#f7c96b', onFill: '#fff7e8' },
      { line: '#8f7fe8', fill: '#2c2560', fillAlt: '#40378a', glow: '#b7a8ff', onFill: '#f2efff' },
      { line: '#e46b7a', fill: '#5c1c2c', fillAlt: '#7d2a3e', glow: '#ff9aa6', onFill: '#fff0f2' },
    ],
  },
  typography: {
    display: '"Vazirmatn", "Iranian Sans", "Noto Naskh Arabic", "Iowan Old Style", Georgia, serif',
    body: '"Vazirmatn", "Segoe UI", system-ui, sans-serif',
    numeric: '"Vazirmatn", "SF Mono", ui-monospace, monospace',
    displayWeight: 600,
    displayTracking: '0.01em',
    scale: 1,
  },
  shape: {
    radius: 18,
    dotRadius: 0.075,
    lineWidth: 0.11,
    lineCap: 'round',
    boxInset: 0.04,
    boxRadius: 0.06,
    glass: true,
  },
  motion: {
    ease: [0.22, 1, 0.36, 1],
    speed: 1,
    boxReveal: 'bloom',
    lineDraw: 'sweep',
  },
  particles: {
    kind: 'dust',
    colors: ['#e0b354', '#2ec4b6', '#f6f1e3'],
    density: 5,
    speed: 0.16,
    size: [1, 2.6],
    drift: -1.35,
  },
  defaultWeather: 'none',
  victory: { kind: 'tiles', colors: ['#2ec4b6', '#e0b354', '#1d3557', '#f6f1e3'] },
  audio: {
    // Dastgāh-e Shur: the koron (quarter-flat) second is what makes it Persian.
    scale: [0, 150, 300, 500, 700, 800, 1000],
    root: 196, // G3
    tempo: 62,
    lead: 'pluck',
    pad: 'flute',
    percussion: 'ceramic',
    reverb: 0.34,
    place: 'ceramic',
    capture: 'bell',
    ambience: 'room',
    ambienceLevel: 0.1,
  },
  boxMotif: KhatamStar,
  pageBackdrop: TileworkBackdrop,
  suggestedLocales: ['fa'],
}

export default persianTheme
