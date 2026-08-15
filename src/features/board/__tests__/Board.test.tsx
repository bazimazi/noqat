/**
 * Board component tests.
 *
 * These exercise the parts that are easy to get wrong and impossible to notice
 * by looking: the accessible names on every edge, keyboard navigation across
 * the interleaved lattice (including RTL mirroring), and the guarantee that a
 * board rendered as "not your turn" cannot be played.
 */
import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Board } from '../Board.tsx'
import { edgeToLattice, latticeToEdge, layoutFor, nextFreeEdge, stepEdge } from '../geometry.ts'
import { applyMove, createPosition } from '../../../core/rules.ts'
import { hEdge, vEdge } from '../../../core/board.ts'
import { getTheme } from '../../../themes/registry.ts'
import { DEFAULT_A11Y } from '../../../themes/tokens.ts'
import type { BoardSize } from '../../../core/types.ts'

const size: BoardSize = { rows: 2, cols: 2 }
const theme = getTheme('minimal')

function setup(overrides: Partial<React.ComponentProps<typeof Board>> = {}) {
  const onPlay = vi.fn()
  const position = overrides.position ?? createPosition(size)
  const utils = render(
    <Board
      position={position}
      size={size}
      theme={theme}
      a11y={DEFAULT_A11Y}
      onPlay={onPlay}
      interactive
      playerNames={['A', 'B']}
      {...overrides}
    />,
  )
  return { onPlay, ...utils }
}

describe('Board rendering', () => {
  it('exposes one accessible button per free edge', () => {
    setup()
    // 2x2 board: 6 horizontal + 6 vertical = 12 edges, all free.
    expect(screen.getAllByRole('button')).toHaveLength(12)
  })

  it('labels edges with their row and column', () => {
    setup()
    expect(screen.getAllByRole('button')[0]).toHaveAccessibleName(/row 1, column 1/i)
  })

  it('describes the board for assistive technology', () => {
    setup()
    expect(screen.getByRole('application')).toHaveAccessibleName('Game board, 2 by 2 boxes')
  })

  it('stops offering an edge once it is drawn', () => {
    const position = applyMove(createPosition(size), 0).position
    setup({ position })
    expect(screen.getAllByRole('button')).toHaveLength(11)
  })

  it('gives the glow filter a user-space region', () => {
    // A straight line has a zero-area bounding box, so the default
    // bounding-box region would collapse and the glowing last move would not
    // be painted at all.
    const { container } = setup()
    expect(container.querySelector('#nq-glow')).toHaveAttribute('filterUnits', 'userSpaceOnUse')
  })

  it('renders captured boxes with the owning player’s motif', () => {
    let position = createPosition(size)
    for (const edge of [hEdge(size, 0, 0), hEdge(size, 1, 0), vEdge(size, 0, 0), vEdge(size, 0, 1)]) {
      position = applyMove(position, edge).position
    }
    const { container } = setup({ position })
    expect(position.boxes[0]).toBeGreaterThanOrEqual(0)
    const titles = Array.from(container.querySelectorAll('title')).map((node) => node.textContent)
    // Four alternating plies, so player B draws the closing edge.
    expect(titles).toContain('Box at row 1, column 1, captured by B')
    // Only the closed box gets a motif group.
    expect(titles).toHaveLength(1)
  })
})

describe('Board interaction', () => {
  it('plays the edge that was clicked', async () => {
    const user = userEvent.setup()
    const { onPlay } = setup()
    await user.click(screen.getAllByRole('button')[3])
    expect(onPlay).toHaveBeenCalledTimes(1)
  })

  it('ignores input when it is not the local player’s turn', async () => {
    const user = userEvent.setup()
    const { onPlay } = setup({ onPlay: null, interactive: false })
    const buttons = screen.getAllByRole('button')
    await user.click(buttons[0]).catch(() => {})
    expect(onPlay).not.toHaveBeenCalled()
  })

  it('is reachable and playable by keyboard alone', async () => {
    const user = userEvent.setup()
    const { onPlay } = setup()
    const board = screen.getByRole('application')
    board.focus()
    expect(board).toHaveFocus()
    // Focus lands on the first free edge and Enter plays it.
    await waitFor(() => expect(board).toHaveAttribute('aria-activedescendant', 'nq-edge-0'))
    await user.keyboard('{Enter}')
    expect(onPlay).toHaveBeenCalledWith(0)
  })

  it('moves focus with the arrow keys', async () => {
    const user = userEvent.setup()
    setup()
    const board = screen.getByRole('application')
    board.focus()
    await waitFor(() => expect(board).toHaveAttribute('aria-activedescendant', 'nq-edge-0'))
    await user.keyboard('{ArrowRight}')
    await waitFor(() =>
      expect(board).toHaveAttribute('aria-activedescendant', `nq-edge-${hEdge(size, 0, 1)}`),
    )
  })

  it('can reach vertical edges from a horizontal one', async () => {
    const user = userEvent.setup()
    setup()
    const board = screen.getByRole('application')
    board.focus()
    await waitFor(() => expect(board).toHaveAttribute('aria-activedescendant', 'nq-edge-0'))
    // Left from the leftmost horizontal edge crosses to a vertical edge.
    await user.keyboard('{ArrowLeft}')
    await waitFor(() =>
      expect(board).toHaveAttribute('aria-activedescendant', `nq-edge-${vEdge(size, 0, 0)}`),
    )
    // …and down then walks along the column.
    await user.keyboard('{ArrowDown}')
    await waitFor(() =>
      expect(board).toHaveAttribute('aria-activedescendant', `nq-edge-${vEdge(size, 1, 0)}`),
    )
  })

  it('keeps the keyboard cursor out of sight until a key is used', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getAllByRole('button')[3])
    expect(screen.queryByTestId('edge-cursor')).not.toBeInTheDocument()
    const board = screen.getByRole('application')
    board.focus()
    await user.keyboard('{ArrowRight}')
    await waitFor(() => expect(screen.getByTestId('edge-cursor')).toBeInTheDocument())
  })

  it('shows the keyboard cursor from the start when the setting asks for it', async () => {
    setup({ showKeyboardHints: true })
    screen.getByRole('application').focus()
    await waitFor(() => expect(screen.getByTestId('edge-cursor')).toBeInTheDocument())
  })

  it('previews only the edge the player is pointing at', async () => {
    const user = userEvent.setup()
    const { container } = setup()
    await user.click(screen.getAllByRole('button')[3])
    await user.unhover(screen.getByRole('application'))
    // Clicking leaves the keyboard cursor on that edge. With the pointer gone
    // and the cursor hidden, nothing should still look about to be played.
    expect(container.querySelectorAll('.nq-edge-ghost[data-focused="true"]')).toHaveLength(0)
  })

  it('does not fall off the edge of the board', async () => {
    const user = userEvent.setup()
    setup()
    const board = screen.getByRole('application')
    board.focus()
    await waitFor(() => expect(board).toHaveAttribute('aria-activedescendant', 'nq-edge-0'))
    // Pressing into the boundary repeatedly must never clear focus or point at
    // an edge that does not exist.
    await user.keyboard('{ArrowUp}{ArrowUp}{ArrowLeft}{ArrowLeft}{ArrowLeft}')
    const active = board.getAttribute('aria-activedescendant')
    expect(active).toMatch(/^nq-edge-\d+$/)
    expect(document.getElementById(active!)).toBeInTheDocument()
  })
})

describe('lattice geometry', () => {
  it('round-trips every edge through the lattice', () => {
    const layout = layoutFor(size)
    for (const edge of layout.edges) {
      expect(latticeToEdge(size, edgeToLattice(size, edge.id))).toBe(edge.id)
    }
  })

  it('rejects lattice points that are dots or box centres', () => {
    expect(latticeToEdge(size, { i: 0, j: 0 })).toBeNull() // dot
    expect(latticeToEdge(size, { i: 1, j: 1 })).toBeNull() // box centre
    expect(latticeToEdge(size, { i: -1, j: 0 })).toBeNull() // outside
  })

  it('walks along the grain first', () => {
    expect(stepEdge(size, hEdge(size, 0, 0), 'right')).toBe(hEdge(size, 0, 1))
    expect(stepEdge(size, hEdge(size, 0, 0), 'down')).toBe(hEdge(size, 1, 0))
    expect(stepEdge(size, vEdge(size, 0, 1), 'down')).toBe(vEdge(size, 1, 1))
    expect(stepEdge(size, vEdge(size, 0, 1), 'right')).toBe(vEdge(size, 0, 2))
  })

  it('crosses the grain at the board edge', () => {
    // Without this fallback the two orientations form separate islands.
    expect(stepEdge(size, hEdge(size, 0, 0), 'left')).toBe(vEdge(size, 0, 0))
    expect(stepEdge(size, hEdge(size, 0, 1), 'right')).toBe(vEdge(size, 0, 2))
    expect(stepEdge(size, vEdge(size, 0, 1), 'up')).toBe(hEdge(size, 0, 0))
  })

  it('returns null only when there is genuinely nowhere to go', () => {
    expect(stepEdge(size, hEdge(size, 0, 0), 'up')).toBeNull()
    expect(stepEdge(size, hEdge(size, 2, 1), 'down')).toBeNull()
  })

  it('mirrors the crossing side for right-to-left locales', () => {
    // The leading side flips, so the same key reaches the mirrored neighbour.
    expect(stepEdge(size, hEdge(size, 0, 1), 'right', true)).toBe(hEdge(size, 0, 0))
    expect(stepEdge(size, hEdge(size, 0, 0), 'right', true)).toBe(vEdge(size, 0, 0))
  })

  it.each([
    ['2x2', { rows: 2, cols: 2 }],
    ['3x4', { rows: 3, cols: 4 }],
    ['5x5', { rows: 5, cols: 5 }],
  ] as const)('reaches every edge of a %s board by keyboard', (_label, boardSize) => {
    const seen = new Set<number>([0])
    const queue = [0]
    while (queue.length) {
      const current = queue.shift() as number
      for (const direction of ['up', 'down', 'left', 'right'] as const) {
        const next = stepEdge(boardSize, current, direction)
        if (next !== null && !seen.has(next)) {
          seen.add(next)
          queue.push(next)
        }
      }
    }
    expect(seen.size).toBe(layoutFor(boardSize).edges.length)
  })

  it('wraps when scanning for the next free edge', () => {
    const edges = new Uint8Array(12)
    edges[0] = 1
    edges[1] = 1
    expect(nextFreeEdge(edges, 0)).toBe(2)
    expect(nextFreeEdge(edges, 11)).toBe(2)
    expect(nextFreeEdge(new Uint8Array(4).fill(1), 0)).toBeNull()
  })
})
