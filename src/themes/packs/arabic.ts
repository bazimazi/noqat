/**
 * Arabic — عربي
 *
 * Islamic geometry rendered in brass and desert light, seen through a
 * mashrabiya screen. Captured boxes carry an arabesque: a twelve-fold frame
 * with interlacing vines. Music is an oud and qanun in maqām Ḥijāz, whose
 * augmented second between the second and third degrees is its signature.
 */
import { MashrabiyaBackdrop } from '../backdrops.tsx'
import { Arabesque } from '../motifs.tsx'
import type { ThemePack } from '../types.ts'

export const arabicTheme: ThemePack = {
  id: 'arabic',
  name: 'Arabic',
  nativeName: 'عربي',
  blurb: 'Islamic geometry, brass and desert light.',
  inspiration: ['Islamic geometry', 'Mashrabiya', 'Arabesque', 'Kufic calligraphy'],
  mode: 'dark',
  colors: {
    bg: '#12100c',
    bgAlt: '#1e1a12',
    surface: 'rgba(35, 30, 21, 0.76)',
    surfaceAlt: 'rgba(53, 45, 31, 0.9)',
    border: 'rgba(196, 158, 84, 0.32)',
    text: '#f4ecd8',
    textMuted: 'rgba(244, 236, 216, 0.6)',
    accent: '#c49e54',
    accentAlt: '#2f8f83',
    lineIdle: 'rgba(244, 236, 216, 0.13)',
    lineHover: 'rgba(196, 158, 84, 0.5)',
    dot: '#d8bb7c',
    dotCore: '#fff5dd',
    boardBg: 'rgba(14, 12, 9, 0.62)',
    players: [
      { line: '#c49e54', fill: '#4d3a15', fillAlt: '#6b5220', glow: '#e8c884', onFill: '#fff8e6' },
      { line: '#2f8f83', fill: '#123833', fillAlt: '#1b524a', glow: '#67c6b8', onFill: '#e9fbf7' },
      { line: '#b5563f', fill: '#4a1d13', fillAlt: '#66291b', glow: '#e08a70', onFill: '#fff0ea' },
      { line: '#7d7fb3', fill: '#2a2b47', fillAlt: '#3c3e64', glow: '#adafe0', onFill: '#f0f0ff' },
    ],
  },
  typography: {
    display: '"Noto Naskh Arabic", "Amiri", "Traditional Arabic", "Times New Roman", serif',
    body: '"Noto Sans Arabic", "Segoe UI", system-ui, sans-serif',
    numeric: '"Noto Sans Arabic", ui-monospace, monospace',
    displayWeight: 600,
    displayTracking: '0',
    scale: 1.04,
  },
  shape: {
    radius: 14,
    dotRadius: 0.075,
    lineWidth: 0.105,
    lineCap: 'round',
    boxInset: 0.04,
    boxRadius: 0.05,
    glass: true,
  },
  motion: {
    ease: [0.22, 1, 0.36, 1],
    speed: 1.05,
    boxReveal: 'bloom',
    lineDraw: 'sweep',
  },
  particles: {
    kind: 'sand',
    colors: ['#d8bb7c', '#c49e54', '#f4ecd8'],
    density: 7,
    speed: 0.3,
    size: [0.8, 2.2],
    drift: 0.15,
  },
  defaultWeather: 'stars',
  victory: { kind: 'stars', colors: ['#c49e54', '#2f8f83', '#f4ecd8'] },
  audio: {
    // Maqām Ḥijāz: 1, ♭2, 3, 4, 5, ♭6, 7.
    scale: [0, 100, 400, 500, 700, 800, 1100],
    root: 220, // A3
    tempo: 58,
    lead: 'pluck',
    pad: 'bow',
    percussion: 'ceramic',
    reverb: 0.38,
    place: 'pluck',
    capture: 'bell',
    ambience: 'wind',
    ambienceLevel: 0.1,
  },
  boxMotif: Arabesque,
  pageBackdrop: MashrabiyaBackdrop,
  suggestedLocales: ['ar'],
}

export default arabicTheme
