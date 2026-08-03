/**
 * Mexican — Mexicano
 *
 * Talavera poblana: cobalt and tin-white ceramics, with the saturated pinks,
 * oranges and greens of papel picado strung overhead. Captured boxes become
 * Talavera rosettes. Bright, celebratory, and deliberately not sombre — this is
 * fiesta colour, not costume.
 */
import { PapelBackdrop } from '../backdrops.tsx'
import { Talavera } from '../motifs.tsx'
import type { ThemePack } from '../types.ts'

export const mexicanTheme: ThemePack = {
  id: 'mexican',
  name: 'Mexican',
  nativeName: 'Mexicano',
  blurb: 'Talavera ceramics and papel picado.',
  inspiration: ['Talavera poblana', 'Papel picado', 'Oaxacan alebrijes', 'Mercado colour'],
  mode: 'dark',
  colors: {
    bg: '#171029',
    bgAlt: '#241640',
    surface: 'rgba(42, 26, 72, 0.76)',
    surfaceAlt: 'rgba(60, 36, 100, 0.9)',
    border: 'rgba(255, 209, 102, 0.28)',
    text: '#fff4e6',
    textMuted: 'rgba(255, 244, 230, 0.62)',
    accent: '#ff477e',
    accentAlt: '#00c2a8',
    lineIdle: 'rgba(255, 244, 230, 0.14)',
    lineHover: 'rgba(255, 71, 126, 0.48)',
    dot: '#ffd166',
    dotCore: '#fff8e0',
    boardBg: 'rgba(18, 11, 32, 0.6)',
    players: [
      { line: '#ff477e', fill: '#5f1132', fillAlt: '#851b48', glow: '#ff86ab', onFill: '#fff0f5' },
      { line: '#00c2a8', fill: '#0b4a41', fillAlt: '#11695c', glow: '#4fe6cf', onFill: '#e8fffb' },
      { line: '#ffd166', fill: '#5f4310', fillAlt: '#846017', glow: '#ffe49b', onFill: '#fffaea' },
      { line: '#5b8cff', fill: '#1d2c63', fillAlt: '#2b408c', glow: '#93b1ff', onFill: '#eff3ff' },
    ],
  },
  typography: {
    display: '"Cooper Black", "Rockwell", "Bookman Old Style", Georgia, serif',
    body: '"Segoe UI", "Helvetica Neue", system-ui, sans-serif',
    numeric: '"Segoe UI", ui-monospace, monospace',
    displayWeight: 700,
    displayTracking: '0.01em',
    scale: 1,
  },
  shape: {
    radius: 20,
    dotRadius: 0.08,
    lineWidth: 0.12,
    lineCap: 'round',
    boxInset: 0.03,
    boxRadius: 0.07,
    glass: true,
  },
  motion: {
    ease: [0.34, 1.5, 0.64, 1],
    speed: 0.85,
    boxReveal: 'stamp',
    lineDraw: 'pour',
  },
  particles: {
    kind: 'confetti',
    colors: ['#ff477e', '#00c2a8', '#ffd166', '#5b8cff'],
    density: 6,
    speed: 0.5,
    size: [3, 7],
    drift: 1.6,
  },
  defaultWeather: 'none',
  victory: { kind: 'papel', colors: ['#ff477e', '#00c2a8', '#ffd166', '#5b8cff'] },
  audio: {
    scale: [0, 200, 400, 500, 700, 900, 1100],
    root: 262, // C4
    tempo: 96,
    lead: 'pluck',
    pad: 'pad',
    percussion: 'marimba',
    reverb: 0.24,
    place: 'ceramic',
    capture: 'marimba',
    ambience: 'city',
    ambienceLevel: 0.07,
  },
  boxMotif: Talavera,
  pageBackdrop: PapelBackdrop,
  suggestedLocales: ['es'],
}

export default mexicanTheme
