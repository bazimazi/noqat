/**
 * Chinese — 中式
 *
 * Ink-and-silk hand scroll: mineral jade greens, cinnabar red lacquer and gold
 * leaf. Boxes fill with ruyi cloud scrolls, the auspicious curl that edges
 * imperial robes and porcelain. Music is guzheng over an erhu-like bowed pad in
 * the gong pentatonic mode.
 */
import { ScrollBackdrop } from '../backdrops.tsx'
import { RuyiCloud } from '../motifs.tsx'
import type { ThemePack } from '../types.ts'

export const chineseTheme: ThemePack = {
  id: 'chinese',
  name: 'Chinese',
  nativeName: '中式',
  blurb: 'Scroll painting, jade and red lacquer.',
  inspiration: ['Song dynasty scrolls', 'Jade carving', 'Red lacquer', 'Ruyi clouds'],
  mode: 'dark',
  colors: {
    bg: '#171310',
    bgAlt: '#241c16',
    surface: 'rgba(38, 29, 23, 0.76)',
    surfaceAlt: 'rgba(56, 42, 33, 0.9)',
    border: 'rgba(201, 162, 90, 0.3)',
    text: '#f3e9d8',
    textMuted: 'rgba(243, 233, 216, 0.6)',
    accent: '#c8452f',
    accentAlt: '#5fa08a',
    lineIdle: 'rgba(243, 233, 216, 0.13)',
    lineHover: 'rgba(200, 69, 47, 0.5)',
    dot: '#d9b978',
    dotCore: '#fff3d6',
    boardBg: 'rgba(20, 15, 12, 0.6)',
    players: [
      { line: '#c8452f', fill: '#5c1d16', fillAlt: '#7c2a1f', glow: '#f0705a', onFill: '#ffeee9' },
      { line: '#5fa08a', fill: '#1c3b34', fillAlt: '#2a5347', glow: '#8fd0b8', onFill: '#eafaf4' },
      { line: '#d9b978', fill: '#4a3a17', fillAlt: '#665025', glow: '#f5dfa6', onFill: '#fff8e6' },
      { line: '#7f8fbd', fill: '#252f4c', fillAlt: '#36436a', glow: '#adbcea', onFill: '#eef2ff' },
    ],
  },
  typography: {
    display: '"Songti SC", "STSong", "Noto Serif SC", Georgia, serif',
    body: '"PingFang SC", "Microsoft YaHei", "Noto Sans SC", system-ui, sans-serif',
    numeric: '"PingFang SC", ui-monospace, monospace',
    displayWeight: 600,
    displayTracking: '0.05em',
    scale: 1,
  },
  shape: {
    radius: 8,
    dotRadius: 0.07,
    lineWidth: 0.1,
    lineCap: 'round',
    boxInset: 0.05,
    boxRadius: 0.04,
    glass: true,
  },
  motion: {
    ease: [0.16, 1, 0.3, 1],
    speed: 1.1,
    boxReveal: 'unfurl',
    lineDraw: 'brush',
  },
  particles: {
    kind: 'embers',
    colors: ['#d9b978', '#c8452f', '#ffd79a'],
    density: 4,
    speed: 0.24,
    size: [1.4, 3.4],
    drift: -1.5,
  },
  defaultWeather: 'none',
  victory: { kind: 'lanterns', colors: ['#c8452f', '#d9b978', '#5fa08a'] },
  audio: {
    // Gong mode — the standard Chinese pentatonic.
    scale: [0, 200, 400, 700, 900],
    root: 262, // C4
    tempo: 66,
    lead: 'pluck',
    pad: 'bow',
    percussion: 'bell',
    reverb: 0.36,
    place: 'pluck',
    capture: 'bell',
    ambience: 'air',
    ambienceLevel: 0.07,
  },
  boxMotif: RuyiCloud,
  pageBackdrop: ScrollBackdrop,
  suggestedLocales: ['zh'],
}

export default chineseTheme
