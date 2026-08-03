/**
 * Page backdrops.
 *
 * Each theme owns the whole screen, not just the board. These are procedural
 * SVG scenes — gradients, repeating `<pattern>` tiles and a few soft blurred
 * shapes — so they cost nothing to download, scale to any viewport, and can be
 * tinted entirely from the theme palette.
 *
 * They are rendered once behind everything, marked `aria-hidden`, and never
 * animate above 0.06 opacity so they cannot compete with the board.
 */
import type { JSX } from 'react'
import type { BackdropProps } from './types.ts'

const FULL = { position: 'absolute', inset: 0, width: '100%', height: '100%' } as const

function Frame({ children, id }: { children: React.ReactNode; id: string }): JSX.Element {
  return (
    <svg
      style={FULL}
      viewBox="0 0 1200 800"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
      data-backdrop={id}
    >
      {children}
    </svg>
  )
}

/** Isfahan tilework: a seven-fold girih lattice under a dome-light wash. */
export function TileworkBackdrop({ colors }: BackdropProps): JSX.Element {
  return (
    <Frame id="tilework">
      <defs>
        <radialGradient id="nq-tile-glow" cx="50%" cy="18%" r="80%">
          <stop offset="0%" stopColor={colors.accent} stopOpacity="0.22" />
          <stop offset="60%" stopColor={colors.bgAlt} stopOpacity="0" />
        </radialGradient>
        <pattern id="nq-girih" width="80" height="80" patternUnits="userSpaceOnUse" patternTransform="rotate(0)">
          <path
            d="M40 4 L52 28 L76 40 L52 52 L40 76 L28 52 L4 40 L28 28 Z"
            fill="none"
            stroke={colors.accent}
            strokeWidth="1.1"
            opacity="0.35"
          />
          <circle cx="40" cy="40" r="6" fill={colors.accentAlt} opacity="0.28" />
          <path d="M0 40 L80 40 M40 0 L40 80" stroke={colors.accentAlt} strokeWidth="0.5" opacity="0.15" />
        </pattern>
      </defs>
      <rect width="1200" height="800" fill={colors.bg} />
      <rect width="1200" height="800" fill="url(#nq-girih)" opacity="0.5" />
      <rect width="1200" height="800" fill="url(#nq-tile-glow)" />
    </Frame>
  )
}

/** Washi paper: fibrous texture, a low horizon and one distant ink mountain. */
export function WashiBackdrop({ colors }: BackdropProps): JSX.Element {
  return (
    <Frame id="washi">
      <defs>
        <linearGradient id="nq-washi-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={colors.bgAlt} />
          <stop offset="100%" stopColor={colors.bg} />
        </linearGradient>
        <filter id="nq-washi-fibre">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed="7" />
          <feColorMatrix type="saturate" values="0" />
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.05" />
          </feComponentTransfer>
        </filter>
      </defs>
      <rect width="1200" height="800" fill="url(#nq-washi-sky)" />
      <path
        d="M0 640 C220 560 320 610 480 556 C640 502 760 574 940 528 C1060 498 1140 520 1200 506 L1200 800 L0 800 Z"
        fill={colors.accent}
        opacity="0.07"
      />
      <circle cx="960" cy="180" r="86" fill={colors.accentAlt} opacity="0.12" />
      <rect width="1200" height="800" filter="url(#nq-washi-fibre)" />
    </Frame>
  )
}

/** Hand-scroll silk: rolling ink mountains, mist bands and a red seal. */
export function ScrollBackdrop({ colors }: BackdropProps): JSX.Element {
  return (
    <Frame id="scroll">
      <defs>
        <linearGradient id="nq-silk" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={colors.bg} />
          <stop offset="55%" stopColor={colors.bgAlt} />
          <stop offset="100%" stopColor={colors.bg} />
        </linearGradient>
      </defs>
      <rect width="1200" height="800" fill="url(#nq-silk)" />
      <path
        d="M0 520 C140 430 240 470 340 400 C440 330 520 420 640 380 C760 340 830 430 960 396 C1070 366 1140 400 1200 384 L1200 800 L0 800Z"
        fill={colors.accent}
        opacity="0.09"
      />
      <path
        d="M0 600 C180 540 300 590 440 550 C580 510 700 580 860 548 C1000 520 1120 556 1200 540 L1200 800 L0 800Z"
        fill={colors.accentAlt}
        opacity="0.07"
      />
      {[180, 300, 420].map((y, i) => (
        <ellipse key={i} cx={300 + i * 260} cy={y} rx={260} ry={22} fill={colors.surfaceAlt} opacity="0.09" />
      ))}
      <rect x="1080" y="80" width="54" height="54" rx="6" fill={colors.accent} opacity="0.2" />
    </Frame>
  )
}

/** Mughal silk: a jaali lattice over a warm, saturated field. */
export function SilkBackdrop({ colors }: BackdropProps): JSX.Element {
  return (
    <Frame id="silk">
      <defs>
        <pattern id="nq-jaali" width="60" height="104" patternUnits="userSpaceOnUse">
          <path
            d="M30 0 C48 18 48 34 30 52 C12 34 12 18 30 0 Z M30 52 C48 70 48 86 30 104 C12 86 12 70 30 52 Z"
            fill="none"
            stroke={colors.accent}
            strokeWidth="1.2"
            opacity="0.3"
          />
          <circle cx="30" cy="52" r="3.5" fill={colors.accentAlt} opacity="0.35" />
        </pattern>
        <radialGradient id="nq-silk-glow" cx="50%" cy="80%" r="70%">
          <stop offset="0%" stopColor={colors.accentAlt} stopOpacity="0.2" />
          <stop offset="100%" stopColor={colors.bg} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="1200" height="800" fill={colors.bg} />
      <rect width="1200" height="800" fill="url(#nq-jaali)" />
      <rect width="1200" height="800" fill="url(#nq-silk-glow)" />
    </Frame>
  )
}

/** Mashrabiya screen: turned-wood latticework with desert light behind it. */
export function MashrabiyaBackdrop({ colors }: BackdropProps): JSX.Element {
  return (
    <Frame id="mashrabiya">
      <defs>
        <pattern id="nq-mashrabiya" width="64" height="64" patternUnits="userSpaceOnUse">
          <circle cx="32" cy="32" r="22" fill="none" stroke={colors.accent} strokeWidth="1.2" opacity="0.32" />
          <circle cx="0" cy="0" r="22" fill="none" stroke={colors.accent} strokeWidth="1.2" opacity="0.32" />
          <circle cx="64" cy="0" r="22" fill="none" stroke={colors.accent} strokeWidth="1.2" opacity="0.32" />
          <circle cx="0" cy="64" r="22" fill="none" stroke={colors.accent} strokeWidth="1.2" opacity="0.32" />
          <circle cx="64" cy="64" r="22" fill="none" stroke={colors.accent} strokeWidth="1.2" opacity="0.32" />
        </pattern>
        <radialGradient id="nq-desert" cx="70%" cy="20%" r="70%">
          <stop offset="0%" stopColor={colors.accentAlt} stopOpacity="0.28" />
          <stop offset="100%" stopColor={colors.bg} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="1200" height="800" fill={colors.bg} />
      <rect width="1200" height="800" fill="url(#nq-desert)" />
      <rect width="1200" height="800" fill="url(#nq-mashrabiya)" opacity="0.55" />
    </Frame>
  )
}

/** Cycladic marble and sea: veined stone above, Aegean gradient below. */
export function MarbleBackdrop({ colors }: BackdropProps): JSX.Element {
  return (
    <Frame id="marble">
      <defs>
        <linearGradient id="nq-aegean" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={colors.bg} />
          <stop offset="70%" stopColor={colors.bgAlt} />
          <stop offset="100%" stopColor={colors.accent} stopOpacity="0.35" />
        </linearGradient>
        <filter id="nq-veins">
          <feTurbulence type="fractalNoise" baseFrequency="0.006 0.02" numOctaves="4" seed="11" />
          <feDisplacementMap in="SourceGraphic" scale="40" />
        </filter>
      </defs>
      <rect width="1200" height="800" fill="url(#nq-aegean)" />
      <g filter="url(#nq-veins)" opacity="0.16">
        {[120, 260, 400, 540, 680].map((y, i) => (
          <path
            key={i}
            d={`M-50 ${y} C 300 ${y - 40} 700 ${y + 50} 1250 ${y - 20}`}
            fill="none"
            stroke={colors.textMuted}
            strokeWidth={1.6 + (i % 3)}
          />
        ))}
      </g>
      <path d="M0 700 Q300 660 600 700 T1200 700 L1200 800 L0 800Z" fill={colors.accent} opacity="0.14" />
    </Frame>
  )
}

/** Aurora over snow, with carved-wood grain in the foreground. */
export function AuroraBackdrop({ colors }: BackdropProps): JSX.Element {
  return (
    <Frame id="aurora">
      <defs>
        <linearGradient id="nq-night" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={colors.bg} />
          <stop offset="100%" stopColor={colors.bgAlt} />
        </linearGradient>
        <linearGradient id="nq-aurora-band" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={colors.accent} stopOpacity="0" />
          <stop offset="45%" stopColor={colors.accent} stopOpacity="0.4" />
          <stop offset="70%" stopColor={colors.accentAlt} stopOpacity="0.3" />
          <stop offset="100%" stopColor={colors.accentAlt} stopOpacity="0" />
        </linearGradient>
        <filter id="nq-aurora-blur">
          <feGaussianBlur stdDeviation="26" />
        </filter>
      </defs>
      <rect width="1200" height="800" fill="url(#nq-night)" />
      {[0, 1, 2].map((i) => (
        <circle key={`s${i}`} cx={140 + i * 380} cy={90 + i * 40} r="1.6" fill={colors.text} opacity="0.7" />
      ))}
      <g filter="url(#nq-aurora-blur)" opacity="0.65">
        <path d="M-100 240 C200 120 420 300 700 180 C900 96 1100 220 1300 150 L1300 300 L-100 340Z" fill="url(#nq-aurora-band)" />
        <path d="M-100 360 C220 260 460 420 760 320 C980 246 1140 340 1300 290 L1300 420 L-100 460Z" fill="url(#nq-aurora-band)" opacity="0.6" />
      </g>
      <path d="M0 660 L200 560 L380 660 L560 540 L780 660 L980 580 L1200 660 L1200 800 L0 800Z" fill={colors.surface} opacity="0.55" />
    </Frame>
  )
}

/** Papel picado banners over a warm Talavera-blue sky. */
export function PapelBackdrop({ colors }: BackdropProps): JSX.Element {
  const banner = (y: number, fill: string, key: number) => (
    <g key={key} opacity="0.5">
      <path d={`M0 ${y} Q300 ${y + 46} 600 ${y} T1200 ${y}`} fill="none" stroke={colors.textMuted} strokeWidth="1.4" opacity="0.5" />
      {Array.from({ length: 10 }, (_, i) => {
        const x = i * 124 + 24
        const dip = Math.sin((x / 1200) * Math.PI) * 46
        return (
          <g key={i} transform={`translate(${x} ${y + dip})`}>
            <rect width="86" height="62" rx="3" fill={fill} opacity="0.55" />
            <circle cx="43" cy="26" r="12" fill={colors.bg} opacity="0.65" />
            <circle cx="20" cy="46" r="6" fill={colors.bg} opacity="0.5" />
            <circle cx="66" cy="46" r="6" fill={colors.bg} opacity="0.5" />
          </g>
        )
      })}
    </g>
  )
  return (
    <Frame id="papel">
      <rect width="1200" height="800" fill={colors.bg} />
      {banner(70, colors.accent, 0)}
      {banner(210, colors.accentAlt, 1)}
      <radialGradient id="nq-papel-glow" cx="50%" cy="100%" r="70%">
        <stop offset="0%" stopColor={colors.accentAlt} stopOpacity="0.2" />
        <stop offset="100%" stopColor={colors.bg} stopOpacity="0" />
      </radialGradient>
      <rect width="1200" height="800" fill="url(#nq-papel-glow)" />
    </Frame>
  )
}

/** Mud cloth: hand-stamped bogolanfini geometry on woven cotton. */
export function MudclothBackdrop({ colors }: BackdropProps): JSX.Element {
  return (
    <Frame id="mudcloth">
      <defs>
        <pattern id="nq-bogolan" width="96" height="96" patternUnits="userSpaceOnUse">
          <path d="M0 16 H96 M0 80 H96" stroke={colors.accent} strokeWidth="2" opacity="0.28" />
          <path d="M12 48 l12 -14 l12 14 l-12 14 Z" fill="none" stroke={colors.accentAlt} strokeWidth="1.6" opacity="0.32" />
          <path d="M60 48 l12 -14 l12 14 l-12 14 Z" fill="none" stroke={colors.accentAlt} strokeWidth="1.6" opacity="0.32" />
          <circle cx="48" cy="16" r="2.6" fill={colors.accent} opacity="0.4" />
          <circle cx="48" cy="80" r="2.6" fill={colors.accent} opacity="0.4" />
        </pattern>
      </defs>
      <rect width="1200" height="800" fill={colors.bg} />
      <rect width="1200" height="800" fill="url(#nq-bogolan)" opacity="0.7" />
      <radialGradient id="nq-sun" cx="20%" cy="15%" r="60%">
        <stop offset="0%" stopColor={colors.accentAlt} stopOpacity="0.22" />
        <stop offset="100%" stopColor={colors.bg} stopOpacity="0" />
      </radialGradient>
      <rect width="1200" height="800" fill="url(#nq-sun)" />
    </Frame>
  )
}

/** Aged parchment with faint ruled lines and an ink blot. */
export function ParchmentBackdrop({ colors }: BackdropProps): JSX.Element {
  return (
    <Frame id="parchment">
      <defs>
        <filter id="nq-foxing">
          <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="4" seed="3" />
          <feColorMatrix type="saturate" values="0.2" />
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.08" />
          </feComponentTransfer>
        </filter>
        <radialGradient id="nq-vignette" cx="50%" cy="45%" r="72%">
          <stop offset="60%" stopColor={colors.bg} stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.28" />
        </radialGradient>
      </defs>
      <rect width="1200" height="800" fill={colors.bg} />
      {Array.from({ length: 16 }, (_, i) => (
        <line key={i} x1="60" y1={70 + i * 46} x2="1140" y2={70 + i * 46} stroke={colors.accent} strokeWidth="0.7" opacity="0.1" />
      ))}
      <rect width="1200" height="800" filter="url(#nq-foxing)" />
      <rect width="1200" height="800" fill="url(#nq-vignette)" />
    </Frame>
  )
}

/** Synthwave: perspective grid, horizon sun and chromatic haze. */
export function SynthwaveBackdrop({ colors }: BackdropProps): JSX.Element {
  return (
    <Frame id="synthwave">
      <defs>
        <linearGradient id="nq-cyber-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={colors.bg} />
          <stop offset="70%" stopColor={colors.bgAlt} />
        </linearGradient>
        <linearGradient id="nq-cyber-sun" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={colors.accentAlt} />
          <stop offset="100%" stopColor={colors.accent} />
        </linearGradient>
        <filter id="nq-bloom">
          <feGaussianBlur stdDeviation="18" />
        </filter>
      </defs>
      <rect width="1200" height="800" fill="url(#nq-cyber-sky)" />
      <g filter="url(#nq-bloom)" opacity="0.55">
        <circle cx="600" cy="430" r="150" fill="url(#nq-cyber-sun)" />
      </g>
      <circle cx="600" cy="430" r="150" fill="url(#nq-cyber-sun)" opacity="0.35" />
      {Array.from({ length: 6 }, (_, i) => (
        <rect key={i} x="450" y={352 + i * 26} width="300" height="9" fill={colors.bg} opacity="0.75" />
      ))}
      <g opacity="0.35">
        {Array.from({ length: 21 }, (_, i) => (
          <line key={`v${i}`} x1={600 + (i - 10) * 22} y1="480" x2={600 + (i - 10) * 220} y2="800" stroke={colors.accent} strokeWidth="1.2" />
        ))}
        {Array.from({ length: 9 }, (_, i) => {
          const y = 480 + Math.pow(i / 8, 2) * 320
          return <line key={`h${i}`} x1="0" y1={y} x2="1200" y2={y} stroke={colors.accentAlt} strokeWidth="1.2" />
        })}
      </g>
    </Frame>
  )
}

/** Nothing but light: two very soft gradient blooms. */
export function CleanBackdrop({ colors }: BackdropProps): JSX.Element {
  return (
    <Frame id="clean">
      <defs>
        <radialGradient id="nq-clean-a" cx="22%" cy="18%" r="60%">
          <stop offset="0%" stopColor={colors.accent} stopOpacity="0.16" />
          <stop offset="100%" stopColor={colors.bg} stopOpacity="0" />
        </radialGradient>
        <radialGradient id="nq-clean-b" cx="82%" cy="78%" r="60%">
          <stop offset="0%" stopColor={colors.accentAlt} stopOpacity="0.14" />
          <stop offset="100%" stopColor={colors.bg} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="1200" height="800" fill={colors.bg} />
      <rect width="1200" height="800" fill="url(#nq-clean-a)" />
      <rect width="1200" height="800" fill="url(#nq-clean-b)" />
    </Frame>
  )
}

export const BACKDROPS = {
  tilework: TileworkBackdrop,
  washi: WashiBackdrop,
  scroll: ScrollBackdrop,
  silk: SilkBackdrop,
  mashrabiya: MashrabiyaBackdrop,
  marble: MarbleBackdrop,
  aurora: AuroraBackdrop,
  papel: PapelBackdrop,
  mudcloth: MudclothBackdrop,
  parchment: ParchmentBackdrop,
  synthwave: SynthwaveBackdrop,
  clean: CleanBackdrop,
} as const

export type BackdropId = keyof typeof BACKDROPS
