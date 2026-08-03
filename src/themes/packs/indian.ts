/**
 * Indian — भारतीय
 *
 * Rangoli colour on Mughal structure: marigold, indigo, rose-madder and
 * peacock, held together by a jaali lattice. Captured boxes bloom into
 * mandala rosettes. Music is a sitar in Rāga Yaman (Lydian, with the sharp
 * fourth) over a tanpura drone and a light tabla pulse.
 */
import { SilkBackdrop } from '../backdrops.tsx'
import { Mandala } from '../motifs.tsx'
import type { ThemePack } from '../types.ts'

export const indianTheme: ThemePack = {
  id: 'indian',
  name: 'Indian',
  nativeName: 'भारतीय',
  blurb: 'Rangoli colour, mandalas and Mughal silk.',
  inspiration: ['Rangoli', 'Mandalas', 'Mughal miniature', 'Banarasi silk'],
  mode: 'dark',
  colors: {
    bg: '#1a0f2b',
    bgAlt: '#2a1642',
    surface: 'rgba(48, 26, 74, 0.74)',
    surfaceAlt: 'rgba(66, 36, 100, 0.88)',
    border: 'rgba(255, 179, 71, 0.3)',
    text: '#fdf3e3',
    textMuted: 'rgba(253, 243, 227, 0.62)',
    accent: '#ff9f1c',
    accentAlt: '#e8478b',
    lineIdle: 'rgba(253, 243, 227, 0.14)',
    lineHover: 'rgba(255, 159, 28, 0.5)',
    dot: '#ffd166',
    dotCore: '#fff6dd',
    boardBg: 'rgba(21, 11, 36, 0.6)',
    players: [
      { line: '#ff9f1c', fill: '#6b3606', fillAlt: '#8f4c0c', glow: '#ffc766', onFill: '#fff6e8' },
      { line: '#e8478b', fill: '#5e1338', fillAlt: '#83204f', glow: '#ff87b8', onFill: '#fff0f6' },
      { line: '#21b0a5', fill: '#0d4a45', fillAlt: '#146862', glow: '#5fe0d4', onFill: '#e8fffb' },
      { line: '#9d7bff', fill: '#33206b', fillAlt: '#472f90', glow: '#c1aaff', onFill: '#f4efff' },
    ],
  },
  typography: {
    display: '"Noto Serif Devanagari", "Kohinoor Devanagari", "Nirmala UI", Georgia, serif',
    body: '"Noto Sans Devanagari", "Nirmala UI", system-ui, sans-serif',
    numeric: '"Noto Sans Devanagari", ui-monospace, monospace',
    displayWeight: 600,
    displayTracking: '0.01em',
    scale: 1.02,
  },
  shape: {
    radius: 22,
    dotRadius: 0.08,
    lineWidth: 0.115,
    lineCap: 'round',
    boxInset: 0.03,
    boxRadius: 0.08,
    glass: true,
  },
  motion: {
    ease: [0.34, 1.36, 0.64, 1],
    speed: 0.92,
    boxReveal: 'bloom',
    lineDraw: 'pour',
  },
  particles: {
    kind: 'petals',
    colors: ['#ff9f1c', '#e8478b', '#ffd166', '#21b0a5'],
    density: 6,
    speed: 0.34,
    size: [3, 7],
    drift: 1.75,
  },
  defaultWeather: 'none',
  victory: { kind: 'rangoli', colors: ['#ff9f1c', '#e8478b', '#21b0a5', '#ffd166'] },
  audio: {
    // Rāga Yaman — Lydian, the evening raga.
    scale: [0, 200, 400, 600, 700, 900, 1100],
    root: 233, // B♭3
    tempo: 72,
    lead: 'pluck',
    pad: 'bow',
    percussion: 'marimba',
    reverb: 0.3,
    place: 'pluck',
    capture: 'marimba',
    ambience: 'room',
    ambienceLevel: 0.09,
  },
  boxMotif: Mandala,
  pageBackdrop: SilkBackdrop,
  suggestedLocales: ['hi'],
}

export default indianTheme
