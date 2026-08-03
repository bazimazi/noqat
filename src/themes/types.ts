/**
 * The theme contract.
 *
 * A theme is a *plugin*: it declares colour, type, motif, motion, particle and
 * audio data, and the game reads that declaration. No theme may import game
 * logic, and no game logic may branch on a theme id — which is what makes
 * community themes and a theme marketplace possible later without touching the
 * engine.
 */
import type { ReactNode } from 'react'

export type ThemeId =
  | 'persian'
  | 'japanese'
  | 'chinese'
  | 'indian'
  | 'arabic'
  | 'turkish'
  | 'greek'
  | 'nordic'
  | 'mexican'
  | 'african'
  | 'european'
  | 'neon'
  | 'minimal'

export type ColorMode = 'light' | 'dark'

export interface PlayerPalette {
  /** Stroke colour of this player's lines. */
  readonly line: string
  /** Base fill of boxes this player captured. */
  readonly fill: string
  /** Secondary fill used by the motif. */
  readonly fillAlt: string
  /** Glow / particle colour. */
  readonly glow: string
  /** Readable text colour on top of `fill`. */
  readonly onFill: string
}

export interface ThemeColors {
  readonly bg: string
  readonly bgAlt: string
  readonly surface: string
  readonly surfaceAlt: string
  readonly border: string
  readonly text: string
  readonly textMuted: string
  readonly accent: string
  readonly accentAlt: string
  /** Undrawn edge hit-target hint. */
  readonly lineIdle: string
  readonly lineHover: string
  readonly dot: string
  readonly dotCore: string
  readonly boardBg: string
  readonly players: readonly [PlayerPalette, PlayerPalette, PlayerPalette, PlayerPalette]
}

export interface ThemeTypography {
  /** CSS font stack for headings and the logo. */
  readonly display: string
  /** CSS font stack for body copy. */
  readonly body: string
  /** CSS font stack for scores and clocks. */
  readonly numeric: string
  readonly displayWeight: number
  readonly displayTracking: string
  /** Multiplier applied to the base type scale — some scripts need more room. */
  readonly scale: number
}

export interface ThemeShape {
  /** Corner radius for panels, in px. */
  readonly radius: number
  /** Dot radius as a fraction of the cell pitch. */
  readonly dotRadius: number
  /** Line thickness as a fraction of the cell pitch. */
  readonly lineWidth: number
  readonly lineCap: 'butt' | 'round' | 'square'
  /** Inset of a captured box's motif, as a fraction of the pitch. */
  readonly boxInset: number
  /** Corner radius of a captured box, as a fraction of the pitch. */
  readonly boxRadius: number
  /** Whether panels use a frosted-glass treatment. */
  readonly glass: boolean
}

export interface ThemeMotion {
  /** CSS easing used for most UI transitions. */
  readonly ease: [number, number, number, number]
  /** Duration multiplier — Zen themes are slower, neon themes snappier. */
  readonly speed: number
  /** How a captured box appears. */
  readonly boxReveal: 'bloom' | 'ink' | 'unfurl' | 'stamp' | 'shatter' | 'fade'
  /** How a line is drawn in. */
  readonly lineDraw: 'sweep' | 'brush' | 'pour' | 'zap'
}

export type ParticleKind =
  | 'dust'
  | 'sakura'
  | 'embers'
  | 'petals'
  | 'sand'
  | 'snow'
  | 'confetti'
  | 'fireflies'
  | 'sparks'
  | 'bubbles'
  | 'leaves'
  | 'none'

export interface ThemeParticles {
  readonly kind: ParticleKind
  readonly colors: readonly string[]
  /** Particles per 100 000 px² of viewport. */
  readonly density: number
  readonly speed: number
  readonly size: [number, number]
  /** Drift direction in radians (0 = right, PI/2 = down). */
  readonly drift: number
}

export type WeatherKind =
  | 'none'
  | 'rain'
  | 'snow'
  | 'wind'
  | 'autumn'
  | 'fireflies'
  | 'aurora'
  | 'stars'

export interface ThemeVictory {
  readonly kind: 'tiles' | 'petals' | 'lanterns' | 'rangoli' | 'stars' | 'runes' | 'papel' | 'confetti' | 'glow'
  readonly colors: readonly string[]
}

/** Instrument models implemented by the procedural audio engine. */
export type InstrumentId =
  | 'pluck' // Karplus–Strong: santoor, koto, guzheng, sitar, oud, qanun
  | 'bow' // filtered saw: erhu, kamancheh, strings
  | 'flute' // breath noise + sine: ney, shakuhachi
  | 'bell' // FM: temple bells, chimes
  | 'marimba' // fast-decay sine stack
  | 'pad' // slow detuned stack
  | 'synth' // saw/square with resonant filter
  | 'ceramic' // resonant noise burst: tile clicks

export interface ThemeAudio {
  /** Scale degrees as cents above the root — quarter tones are supported. */
  readonly scale: readonly number[]
  /** Root frequency in Hz. */
  readonly root: number
  readonly tempo: number
  readonly lead: InstrumentId
  readonly pad: InstrumentId
  readonly percussion: InstrumentId | null
  /** 0..1 wet mix of the algorithmic reverb. */
  readonly reverb: number
  /** Timbre of the "line drawn" click. */
  readonly place: InstrumentId
  /** Timbre of the "box captured" flourish. */
  readonly capture: InstrumentId
  /** Ambient bed: filtered noise character, 0 disables it. */
  readonly ambience: 'none' | 'air' | 'water' | 'wind' | 'room' | 'city'
  readonly ambienceLevel: number
}

export interface MotifProps {
  /** 0..1 progress used for reveal animations. */
  readonly player: number
  readonly palette: PlayerPalette
  /** Deterministic per-box variation seed. */
  readonly seed: number
  /** Side length of the box in user units. */
  readonly size: number
}

export interface BackdropProps {
  readonly seed: number
  readonly colors: ThemeColors
}

export interface ThemePack {
  readonly id: ThemeId
  /** English name. */
  readonly name: string
  /** Name in the culture's own script, shown alongside. */
  readonly nativeName: string
  /** One-line description for the theme gallery. */
  readonly blurb: string
  /** Where the visual language comes from — shown as a credit in the gallery. */
  readonly inspiration: readonly string[]
  readonly mode: ColorMode
  readonly colors: ThemeColors
  readonly typography: ThemeTypography
  readonly shape: ThemeShape
  readonly motion: ThemeMotion
  readonly particles: ThemeParticles
  readonly defaultWeather: WeatherKind
  readonly victory: ThemeVictory
  readonly audio: ThemeAudio
  /** Extra SVG `<defs>` injected once per board (gradients, patterns, filters). */
  readonly defs?: () => ReactNode
  /** The motif drawn inside a captured box. Receives a 0..size coordinate box. */
  readonly boxMotif: (props: MotifProps) => ReactNode
  /** Decoration drawn behind the board grid. */
  readonly boardBackdrop?: (props: BackdropProps) => ReactNode
  /** Full-page backdrop, rendered behind everything. */
  readonly pageBackdrop?: (props: BackdropProps) => ReactNode
  /** Locales this theme pairs with by default. */
  readonly suggestedLocales?: readonly string[]
}
