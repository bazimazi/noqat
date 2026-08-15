/**
 * The board.
 *
 * Rendered as SVG rather than canvas: it stays crisp at any density, each edge
 * can be a real focusable element for assistive technology, and the themes can
 * fill captured boxes with arbitrary vector motifs. On a 6x6 board that is
 * about 200 nodes — well inside what the compositor handles at 120 fps.
 *
 * Interaction is deliberately three-way redundant:
 *   pointer  — generous invisible hit strips, larger than the visible line
 *   keyboard — arrow keys walk the edge lattice, Enter plays
 *   assistive — one live region narrates every move and capture
 */
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { BoardSize, Position } from '../../core/types.ts'
import { tablesFor } from '../../core/board.ts'
import { NEUTRAL_OWNER } from '../../core/rules.ts'
import { capturesFor, degrees } from '../../core/analysis.ts'
import type { ThemePack } from '../../themes/types.ts'
import { resolvedPlayerPalette, type AccessibilityOverrides } from '../../themes/tokens.ts'
import { useI18n } from '../../i18n/index.tsx'
import { layoutFor, stepEdge, type Direction } from './geometry.ts'

export interface BoardProps {
  readonly position: Position
  readonly size: BoardSize
  readonly theme: ThemePack
  readonly a11y: AccessibilityOverrides
  /** Null when it is not the local player's turn. */
  readonly onPlay: ((edge: number) => void) | null
  readonly interactive: boolean
  /** Edge suggested by the Hint button. */
  readonly hintEdge?: number | null
  /** Edge the last move drew, highlighted briefly. */
  readonly lastEdge?: number | null
  /** Warn before a move that opens a chain. */
  readonly warnLoony?: boolean
  readonly showCoordinates?: boolean
  /** Keep the keyboard cursor on screen even while playing with a pointer. */
  readonly showKeyboardHints?: boolean
  readonly playerNames: readonly string[]
  readonly onHoverEdge?: (edge: number | null) => void
}

const SPRING = { type: 'spring' as const, stiffness: 420, damping: 34 }

export const Board = memo(function Board({
  position,
  size,
  theme,
  a11y,
  onPlay,
  interactive,
  hintEdge = null,
  lastEdge = null,
  warnLoony = false,
  showCoordinates = false,
  showKeyboardHints = false,
  playerNames,
  onHoverEdge,
}: BoardProps) {
  const { t, dir, n } = useI18n()
  const layout = useMemo(() => layoutFor(size), [size])
  const svgRef = useRef<SVGSVGElement>(null)

  const [focusEdge, setFocusEdge] = useState<number | null>(null)
  const [hoverEdge, setHoverEdge] = useState<number | null>(null)
  // The keyboard cursor exists whether or not it is drawn — assistive
  // technology follows it through aria-activedescendant regardless. This only
  // tracks whether it is worth showing: the last input was a key, not a tap.
  const [keyboardNav, setKeyboardNav] = useState(false)

  const deg = useMemo(() => degrees(position), [position])
  const reduced = a11y.reducedMotion

  // Keep keyboard focus on a playable edge as the board fills up.
  useEffect(() => {
    if (focusEdge === null) return
    if (position.edges[focusEdge] === 0) return
    for (let e = 0; e < position.edges.length; e++) {
      if (position.edges[e] === 0) {
        setFocusEdge(e)
        return
      }
    }
    setFocusEdge(null)
  }, [position, focusEdge])

  const play = useCallback(
    (edge: number) => {
      if (!onPlay || position.edges[edge] !== 0) return
      onPlay(edge)
    },
    [onPlay, position],
  )

  const setHover = useCallback(
    (edge: number | null) => {
      setHoverEdge(edge)
      onHoverEdge?.(edge)
    },
    [onHoverEdge],
  )

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<SVGSVGElement>) => {
      const arrows: Record<string, Direction> = {
        ArrowUp: 'up',
        ArrowDown: 'down',
        ArrowLeft: 'left',
        ArrowRight: 'right',
      }
      const direction = arrows[event.key]
      if (direction) {
        event.preventDefault()
        setKeyboardNav(true)
        const from = focusEdge ?? firstFreeEdge(position)
        if (from === null) return
        const next = stepEdge(size, from, direction, dir === 'rtl')
        setFocusEdge(next ?? from)
        return
      }
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        if (focusEdge !== null) play(focusEdge)
        return
      }
      if (event.key === 'Home') {
        event.preventDefault()
        setKeyboardNav(true)
        setFocusEdge(firstFreeEdge(position))
      }
    },
    [focusEdge, position, size, dir, play],
  )

  // A pointer press never moves focus (the hit strips preventDefault), so a
  // focus event is keyboard entry — unless a tap on the bare plate caused it,
  // which the timestamp rules out.
  const pointerAt = useRef(0)
  const onPointerDown = useCallback(() => {
    pointerAt.current = Date.now()
    setKeyboardNav(false)
  }, [])

  const onFocus = useCallback(() => {
    if (Date.now() - pointerAt.current > 300) setKeyboardNav(true)
    setFocusEdge((current) => current ?? firstFreeEdge(position))
  }, [position])

  const activeEdge = focusEdge
  const hintsVisible = showKeyboardHints || keyboardNav
  const previewEdge = hoverEdge ?? (hintsVisible ? focusEdge : null)

  const focusRing = useMemo(() => {
    if (activeEdge === null || !hintsVisible) return null
    const edge = layout.edges[activeEdge]
    if (!edge || position.edges[activeEdge] !== 0) return null
    const horizontal = edge.orientation === 'h'
    return {
      x: horizontal ? edge.x1 + 0.02 : edge.x1 - 0.14,
      y: horizontal ? edge.y1 - 0.14 : edge.y1 + 0.02,
      w: horizontal ? 0.96 : 0.28,
      h: horizontal ? 0.28 : 0.96,
    }
  }, [activeEdge, hintsVisible, layout, position])

  return (
    <svg
      ref={svgRef}
      className="nq-board h-full w-full"
      viewBox={layout.viewBox}
      role="application"
      aria-label={t('a11y.boardLabel', { rows: size.rows, cols: size.cols })}
      aria-describedby="nq-board-help"
      aria-activedescendant={activeEdge !== null ? `nq-edge-${activeEdge}` : undefined}
      tabIndex={interactive ? 0 : -1}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      onBlur={() => {
        setFocusEdge(null)
        setKeyboardNav(false)
      }}
      onPointerDown={onPointerDown}
      onPointerLeave={() => setHover(null)}
      data-testid="board"
    >
      <defs>
        {/* The region has to be given in user space. A straight <line> has a
            zero-area bounding box, so the default percentage-of-bounding-box
            region collapses to nothing and the browser drops the element
            entirely — the glowing last move would simply vanish. */}
        <filter
          id="nq-glow"
          filterUnits="userSpaceOnUse"
          x={-layout.padding}
          y={-layout.padding}
          width={size.cols + layout.padding * 2}
          height={size.rows + layout.padding * 2}
        >
          <feGaussianBlur stdDeviation="0.045" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <clipPath id="nq-box-clip">
          <rect x={0} y={0} width={1} height={1} />
        </clipPath>
        {theme.defs?.()}
      </defs>

      {/* board plate */}
      <rect
        x={-layout.padding * 0.7}
        y={-layout.padding * 0.7}
        width={size.cols + layout.padding * 1.4}
        height={size.rows + layout.padding * 1.4}
        rx={theme.shape.radius / 40}
        fill="var(--nq-board-bg)"
      />

      {/* captured boxes */}
      <g>
        <AnimatePresence initial={false}>
          {layout.boxes.map((box) => {
            const owner = position.boxes[box.id]
            if (owner < 0) return null
            const palette = resolvedPlayerPalette(theme, owner, a11y)
            const inset = theme.shape.boxInset
            return (
              <motion.g
                key={`box-${box.id}`}
                initial={reduced ? { opacity: 0 } : revealInitial(theme.motion.boxReveal)}
                animate={{ opacity: 1, scale: 1, rotate: 0, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={
                  reduced
                    ? { duration: 0 }
                    : { ...SPRING, delay: Math.min(0.16, box.id * 0.006) }
                }
                style={{ transformOrigin: `${box.x + 0.5}px ${box.y + 0.5}px` }}
              >
                <g transform={`translate(${box.x + inset} ${box.y + inset}) scale(${1 - inset * 2})`}>
                  <g clipPath="url(#nq-box-clip)">
                    {theme.boxMotif({ player: owner, palette, seed: box.id + 1, size: 1 })}
                  </g>
                  <rect
                    x={0}
                    y={0}
                    width={1}
                    height={1}
                    rx={theme.shape.boxRadius}
                    fill="none"
                    stroke={palette.line}
                    strokeWidth={0.012}
                    opacity={0.6}
                  />
                </g>
                <title>
                  {t('a11y.boxOwned', {
                    row: box.row + 1,
                    col: box.col + 1,
                    name: playerNames[owner] ?? String(owner + 1),
                  })}
                </title>
              </motion.g>
            )
          })}
        </AnimatePresence>
      </g>

      {/* coordinates */}
      {showCoordinates && (
        <g fill="var(--nq-text-muted)" fontSize={0.14} textAnchor="middle" aria-hidden="true">
          {Array.from({ length: size.cols }, (_, c) => (
            <text key={`cx${c}`} x={c + 0.5} y={-layout.padding * 0.25}>
              {n(c + 1)}
            </text>
          ))}
          {Array.from({ length: size.rows }, (_, r) => (
            <text key={`cy${r}`} x={-layout.padding * 0.45} y={r + 0.55}>
              {n(r + 1)}
            </text>
          ))}
        </g>
      )}

      {/* undrawn edge tracks */}
      <g>
        {layout.edges.map((edge) =>
          position.edges[edge.id] === 0 ? (
            <line
              key={`track-${edge.id}`}
              x1={edge.x1}
              y1={edge.y1}
              x2={edge.x2}
              y2={edge.y2}
              stroke="var(--nq-line-idle)"
              strokeWidth={theme.shape.lineWidth * 0.34}
              strokeLinecap={theme.shape.lineCap}
              strokeDasharray="0.06 0.09"
              aria-hidden="true"
            />
          ) : null,
        )}
      </g>

      {/* drawn edges */}
      <g>
        {layout.edges.map((edge) => {
          const owner = position.edges[edge.id]
          if (owner === 0) return null
          const neutral = owner === NEUTRAL_OWNER
          const palette = resolvedPlayerPalette(theme, owner - 1, a11y)
          const isLast = edge.id === lastEdge
          return (
            <motion.line
              key={`line-${edge.id}`}
              x1={edge.x1}
              y1={edge.y1}
              x2={edge.x2}
              y2={edge.y2}
              stroke={neutral ? 'var(--nq-text-muted)' : palette.line}
              strokeWidth={theme.shape.lineWidth * (isLast ? 1.14 : 1)}
              strokeLinecap={theme.shape.lineCap}
              filter={isLast && !reduced ? 'url(#nq-glow)' : undefined}
              initial={reduced ? { opacity: 0 } : { pathLength: 0, opacity: 0.4 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={reduced ? { duration: 0 } : { duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
            />
          )
        })}
      </g>

      {/* hint */}
      {hintEdge !== null && position.edges[hintEdge] === 0 && (
        <motion.line
          x1={layout.edges[hintEdge].x1}
          y1={layout.edges[hintEdge].y1}
          x2={layout.edges[hintEdge].x2}
          y2={layout.edges[hintEdge].y2}
          stroke="var(--nq-accent)"
          strokeWidth={theme.shape.lineWidth}
          strokeLinecap={theme.shape.lineCap}
          initial={{ opacity: 0.25 }}
          animate={reduced ? { opacity: 0.7 } : { opacity: [0.25, 0.85, 0.25] }}
          transition={reduced ? { duration: 0 } : { duration: 1.6, repeat: Infinity }}
          aria-hidden="true"
        />
      )}

      {/* interaction layer */}
      <g>
        {layout.edges.map((edge) => {
          if (position.edges[edge.id] !== 0) return null
          // Only `previewEdge` decides this: it already folds in the keyboard
          // cursor when the cursor is on show. Keying off the focused edge as
          // well would paint a line on an edge nobody pointed at.
          const previewing = edge.id === previewEdge
          const loony = warnLoony && isLoonyEdge(edge.id, deg, size)
          const capturing = capturesFor(position, edge.id, deg) > 0
          const horizontal = edge.orientation === 'h'
          const thickness = 0.34
          return (
            <g key={`hit-${edge.id}`}>
              <rect
                id={`nq-edge-${edge.id}`}
                role="button"
                aria-label={t('a11y.edgeFree', { row: edge.row + 1, col: edge.col + 1 })}
                className="nq-edge-hit"
                x={horizontal ? edge.x1 + 0.06 : edge.x1 - thickness / 2}
                y={horizontal ? edge.y1 - thickness / 2 : edge.y1 + 0.06}
                width={horizontal ? 1 - 0.12 : thickness}
                height={horizontal ? thickness : 1 - 0.12}
                onPointerEnter={() => setHover(edge.id)}
                onPointerDown={(event) => {
                  event.preventDefault()
                  if (interactive) {
                    setFocusEdge(edge.id)
                    play(edge.id)
                  }
                }}
                style={{ pointerEvents: interactive ? 'auto' : 'none' }}
              />
              <line
                className="nq-edge-ghost"
                data-focused={previewing ? 'true' : 'false'}
                x1={edge.x1}
                y1={edge.y1}
                x2={edge.x2}
                y2={edge.y2}
                stroke={
                  capturing
                    ? 'var(--nq-accent)'
                    : loony
                      ? '#e4695f'
                      : 'var(--nq-line-hover)'
                }
                strokeWidth={theme.shape.lineWidth}
                strokeLinecap={theme.shape.lineCap}
                pointerEvents="none"
              />
            </g>
          )
        })}
      </g>

      {/* keyboard focus ring — one persistent node that slides between edges.
          A `layoutId` would be the obvious way to do this, but a shared-layout
          node keeps its projection alive past unmount and deadlocks the
          screen-level AnimatePresence the board lives inside.
          Thin and half-lit, so it reads as a cursor rather than a highlight —
          except under high contrast, where it has to hold its own. */}
      {focusRing && (
        <motion.rect
          rx={0.1}
          fill="none"
          stroke="var(--nq-accent)"
          strokeWidth={a11y.highContrast ? 0.035 : 0.018}
          opacity={a11y.highContrast ? 1 : 0.5}
          initial={false}
          animate={{ x: focusRing.x, y: focusRing.y, width: focusRing.w, height: focusRing.h }}
          transition={reduced ? { duration: 0 } : SPRING}
          pointerEvents="none"
          aria-hidden="true"
          data-testid="edge-cursor"
        />
      )}

      {/* dots on top, so lines appear to pass beneath them */}
      <g>
        {layout.dots.map((dot, index) => (
          <g key={`dot-${index}`}>
            <circle
              className={reduced ? undefined : 'nq-dot'}
              cx={dot.x}
              cy={dot.y}
              r={theme.shape.dotRadius}
              fill="var(--nq-dot)"
              style={{ animationDelay: `${(index % 7) * 0.42}s` }}
            />
            <circle cx={dot.x} cy={dot.y} r={theme.shape.dotRadius * 0.42} fill="var(--nq-dot-core)" />
          </g>
        ))}
      </g>
    </svg>
  )
})

function firstFreeEdge(position: Position): number | null {
  for (let e = 0; e < position.edges.length; e++) if (position.edges[e] === 0) return e
  return null
}

/**
 * Would drawing this edge leave a box with a single side missing — i.e. hand
 * the opponent a free box? Drives the optional "careful, that opens a chain"
 * highlight for newer players.
 */
function isLoonyEdge(edge: number, deg: Uint8Array, size: BoardSize): boolean {
  const tables = tablesFor(size)
  for (let k = 0; k < 2; k++) {
    const box = tables.edgeBoxes[edge * 2 + k]
    if (box >= 0 && deg[box] === 2) return true
  }
  return false
}

function revealInitial(kind: ThemePack['motion']['boxReveal']) {
  switch (kind) {
    case 'bloom':
      return { opacity: 0, scale: 0.35 }
    case 'ink':
      return { opacity: 0, scale: 1.14 }
    case 'unfurl':
      return { opacity: 0, scale: 0.6, rotate: -14 }
    case 'stamp':
      return { opacity: 0, scale: 1.35 }
    case 'shatter':
      return { opacity: 0, scale: 0.2, rotate: 22 }
    default:
      return { opacity: 0, scale: 1 }
  }
}
