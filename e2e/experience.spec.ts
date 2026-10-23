import { expect, test, type Page } from '@playwright/test'

async function startSharedBoard(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Pass & play', exact: true }).click()
  await expect(page.getByRole('radio', { name: 'Pass & play', exact: true })).toHaveAttribute('aria-checked', 'true')
  await page.getByRole('radio', { name: '3×3', exact: true }).click()
  await page.getByRole('button', { name: 'Start game', exact: true }).click()
  await expect(page.getByTestId('board').getByRole('button')).toHaveCount(24)
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const home = document.querySelector<HTMLElement>('.nq-home')
    return Math.max(
      document.documentElement.scrollWidth - document.documentElement.clientWidth,
      home ? home.scrollWidth - home.clientWidth : 0,
    )
  })
  expect(overflow).toBeLessThanOrEqual(1)
}

test.describe('the new play experience', () => {
  test('the menu preserves Pass & play intent instead of selecting a computer', async ({ page }) => {
    await startSharedBoard(page)
    await expect(page.locator('.nq-game-ribbon')).toContainText('Player 1')
    await expect(page.getByRole('group', { name: 'Player 2', exact: true })).toBeVisible()
    // A turn must pass to the second local player without waiting for a worker.
    await page.locator('#nq-edge-0').click()
    await expect(page.locator('.nq-game-ribbon')).toContainText('Player 2')
    await expect(page.getByTestId('board').getByRole('button')).toHaveCount(23)
  })

  test('quick play still selects the computer opponent', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /quick play/i }).click()
    await expect(page.getByRole('radio', { name: 'Computer', exact: true })).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByRole('radio', { name: 'Pass & play', exact: true })).toHaveAttribute('aria-checked', 'false')
    await expect(page.getByRole('radio', { name: 'Beginner', exact: true })).toBeVisible()
  })

  test('the daily card launches its board and target directly', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /daily challenge/i }).click()
    await expect(page.getByTestId('board')).toBeVisible()
    await expect(page.locator('.nq-mode-label')).toHaveText('Daily')
    await expect(page.locator('.nq-game-ribbon')).toContainText(/Challenge target: \d+/)
    await expect(page.getByRole('heading', { name: 'New game', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled()
    await expect(page.getByRole('button', { name: /coach/i })).toHaveCount(0)
  })

  test('installed-app shortcuts preserve the requested local and daily destinations', async ({ page }) => {
    await page.goto('/?shortcut=local')
    await expect(page.getByRole('radio', { name: 'Pass & play', exact: true })).toHaveAttribute('aria-checked', 'true')
    await page.goto('/?shortcut=daily')
    await expect(page.getByTestId('board')).toBeVisible()
    await expect(page.locator('.nq-mode-label')).toHaveText('Daily')
    await expect(page.locator('.nq-game-ribbon')).toContainText('Challenge target:')
  })

  test('the coach toggles and a real box capture celebrates the extra turn', async ({ page }) => {
    await startSharedBoard(page)
    const coach = page.getByRole('region', { name: 'Your corner', exact: true })
    await expect(coach.locator('.nq-coach-advice')).toBeVisible()
    await coach.getByRole('button', { name: 'Hide coach', exact: true }).click()
    await expect(coach.getByRole('button', { name: 'Show coach', exact: true })).toHaveAttribute('aria-expanded', 'false')
    await expect(coach.locator('.nq-coach-advice')).toHaveCount(0)
    await coach.getByRole('button', { name: 'Show coach', exact: true }).click()
    await expect(coach.getByRole('button', { name: 'Hide coach', exact: true })).toHaveAttribute('aria-expanded', 'true')
    await expect(coach.getByText('Join two neighboring dots. The fourth side makes the box yours.', { exact: true })).toBeVisible()

    // Top, bottom, left, then right of the top-left box on a real 3×3 board.
    for (const edge of [0, 3, 12]) await page.locator(`#nq-edge-${edge}`).click()
    await expect(coach).toContainText('capture moves')
    await page.locator('#nq-edge-13').click()
    const celebration = page.getByTestId('capture-celebration')
    await expect(celebration).toContainText('A new tile blooms!')
    await expect(celebration).toContainText('Player 2 · +1 · Go again')
    await expect(page.getByRole('progressbar', { name: 'boxes claimed', exact: true })).toHaveAttribute('aria-valuenow', '1')
    await expect(page.locator('.nq-game-ribbon')).toContainText('Player 2')
    // The celebration must not intercept the very next move.
    await page.locator('#nq-edge-1').click()
    await expect(page.getByTestId('board').getByRole('button')).toHaveCount(19)
    await expect(page.locator('.nq-game-ribbon')).toContainText('Player 1')
  })

  test('settings and the illustrated rules return to the menu, and game settings return to the board', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Settings', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Back', exact: true }).click()
    await expect(page.getByRole('heading', { name: /Every line begins a story/i })).toBeVisible()
    await page.getByRole('button', { name: 'How to play', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'How to play', exact: true })).toBeVisible()
    await expect(page.getByText('Complete the fourth side of a box and it is yours — and you go again.', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Back', exact: true }).click()
    await page.getByRole('button', { name: 'Pass & play', exact: true }).click()
    await page.getByRole('radio', { name: '3×3', exact: true }).click()
    await page.getByRole('button', { name: 'Start game', exact: true }).click()
    const board = page.getByTestId('board')
    await expect(board.getByRole('button')).toHaveCount(24)
    await page.locator('#nq-edge-0').click()
    await page.getByRole('button', { name: 'Settings', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Back', exact: true }).click()
    await expect(board.getByRole('button')).toHaveCount(23)
    await page.getByRole('button', { name: 'Back', exact: true }).click()
    const quit = page.getByRole('dialog')
    await expect(quit).toBeVisible()
    await quit.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(board.getByRole('button')).toHaveCount(23)
  })

  test('the Persian menu and coach use Persian labels with right-to-left layout', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Settings', exact: true }).click()
    await page.getByLabel('Language', { exact: true }).selectOption('fa')
    await expect(page.locator('html')).toHaveAttribute('lang', 'fa')
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
    await page.getByRole('button', { name: 'بازگشت', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'هر خط، آغاز یک نقش', exact: true })).toBeVisible()
    for (const label of ['باغ ایرانی', 'وارونه', 'تک‌خط', 'چالش روزانه']) {
      await expect(page.getByRole('heading', { name: label, exact: true })).toBeVisible()
    }
    await expectNoHorizontalOverflow(page)
    await page.getByRole('button', { name: 'دو نفره روی یک دستگاه', exact: true }).click()
    await expect(page.getByRole('radio', { name: 'دو نفره روی یک دستگاه', exact: true })).toHaveAttribute('aria-checked', 'true')
    await page.getByRole('radio', { name: '3×3', exact: true }).click()
    await page.getByRole('button', { name: 'شروع بازی', exact: true }).click()
    await expect(page.getByTestId('board')).toBeVisible()
    const coach = page.getByRole('region', { name: 'همراه بازی', exact: true })
    await coach.getByRole('button', { name: 'پنهان کردن راهنما', exact: true }).click()
    await expect(coach.getByRole('button', { name: 'نمایش راهنما', exact: true })).toHaveAttribute('aria-expanded', 'false')
    await coach.getByRole('button', { name: 'نمایش راهنما', exact: true }).click()
    await expect(coach).toContainText('دو نقطهٔ کنار هم را وصل کن.')
  })

  test('the redesigned menu fits its viewport and produces a review screenshot', async ({ page, isMobile }, testInfo) => {
    await page.setViewportSize(isMobile ? { width: 360, height: 740 } : { width: 1440, height: 1000 })
    await page.goto('/')
    await expect(page.locator('#boot')).toHaveCount(0)
    await expect(page.getByRole('heading', { name: /Every line begins a story/i })).toBeVisible()
    await expectNoHorizontalOverflow(page)
    await page.screenshot({ path: `test-results/screenshots/menu-${testInfo.project.name}.png`, animations: 'disabled' })
    // Ensure the lower paths remain reachable through the menu's own scroller.
    await page.getByRole('button', { name: 'Statistics', exact: true }).scrollIntoViewIfNeeded()
    await expect(page.getByRole('button', { name: 'Statistics', exact: true })).toBeInViewport()
    await expectNoHorizontalOverflow(page)
  })
})
