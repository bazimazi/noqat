/**
 * The motif kit.
 *
 * Every theme fills a captured box with a small piece of its own visual
 * language rather than a flat colour. These are the primitives that make that
 * possible: parameterised SVG built from real geometry (girih stars, ruyi
 * clouds, Greek meanders, Talavera rosettes) rather than tinted rectangles.
 *
 * Each motif is drawn in a `0 0 size size` box, uses only the player's palette,
 * and varies subtly with `seed` so a finished board reads as handcrafted tiling
 * instead of a stamp repeated forty times.
 */
import type { JSX } from 'react'
import type { MotifProps } from './types.ts'

/* ------------------------------------------------------------------ *
 * geometry helpers
 * ------------------------------------------------------------------ */

function star(cx: number, cy: number, points: number, outer: number, inner: number, rotation = 0): string {
  const step = Math.PI / points
  const parts: string[] = []
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner
    const a = rotation + i * step - Math.PI / 2
    parts.push(`${i === 0 ? 'M' : 'L'}${(cx + Math.cos(a) * r).toFixed(2)} ${(cy + Math.sin(a) * r).toFixed(2)}`)
  }
  return `${parts.join(' ')}Z`
}

function polygon(cx: number, cy: number, sides: number, r: number, rotation = 0): string {
  const parts: string[] = []
  for (let i = 0; i < sides; i++) {
    const a = rotation + (i * 2 * Math.PI) / sides - Math.PI / 2
    parts.push(`${i === 0 ? 'M' : 'L'}${(cx + Math.cos(a) * r).toFixed(2)} ${(cy + Math.sin(a) * r).toFixed(2)}`)
  }
  return `${parts.join(' ')}Z`
}

/** Deterministic 0..1 from an integer seed and a channel index. */
function jitter(seed: number, channel: number): number {
  const x = Math.sin(seed * 127.1 + channel * 311.7) * 43758.5453
  return x - Math.floor(x)
}

/* ------------------------------------------------------------------ *
 * motifs
 * ------------------------------------------------------------------ */

/**
 * Persian *khatam* — the eight-point star at the heart of Isfahan tilework,
 * built from two interlocking squares around a central rosette.
 */
export function KhatamStar({ palette, seed, size }: MotifProps): JSX.Element {
  const c = size / 2
  const spin = jitter(seed, 1) * 0.2
  return (
    <g>
      <rect x={0} y={0} width={size} height={size} fill={palette.fill} />
      <path d={polygon(c, c, 4, size * 0.46, Math.PI / 4 + spin)} fill={palette.fillAlt} opacity={0.55} />
      <path d={polygon(c, c, 4, size * 0.46, spin)} fill={palette.fillAlt} opacity={0.55} />
      <path d={star(c, c, 8, size * 0.36, size * 0.155, spin)} fill={palette.glow} opacity={0.92} />
      <path
        d={star(c, c, 8, size * 0.36, size * 0.155, spin)}
        fill="none"
        stroke={palette.line}
        strokeWidth={size * 0.022}
        strokeLinejoin="round"
        opacity={0.7}
      />
      <circle cx={c} cy={c} r={size * 0.085} fill={palette.line} opacity={0.85} />
      <circle cx={c} cy={c} r={size * 0.035} fill={palette.onFill} opacity={0.9} />
    </g>
  )
}

/**
 * Islamic *arabesque* — interlacing vines inside a twelve-fold frame, with the
 * strapwork left open so the tile breathes.
 */
export function Arabesque({ palette, seed, size }: MotifProps): JSX.Element {
  const c = size / 2
  const r = size * 0.4
  const spin = jitter(seed, 3) * 0.4
  const petals = [0, 1, 2, 3, 4, 5].map((i) => {
    const a = spin + (i * Math.PI) / 3
    const x = c + Math.cos(a) * r * 0.62
    const y = c + Math.sin(a) * r * 0.62
    return (
      <ellipse
        key={i}
        cx={x}
        cy={y}
        rx={r * 0.34}
        ry={r * 0.15}
        transform={`rotate(${(a * 180) / Math.PI} ${x} ${y})`}
        fill={palette.glow}
        opacity={0.75}
      />
    )
  })
  return (
    <g>
      <rect x={0} y={0} width={size} height={size} fill={palette.fill} />
      <path d={polygon(c, c, 12, r, spin)} fill={palette.fillAlt} opacity={0.5} />
      <path
        d={polygon(c, c, 12, r, spin)}
        fill="none"
        stroke={palette.line}
        strokeWidth={size * 0.02}
        opacity={0.55}
      />
      {petals}
      <circle cx={c} cy={c} r={size * 0.1} fill={palette.line} opacity={0.8} />
    </g>
  )
}

/**
 * Iznik carnation — the Ottoman tulip-and-carnation silhouette that fills
 * sixteenth-century Turkish tile panels.
 */
export function IznikTulip({ palette, seed, size }: MotifProps): JSX.Element {
  const c = size / 2
  const lean = (jitter(seed, 5) - 0.5) * 6
  return (
    <g>
      <rect x={0} y={0} width={size} height={size} fill={palette.fill} />
      <circle cx={c} cy={c} r={size * 0.42} fill={palette.fillAlt} opacity={0.45} />
      <g transform={`rotate(${lean} ${c} ${c})`}>
        <path
          d={`M${c} ${size * 0.82}
              C${c - size * 0.05} ${size * 0.6} ${c - size * 0.3} ${size * 0.56} ${c - size * 0.26} ${size * 0.34}
              C${c - size * 0.23} ${size * 0.18} ${c - size * 0.08} ${size * 0.14} ${c} ${size * 0.24}
              C${c + size * 0.08} ${size * 0.14} ${c + size * 0.23} ${size * 0.18} ${c + size * 0.26} ${size * 0.34}
              C${c + size * 0.3} ${size * 0.56} ${c + size * 0.05} ${size * 0.6} ${c} ${size * 0.82}Z`}
          fill={palette.glow}
          opacity={0.9}
        />
        <path
          d={`M${c} ${size * 0.78}L${c} ${size * 0.3}`}
          stroke={palette.line}
          strokeWidth={size * 0.026}
          strokeLinecap="round"
          opacity={0.7}
        />
        <ellipse cx={c - size * 0.17} cy={size * 0.62} rx={size * 0.1} ry={size * 0.045} fill={palette.line} opacity={0.5} transform={`rotate(-25 ${c - size * 0.17} ${size * 0.62})`} />
        <ellipse cx={c + size * 0.17} cy={size * 0.62} rx={size * 0.1} ry={size * 0.045} fill={palette.line} opacity={0.5} transform={`rotate(25 ${c + size * 0.17} ${size * 0.62})`} />
      </g>
    </g>
  )
}

/** Sakura blossom on washi — five soft petals with the classic notched tip. */
export function Sakura({ palette, seed, size }: MotifProps): JSX.Element {
  const c = size / 2
  const spin = jitter(seed, 7) * 72
  const petal = `M0 0 C ${size * 0.12} ${-size * 0.14} ${size * 0.13} ${-size * 0.3} 0 ${-size * 0.34}
                 C ${-size * 0.13} ${-size * 0.3} ${-size * 0.12} ${-size * 0.14} 0 0 Z`
  return (
    <g>
      <rect x={0} y={0} width={size} height={size} fill={palette.fill} />
      <g transform={`translate(${c} ${c}) rotate(${spin})`}>
        {[0, 1, 2, 3, 4].map((i) => (
          <path key={i} d={petal} transform={`rotate(${i * 72})`} fill={palette.glow} opacity={0.9} />
        ))}
        {[0, 1, 2, 3, 4].map((i) => (
          <path
            key={`s${i}`}
            d={`M0 0 L0 ${-size * 0.22}`}
            transform={`rotate(${i * 72 + 36})`}
            stroke={palette.line}
            strokeWidth={size * 0.014}
            opacity={0.5}
          />
        ))}
        <circle r={size * 0.055} fill={palette.line} opacity={0.85} />
      </g>
    </g>
  )
}

/** Ruyi cloud scroll from Chinese scroll painting, over a lacquer ground. */
export function RuyiCloud({ palette, seed, size }: MotifProps): JSX.Element {
  const s = size
  const flip = jitter(seed, 11) > 0.5 ? -1 : 1
  return (
    <g>
      <rect x={0} y={0} width={s} height={s} fill={palette.fill} />
      <g transform={flip < 0 ? `translate(${s} 0) scale(-1 1)` : undefined}>
        <path
          d={`M${s * 0.16} ${s * 0.62}
              a${s * 0.13} ${s * 0.13} 0 1 1 ${s * 0.2} ${-s * 0.09}
              a${s * 0.15} ${s * 0.15} 0 1 1 ${s * 0.27} ${s * 0.02}
              a${s * 0.11} ${s * 0.11} 0 1 1 ${s * 0.13} ${s * 0.16}
              L${s * 0.16} ${s * 0.78}Z`}
          fill={palette.glow}
          opacity={0.9}
        />
        <path
          d={`M${s * 0.2} ${s * 0.68} q${s * 0.18} ${-s * 0.12} ${s * 0.36} 0 q${s * 0.14} ${-s * 0.08} ${s * 0.24} ${s * 0.03}`}
          fill="none"
          stroke={palette.line}
          strokeWidth={s * 0.02}
          strokeLinecap="round"
          opacity={0.65}
        />
      </g>
      <circle cx={s * 0.74} cy={s * 0.26} r={s * 0.09} fill={palette.fillAlt} opacity={0.8} />
    </g>
  )
}

/** Rangoli / mandala rosette — concentric petal rings in Mughal proportions. */
export function Mandala({ palette, seed, size }: MotifProps): JSX.Element {
  const c = size / 2
  const spin = jitter(seed, 13) * 30
  return (
    <g>
      <rect x={0} y={0} width={size} height={size} fill={palette.fill} />
      <g transform={`translate(${c} ${c}) rotate(${spin})`}>
        <path d={star(0, 0, 12, size * 0.44, size * 0.3)} fill={palette.fillAlt} opacity={0.6} />
        <path d={star(0, 0, 8, size * 0.32, size * 0.13)} fill={palette.glow} opacity={0.92} />
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <circle
            key={i}
            cx={Math.cos((i * Math.PI) / 4) * size * 0.34}
            cy={Math.sin((i * Math.PI) / 4) * size * 0.34}
            r={size * 0.032}
            fill={palette.line}
            opacity={0.8}
          />
        ))}
        <circle r={size * 0.1} fill={palette.line} opacity={0.85} />
        <circle r={size * 0.045} fill={palette.onFill} opacity={0.9} />
      </g>
    </g>
  )
}

/** Greek meander (key pattern) corner, in marble and Aegean blue. */
export function Meander({ palette, seed, size }: MotifProps): JSX.Element {
  const s = size
  const u = s / 8
  const flip = jitter(seed, 17) > 0.5
  const path = `M${u} ${u * 7} L${u} ${u * 2} L${u * 6} ${u * 2} L${u * 6} ${u * 5}
                L${u * 3} ${u * 5} L${u * 3} ${u * 4} L${u * 5} ${u * 4}`
  return (
    <g>
      <rect x={0} y={0} width={s} height={s} fill={palette.fill} />
      <g transform={flip ? `translate(${s} 0) scale(-1 1)` : undefined}>
        <path
          d={path}
          fill="none"
          stroke={palette.glow}
          strokeWidth={u * 0.9}
          strokeLinecap="square"
          strokeLinejoin="miter"
        />
        <path
          d={path}
          fill="none"
          stroke={palette.line}
          strokeWidth={u * 0.22}
          strokeLinecap="square"
          opacity={0.6}
        />
      </g>
    </g>
  )
}

/** Norse knotwork: an angular bind-rune inside a carved border. */
export function Runestone({ palette, seed, size }: MotifProps): JSX.Element {
  const s = size
  const variant = Math.floor(jitter(seed, 19) * 4)
  const glyphs = [
    `M${s * 0.5} ${s * 0.2}L${s * 0.5} ${s * 0.8}M${s * 0.5} ${s * 0.34}L${s * 0.72} ${s * 0.22}M${s * 0.5} ${s * 0.56}L${s * 0.72} ${s * 0.44}`,
    `M${s * 0.32} ${s * 0.2}L${s * 0.32} ${s * 0.8}M${s * 0.32} ${s * 0.2}L${s * 0.68} ${s * 0.4}L${s * 0.32} ${s * 0.56}`,
    `M${s * 0.3} ${s * 0.8}L${s * 0.5} ${s * 0.2}L${s * 0.7} ${s * 0.8}M${s * 0.38} ${s * 0.56}L${s * 0.62} ${s * 0.56}`,
    `M${s * 0.3} ${s * 0.2}L${s * 0.7} ${s * 0.8}M${s * 0.7} ${s * 0.2}L${s * 0.3} ${s * 0.8}M${s * 0.5} ${s * 0.2}L${s * 0.5} ${s * 0.8}`,
  ]
  return (
    <g>
      <rect x={0} y={0} width={s} height={s} fill={palette.fill} />
      <rect
        x={s * 0.1}
        y={s * 0.1}
        width={s * 0.8}
        height={s * 0.8}
        fill={palette.fillAlt}
        opacity={0.5}
        stroke={palette.line}
        strokeWidth={s * 0.02}
      />
      <path
        d={glyphs[variant]}
        fill="none"
        stroke={palette.glow}
        strokeWidth={s * 0.07}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  )
}

/** Talavera rosette — Puebla ceramic, cobalt on tin glaze. */
export function Talavera({ palette, seed, size }: MotifProps): JSX.Element {
  const c = size / 2
  const spin = jitter(seed, 23) * 45
  return (
    <g>
      <rect x={0} y={0} width={size} height={size} fill={palette.fill} />
      <g transform={`translate(${c} ${c}) rotate(${spin})`}>
        {[0, 1, 2, 3].map((i) => (
          <ellipse
            key={i}
            cx={0}
            cy={-size * 0.26}
            rx={size * 0.13}
            ry={size * 0.2}
            transform={`rotate(${i * 90})`}
            fill={palette.glow}
            opacity={0.9}
          />
        ))}
        {[0, 1, 2, 3].map((i) => (
          <path
            key={`d${i}`}
            d={polygon(0, -size * 0.3, 4, size * 0.075, Math.PI / 4)}
            transform={`rotate(${i * 90 + 45})`}
            fill={palette.fillAlt}
            opacity={0.95}
          />
        ))}
        <circle r={size * 0.11} fill={palette.line} />
        <circle r={size * 0.05} fill={palette.onFill} opacity={0.95} />
      </g>
    </g>
  )
}

/** Kente-inspired weave: warp and weft bands with a central diamond. */
export function KenteWeave({ palette, seed, size }: MotifProps): JSX.Element {
  const s = size
  const offset = jitter(seed, 29)
  return (
    <g>
      <rect x={0} y={0} width={s} height={s} fill={palette.fill} />
      {[0.14, 0.5, 0.86].map((t, i) => (
        <rect key={`h${i}`} x={0} y={s * (t - 0.055)} width={s} height={s * 0.11} fill={palette.fillAlt} opacity={0.85} />
      ))}
      {[0.28, 0.72].map((t, i) => (
        <rect key={`v${i}`} x={s * (t - 0.045)} y={0} width={s * 0.09} height={s} fill={palette.glow} opacity={0.8} />
      ))}
      <path d={polygon(s / 2, s / 2, 4, s * 0.2, offset)} fill={palette.line} opacity={0.9} />
      <path d={polygon(s / 2, s / 2, 4, s * 0.09, offset)} fill={palette.onFill} opacity={0.85} />
    </g>
  )
}

/** Engraved guilloche rosette — banknotes, fountain pens, old chess clubs. */
export function Guilloche({ palette, seed, size }: MotifProps): JSX.Element {
  const c = size / 2
  const lobes = 7 + Math.floor(jitter(seed, 31) * 3)
  const points: string[] = []
  for (let i = 0; i <= 180; i++) {
    const t = (i / 180) * Math.PI * 2
    const r = size * (0.3 + 0.09 * Math.cos(lobes * t))
    points.push(`${(c + Math.cos(t) * r).toFixed(2)},${(c + Math.sin(t) * r).toFixed(2)}`)
  }
  return (
    <g>
      <rect x={0} y={0} width={size} height={size} fill={palette.fill} />
      <polygon points={points.join(' ')} fill={palette.fillAlt} opacity={0.7} />
      <polygon
        points={points.join(' ')}
        fill="none"
        stroke={palette.glow}
        strokeWidth={size * 0.018}
        opacity={0.95}
      />
      <circle cx={c} cy={c} r={size * 0.16} fill="none" stroke={palette.line} strokeWidth={size * 0.016} />
      <circle cx={c} cy={c} r={size * 0.05} fill={palette.line} />
    </g>
  )
}

/** Holographic cell: scanlines, corner brackets and a bloom core. */
export function NeonCell({ palette, seed, size }: MotifProps): JSX.Element {
  const s = size
  const lines = 4 + Math.floor(jitter(seed, 37) * 3)
  const bracket = s * 0.22
  return (
    <g>
      <rect x={0} y={0} width={s} height={s} fill={palette.fill} />
      {Array.from({ length: lines }, (_, i) => (
        <rect
          key={i}
          x={0}
          y={(s / lines) * i + s * 0.03}
          width={s}
          height={s * 0.035}
          fill={palette.glow}
          opacity={0.22 + 0.1 * (i % 2)}
        />
      ))}
      <path
        d={`M${s * 0.1} ${bracket}L${s * 0.1} ${s * 0.1}L${bracket} ${s * 0.1}
            M${s - bracket} ${s * 0.1}L${s * 0.9} ${s * 0.1}L${s * 0.9} ${bracket}
            M${s * 0.9} ${s - bracket}L${s * 0.9} ${s * 0.9}L${s - bracket} ${s * 0.9}
            M${bracket} ${s * 0.9}L${s * 0.1} ${s * 0.9}L${s * 0.1} ${s - bracket}`}
        fill="none"
        stroke={palette.line}
        strokeWidth={s * 0.03}
        strokeLinecap="round"
      />
      <circle cx={s / 2} cy={s / 2} r={s * 0.12} fill={palette.glow} opacity={0.95} />
      <circle cx={s / 2} cy={s / 2} r={s * 0.2} fill="none" stroke={palette.glow} strokeWidth={s * 0.012} opacity={0.5} />
    </g>
  )
}

/** Restrained solid tile with a hairline inner keyline. Apple HIG in spirit. */
export function MinimalTile({ palette, size }: MotifProps): JSX.Element {
  return (
    <g>
      <rect x={0} y={0} width={size} height={size} rx={size * 0.16} fill={palette.fill} />
      <rect
        x={size * 0.14}
        y={size * 0.14}
        width={size * 0.72}
        height={size * 0.72}
        rx={size * 0.1}
        fill={palette.glow}
        opacity={0.5}
      />
      <circle cx={size / 2} cy={size / 2} r={size * 0.08} fill={palette.line} opacity={0.9} />
    </g>
  )
}

/** Sumi-e ink wash square — a single deliberate brushstroke. */
export function InkWash({ palette, seed, size }: MotifProps): JSX.Element {
  const s = size
  const wobble = (jitter(seed, 41) - 0.5) * s * 0.08
  return (
    <g>
      <rect x={0} y={0} width={s} height={s} fill={palette.fill} />
      <path
        d={`M${s * 0.16} ${s * 0.3 + wobble}
            C${s * 0.34} ${s * 0.14} ${s * 0.7} ${s * 0.2} ${s * 0.84} ${s * 0.4}
            C${s * 0.92} ${s * 0.62} ${s * 0.66} ${s * 0.88} ${s * 0.42} ${s * 0.8}
            C${s * 0.24} ${s * 0.74} ${s * 0.1} ${s * 0.5} ${s * 0.16} ${s * 0.3 + wobble}Z`}
        fill={palette.glow}
        opacity={0.88}
      />
      <path
        d={`M${s * 0.3} ${s * 0.66} C${s * 0.44} ${s * 0.5} ${s * 0.58} ${s * 0.44} ${s * 0.74} ${s * 0.46}`}
        fill="none"
        stroke={palette.line}
        strokeWidth={s * 0.03}
        strokeLinecap="round"
        opacity={0.55}
      />
    </g>
  )
}

export const MOTIFS = {
  khatam: KhatamStar,
  arabesque: Arabesque,
  iznik: IznikTulip,
  sakura: Sakura,
  ruyi: RuyiCloud,
  mandala: Mandala,
  meander: Meander,
  rune: Runestone,
  talavera: Talavera,
  kente: KenteWeave,
  guilloche: Guilloche,
  neon: NeonCell,
  minimal: MinimalTile,
  ink: InkWash,
} as const

export type MotifId = keyof typeof MOTIFS
