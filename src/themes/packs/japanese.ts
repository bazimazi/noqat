/**
 * Japanese — 和
 *
 * Washi paper, sumi ink and shoji wood. The board reads as a light room rather
 * than a screen: warm off-white ground, hairline joinery, and captured boxes
 * that bloom as a single brushstroke or a sakura blossom. Music is a koto in
 * the *in* scale (hirajoshi) with a shakuhachi drone; petals fall by default.
 */
import { WashiBackdrop } from '../backdrops.tsx'
import { Sakura } from '../motifs.tsx'
import type { ThemePack } from '../types.ts'

export const japaneseTheme: ThemePack = {
  id: 'japanese',
  name: 'Japanese',
  nativeName: '和',
  blurb: 'Washi paper, ink brush and falling sakura.',
  inspiration: ['Washi paper', 'Sumi-e', 'Shoji screens', 'Zen gardens'],
  mode: 'light',
  colors: {
    bg: '#f5f1e8',
    bgAlt: '#ece5d8',
    surface: 'rgba(255, 253, 248, 0.78)',
    surfaceAlt: 'rgba(240, 234, 222, 0.92)',
    border: 'rgba(58, 50, 44, 0.14)',
    text: '#2b2622',
    textMuted: 'rgba(43, 38, 34, 0.56)',
    accent: '#b04a4a',
    accentAlt: '#7d8c6a',
    lineIdle: 'rgba(43, 38, 34, 0.12)',
    lineHover: 'rgba(176, 74, 74, 0.42)',
    dot: '#3a322c',
    dotCore: '#5b514a',
    boardBg: 'rgba(255, 254, 250, 0.55)',
    players: [
      { line: '#2b2622', fill: '#ded6c6', fillAlt: '#c8bda9', glow: '#4a423a', onFill: '#231e1a' },
      { line: '#b04a4a', fill: '#f2ddd9', fillAlt: '#e5c3bd', glow: '#d4756f', onFill: '#3a1f1d' },
      { line: '#5b7f6f', fill: '#dbe6de', fillAlt: '#bed0c4', glow: '#7fae98', onFill: '#20302a' },
      { line: '#8a6d3b', fill: '#eee2c8', fillAlt: '#dbc9a4', glow: '#c1a066', onFill: '#33280f' },
    ],
  },
  typography: {
    display: '"Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", Georgia, serif',
    body: '"Hiragino Sans", "Yu Gothic", "Noto Sans JP", system-ui, sans-serif',
    numeric: '"Hiragino Sans", ui-monospace, monospace',
    displayWeight: 500,
    displayTracking: '0.06em',
    scale: 1,
  },
  shape: {
    radius: 4,
    dotRadius: 0.055,
    lineWidth: 0.085,
    lineCap: 'round',
    boxInset: 0.06,
    boxRadius: 0.02,
    glass: false,
  },
  motion: {
    ease: [0.33, 1, 0.68, 1],
    speed: 1.25,
    boxReveal: 'ink',
    lineDraw: 'brush',
  },
  particles: {
    kind: 'sakura',
    colors: ['#f3d7dc', '#e8b9c2', '#ffffff'],
    density: 4,
    speed: 0.42,
    size: [4, 9],
    drift: 1.9,
  },
  defaultWeather: 'wind',
  victory: { kind: 'petals', colors: ['#f3d7dc', '#e8b9c2', '#b04a4a', '#7d8c6a'] },
  audio: {
    // Hirajoshi — the classic koto tuning.
    scale: [0, 200, 300, 700, 800],
    root: 220, // A3
    tempo: 48,
    lead: 'pluck',
    pad: 'flute',
    percussion: null,
    reverb: 0.42,
    place: 'pluck',
    capture: 'bell',
    ambience: 'air',
    ambienceLevel: 0.08,
  },
  boxMotif: Sakura,
  pageBackdrop: WashiBackdrop,
  suggestedLocales: ['ja'],
}

export default japaneseTheme
