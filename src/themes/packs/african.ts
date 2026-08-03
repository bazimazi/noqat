/**
 * African — Woven
 *
 * Deliberately *specific* rather than pan-continental: the visual language here
 * is West African strip-weaving — Asante kente cloth and Malian bogolanfini
 * (mud cloth) — which share a strict geometric grid that happens to suit a
 * board of squares. Warm indigo-black ground, ochre and kola-nut reds,
 * hand-stamped diamonds. No masks, no wildlife, no invented "tribal" glyphs.
 */
import { MudclothBackdrop } from '../backdrops.tsx'
import { KenteWeave } from '../motifs.tsx'
import type { ThemePack } from '../types.ts'

export const africanTheme: ThemePack = {
  id: 'african',
  name: 'Woven',
  nativeName: 'Kente',
  blurb: 'Kente strip-weaving and bogolanfini geometry.',
  inspiration: ['Asante kente', 'Malian bogolanfini', 'Yoruba adire indigo', 'Ndebele wall painting'],
  mode: 'dark',
  colors: {
    bg: '#1b1410',
    bgAlt: '#2a1f18',
    surface: 'rgba(45, 33, 25, 0.78)',
    surfaceAlt: 'rgba(64, 47, 35, 0.9)',
    border: 'rgba(230, 168, 60, 0.28)',
    text: '#f7ecd9',
    textMuted: 'rgba(247, 236, 217, 0.6)',
    accent: '#e6a83c',
    accentAlt: '#2f7d6a',
    lineIdle: 'rgba(247, 236, 217, 0.14)',
    lineHover: 'rgba(230, 168, 60, 0.48)',
    dot: '#e8c88a',
    dotCore: '#fff6e4',
    boardBg: 'rgba(22, 16, 12, 0.62)',
    players: [
      { line: '#e6a83c', fill: '#553a10', fillAlt: '#775118', glow: '#f6cb77', onFill: '#fff8e8' },
      { line: '#2f7d6a', fill: '#12362e', fillAlt: '#1c5044', glow: '#63b8a1', onFill: '#e9fbf6' },
      { line: '#c04a2f', fill: '#4d1b11', fillAlt: '#6d2919', glow: '#e07b5f', onFill: '#fff0eb' },
      { line: '#5f6fb5', fill: '#232a52', fillAlt: '#333e78', glow: '#93a2e0', onFill: '#f0f2ff' },
    ],
  },
  typography: {
    display: '"Futura", "Century Gothic", "Trebuchet MS", system-ui, sans-serif',
    body: '"Segoe UI", "Helvetica Neue", system-ui, sans-serif',
    numeric: '"Segoe UI", ui-monospace, monospace',
    displayWeight: 700,
    displayTracking: '0.08em',
    scale: 1,
  },
  shape: {
    radius: 4,
    dotRadius: 0.07,
    lineWidth: 0.115,
    lineCap: 'butt',
    boxInset: 0.015,
    boxRadius: 0,
    glass: false,
  },
  motion: {
    ease: [0.3, 0.9, 0.35, 1],
    speed: 0.95,
    boxReveal: 'unfurl',
    lineDraw: 'sweep',
  },
  particles: {
    kind: 'dust',
    colors: ['#e6a83c', '#c04a2f', '#f7ecd9'],
    density: 5,
    speed: 0.2,
    size: [1.2, 3],
    drift: -1.3,
  },
  defaultWeather: 'none',
  victory: { kind: 'confetti', colors: ['#e6a83c', '#2f7d6a', '#c04a2f', '#f7ecd9'] },
  audio: {
    // Anhemitonic pentatonic, the backbone of West African kora and balafon.
    scale: [0, 200, 400, 700, 900],
    root: 196, // G3
    tempo: 104,
    lead: 'marimba',
    pad: 'pluck',
    percussion: 'ceramic',
    reverb: 0.22,
    place: 'marimba',
    capture: 'marimba',
    ambience: 'room',
    ambienceLevel: 0.08,
  },
  boxMotif: KenteWeave,
  pageBackdrop: MudclothBackdrop,
  suggestedLocales: [],
}

export default africanTheme
