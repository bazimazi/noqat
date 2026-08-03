/**
 * Nordic — Norrøn
 *
 * A winter night: deep blue-black snow-light, aurora overhead, and boxes
 * carved as bind-runes into stave-church wood. Cold palette, warm wood accents,
 * slow motion. Music is a minor pentatonic drone with bowed overtones.
 */
import { AuroraBackdrop } from '../backdrops.tsx'
import { Runestone } from '../motifs.tsx'
import type { ThemePack } from '../types.ts'

export const nordicTheme: ThemePack = {
  id: 'nordic',
  name: 'Nordic',
  nativeName: 'Norrøn',
  blurb: 'Runes, snow-light and the aurora.',
  inspiration: ['Runestones', 'Stave church carving', 'Aurora borealis', 'Sámi textiles'],
  mode: 'dark',
  colors: {
    bg: '#0a1220',
    bgAlt: '#111e33',
    surface: 'rgba(18, 32, 52, 0.76)',
    surfaceAlt: 'rgba(28, 46, 72, 0.9)',
    border: 'rgba(140, 197, 214, 0.24)',
    text: '#e8f1f7',
    textMuted: 'rgba(232, 241, 247, 0.6)',
    accent: '#5fd2a8',
    accentAlt: '#7aa7e8',
    lineIdle: 'rgba(232, 241, 247, 0.13)',
    lineHover: 'rgba(95, 210, 168, 0.45)',
    dot: '#bcd4e2',
    dotCore: '#ffffff',
    boardBg: 'rgba(8, 16, 28, 0.6)',
    players: [
      { line: '#5fd2a8', fill: '#123c33', fillAlt: '#1b5749', glow: '#8ff0cd', onFill: '#eafff8' },
      { line: '#c98b4b', fill: '#4a2f14', fillAlt: '#67421d', glow: '#e8b477', onFill: '#fff4e6' },
      { line: '#7aa7e8', fill: '#1c3057', fillAlt: '#294478', glow: '#a8c8ff', onFill: '#eef4ff' },
      { line: '#c78ad6', fill: '#3d2044', fillAlt: '#552e5e', glow: '#d99ae8', onFill: '#fbeeff' },
    ],
  },
  typography: {
    display: '"Iowan Old Style", "Palatino Linotype", "Noto Serif", Georgia, serif',
    body: '"Segoe UI", "Helvetica Neue", system-ui, sans-serif',
    numeric: '"Segoe UI", ui-monospace, monospace',
    displayWeight: 600,
    displayTracking: '0.08em',
    scale: 1,
  },
  shape: {
    radius: 8,
    dotRadius: 0.065,
    lineWidth: 0.1,
    lineCap: 'square',
    boxInset: 0.03,
    boxRadius: 0.02,
    glass: true,
  },
  motion: {
    ease: [0.2, 0.9, 0.3, 1],
    speed: 1.2,
    boxReveal: 'stamp',
    lineDraw: 'sweep',
  },
  particles: {
    kind: 'snow',
    colors: ['#ffffff', '#cfe4f2', '#9fd8c4'],
    density: 8,
    speed: 0.4,
    size: [1.4, 3.6],
    drift: 1.7,
  },
  defaultWeather: 'aurora',
  victory: { kind: 'runes', colors: ['#5fd2a8', '#7aa7e8', '#ffffff'] },
  audio: {
    scale: [0, 300, 500, 700, 1000],
    root: 174, // F3
    tempo: 52,
    lead: 'bow',
    pad: 'pad',
    percussion: null,
    reverb: 0.48,
    place: 'pluck',
    capture: 'bell',
    ambience: 'wind',
    ambienceLevel: 0.13,
  },
  boxMotif: Runestone,
  pageBackdrop: AuroraBackdrop,
  suggestedLocales: [],
}

export default nordicTheme
