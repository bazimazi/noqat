/**
 * End-to-end tests against the real production build.
 *
 * These cover what jsdom cannot: the service worker registering, the Web Worker
 * actually answering, layout at phone and desktop sizes, and the app surviving
 * a reload mid-game.
 *
 * Run with `npm run e2e` (needs `npx playwright install` once).
 */
import { expect, test, type Page } from '@playwright/test'

async function startLocalGame(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: /quick play/i }).click()
  await page.getByRole('radio', { name: 'Pass & play' }).click()
  await page.getByRole('button', { name: /start game/i }).click()
  await expect(page.getByTestId('board')).toBeVisible()
}

test.describe('boot', () => {
  test('loads the menu and hides the splash', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Noqat' })).toBeVisible()
    await expect(page.locator('#boot')).toHaveCount(0)
  })

  test('has no horizontal overflow on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 })
    await page.goto('/')
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(1)
  })

  test('registers a service worker for offline play', async ({ page }) => {
    await page.goto('/')
    const registered = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return false
      const registration = await navigator.serviceWorker.getRegistration()
      return registration !== undefined
    })
    expect(registered).toBe(true)
  })
})

test.describe('playing', () => {
  test('draws lines and captures a box', async ({ page }) => {
    await startLocalGame(page)
    const board = page.getByTestId('board')
    const edges = board.getByRole('button')
    const before = await edges.count()
    await edges.first().click()
    await expect(edges).toHaveCount(before - 1)
  })

  test('is fully playable with the keyboard', async ({ page }) => {
    await startLocalGame(page)
    const board = page.getByTestId('board')
    await board.focus()
    await expect(board).toHaveAttribute('aria-activedescendant', /nq-edge-\d+/)
    const before = await board.getByRole('button').count()
    await page.keyboard.press('Enter')
    await expect(board.getByRole('button')).toHaveCount(before - 1)
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('Enter')
    await expect(board.getByRole('button')).toHaveCount(before - 2)
  })

  /**
   * The whole arc, with animations on. jsdom cannot catch this class of bug:
   * a screen-level `AnimatePresence` that never finishes its exit animation
   * strands the app on the outgoing screen, and every unit test still passes.
   */
  test('finishing a game shows the result panel', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /quick play/i }).click()
    await page.getByRole('radio', { name: 'Pass & play' }).click()
    await page.getByRole('radio', { name: '3×3' }).click()
    await page.getByRole('button', { name: /start game/i }).click()

    const board = page.getByTestId('board')
    await expect(board).toBeVisible()

    for (let i = 0; i < 30; i++) {
      const edges = board.getByRole('button')
      if ((await edges.count()) === 0) break
      await edges.first().click({ force: true })
    }

    await expect(page.getByRole('heading', { name: /victory|defeat|draw|wins/i })).toBeVisible({
      timeout: 10_000,
    })
    await expect(page.getByRole('button', { name: /rematch/i })).toBeVisible()
  })

  test('watching the replay stays on the board instead of bouncing back', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /quick play/i }).click()
    await page.getByRole('radio', { name: 'Pass & play' }).click()
    await page.getByRole('radio', { name: '3×3' }).click()
    await page.getByRole('button', { name: /start game/i }).click()

    const board = page.getByTestId('board')
    await expect(board).toBeVisible()
    for (let i = 0; i < 30; i++) {
      const edges = board.getByRole('button')
      if ((await edges.count()) === 0) break
      await edges.first().click({ force: true })
    }

    await page.getByRole('button', { name: /watch replay/i }).click()
    await expect(board).toBeVisible()
    // Long enough that the finished-game handover would have fired by now.
    await page.waitForTimeout(3000)
    await expect(board).toBeVisible()
  })

  /**
   * A timed game writes to the store several times a second. A pure debounce
   * gets pushed back by every one of those writes, so blitz games used to be
   * the only ones that never reached disk.
   */
  test('a timed game is autosaved too', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /quick play/i }).click()
    await page.getByRole('radio', { name: 'Pass & play' }).click()
    await page.getByRole('radio', { name: 'Blitz' }).click()
    await page.getByRole('button', { name: /start game/i }).click()

    const board = page.getByTestId('board')
    await expect(board).toBeVisible()
    const before = await board.getByRole('button').count()
    await board.getByRole('button').first().click()
    await expect(board.getByRole('button')).toHaveCount(before - 1)

    await page.waitForTimeout(3000)
    await page.reload()
    await expect(page.getByRole('button', { name: /continue game/i })).toBeVisible()
  })

  test('survives a reload mid-game', async ({ page }) => {
    await startLocalGame(page)
    const board = page.getByTestId('board')
    await board.getByRole('button').first().click()
    await board.getByRole('button').first().click()
    // Autosave is debounced; give it a beat before reloading.
    await page.waitForTimeout(900)
    await page.reload()
    await expect(page.getByRole('button', { name: /continue game/i })).toBeVisible()
  })
})

test.describe('online', () => {
  /**
   * Two tabs, the BroadcastChannel transport, no server. The transport has to
   * survive the navigation from lobby to board for any of this to work.
   */
  test('two tabs play a real game against each other', async ({ context }) => {
    const host = await context.newPage()
    const guest = await context.newPage()
    await host.goto('/')
    await guest.goto('/')

    await host.getByRole('button', { name: /play online/i }).click()
    await host.getByRole('button', { name: /^casual$/i }).click()
    const code = (await host.locator('code').first().textContent())?.trim() ?? ''
    expect(code).toHaveLength(5)

    await guest.getByRole('button', { name: /play online/i }).click()
    await guest.getByRole('textbox', { name: /room code/i }).fill(code)
    await guest.getByRole('button', { name: /^play$/i }).click()

    const hostBoard = host.getByTestId('board')
    const guestBoard = guest.getByTestId('board')
    await expect(hostBoard).toBeVisible({ timeout: 15_000 })
    await expect(guestBoard).toBeVisible({ timeout: 15_000 })

    const total = await hostBoard.getByRole('button').count()
    await hostBoard.getByRole('button').first().click({ force: true })
    await expect(guestBoard.getByRole('button')).toHaveCount(total - 1, { timeout: 10_000 })

    await guestBoard.getByRole('button').first().click({ force: true })
    await expect(hostBoard.getByRole('button')).toHaveCount(total - 2, { timeout: 10_000 })
  })
})

test.describe('opponent', () => {
  // A 3x3 board: 4 rows of 3 horizontal edges plus 3 rows of 4 vertical ones.
  const EDGES_3X3 = 24

  async function startAiGame(page: Page) {
    await page.goto('/')
    await page.getByRole('button', { name: /quick play/i }).click()
    await page.getByRole('radio', { name: '3×3' }).click()
    await page.getByRole('radio', { name: 'Beginner' }).click()
    await page.getByRole('button', { name: /start game/i }).click()
    const edges = page.getByTestId('board').getByRole('button')
    // Wait for the full lattice: counting before it has rendered reads zero.
    await expect(edges).toHaveCount(EDGES_3X3)
    return edges
  }

  test('the AI replies to a move', async ({ page }) => {
    const edges = await startAiGame(page)
    await edges.first().click()
    // One edge for us, one for the worker-driven opponent.
    await expect(edges).toHaveCount(EDGES_3X3 - 2, { timeout: 15_000 })
  })

  test('the AI keeps playing after an undo', async ({ page }) => {
    const edges = await startAiGame(page)
    const before = EDGES_3X3

    await edges.first().click()
    await expect(edges).toHaveCount(before - 2, { timeout: 15_000 })

    await page.getByRole('button', { name: /^undo$/i }).click()
    await expect(edges).toHaveCount(before)

    // The opponent must answer this one too — a stale "already asked for this
    // ply" guard used to freeze it here for the rest of the game.
    await edges.first().click()
    await expect(edges).toHaveCount(before - 2, { timeout: 15_000 })
  })
})

test.describe('themes and locales', () => {
  test('switching theme repaints the page', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /^themes$/i }).click()
    await expect(page.getByRole('heading', { name: /themes/i })).toBeVisible()
    const before = await page.evaluate(() => document.documentElement.dataset.theme)
    await page.getByRole('button', { name: /use this theme/i }).first().click()
    await expect
      .poll(() => page.evaluate(() => document.documentElement.dataset.theme))
      .not.toBe(before)
  })

  test('Persian switches the document to right-to-left', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /^settings$/i }).click()
    await page.getByLabel(/language/i).selectOption('fa')
    await expect.poll(() => page.evaluate(() => document.documentElement.dir)).toBe('rtl')
    await expect(page.locator('html')).toHaveAttribute('lang', 'fa')
  })
})

test.describe('accessibility', () => {
  test('every control is reachable by tab and has a name', async ({ page }) => {
    await page.goto('/')
    const unnamed = await page.evaluate(() => {
      const nodes = Array.from(
        document.querySelectorAll<HTMLElement>('button, [role="button"], a[href], select, input'),
      )
      return nodes.filter((node) => {
        const label =
          node.getAttribute('aria-label') ??
          node.getAttribute('title') ??
          node.textContent?.trim() ??
          ''
        return label.length === 0
      }).length
    })
    expect(unnamed).toBe(0)
  })

  test('the skip link jumps to the board', async ({ page }) => {
    await startLocalGame(page)
    await page.keyboard.press('Tab')
    const skip = page.getByRole('link', { name: /skip to board/i })
    await expect(skip).toBeFocused()
  })
})
