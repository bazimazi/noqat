import { expect, test, type Page } from '@playwright/test'
import { edgeCount, edgeEndpoints } from '../src/core/board.ts'
import { applyMove, createPosition, isComplete, outcome } from '../src/core/rules.ts'
import { DEFAULT_RULES } from '../src/core/types.ts'
import { decodeShareCode, deserializeGame } from '../src/core/serialization.ts'

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (data: { url?: string }) => {
        ;(window as unknown as { sharedRulesUrl?: string }).sharedRulesUrl = data.url
      },
    })
  })
})

async function localSetup(page: Page, players = 2) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Pass & play', exact: true }).click()
  await page.getByRole('radio', { name: '3×3' }).click()
  if (players > 2) {
    await page.getByRole('radiogroup', { name: 'Players', exact: true }).getByRole('radio', { name: String(players), exact: true }).click()
  }
}

async function start(page: Page) {
  await page.getByRole('button', { name: /start game/i }).click()
  await expect(page.getByTestId('board')).toBeVisible()
}

async function localGame(page: Page) {
  await localSetup(page)
  await start(page)
  await expect(page.getByTestId('board').getByRole('button')).toHaveCount(24)
}

for (const count of [3, 4]) {
  test(`${count} players finish with correct scores and share a full multiplayer replay`, async ({ page }) => {
    await localSetup(page, count)
    await start(page)
    const rules = { ...DEFAULT_RULES, playerCount: count }
    let position = createPosition({ rows: 3, cols: 3 }, rules)
    for (let player = 1; player <= count; player++) {
      await expect(page.getByRole('group', { name: `Player ${player}`, exact: true })).toBeVisible()
    }
    while (!isComplete(position)) {
      const button = page.getByTestId('board').getByRole('button').first()
      const edge = Number((await button.getAttribute('id'))!.replace('nq-edge-', ''))
      position = applyMove(position, edge, rules).position
      await button.click({ force: true })
      if (!isComplete(position)) {
        await expect(page.getByRole('group', { name: `Player ${position.current + 1}`, exact: true })).toHaveAttribute('aria-current', 'true')
      }
    }
    const result = outcome(position, rules)
    const title = result.kind === 'draw' ? 'Draw' : result.kind === 'win' ? `Player ${result.winners[0] + 1} wins` : ''
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible()
    const scores = page.locator('[aria-label="Final scores"]')
    await expect(scores.locator('.nq-numeric')).toHaveText(position.scores.map(String))

    await page.getByRole('button', { name: /^share$/i }).click()
    const url = await page.evaluate(() => (window as unknown as { sharedRulesUrl?: string }).sharedRulesUrl)
    expect(url).toBeTruthy()
    const decoded = decodeShareCode(new URL(url!).searchParams.get('replay')!)
    expect(decoded.rules.playerCount).toBe(count)
    expect(deserializeGame(decoded).positions.at(-1)).toEqual(position)
    await page.goto(url!)
    await expect(page.getByTestId('board')).toBeVisible()
    await page.getByRole('button', { name: /jump to the end/i }).click()
    for (let index = 0; index < count; index++) {
      const card = page.getByRole('group', { name: String.fromCharCode(65 + index), exact: true })
      await expect(card).toBeVisible()
      await expect(card.locator('.nq-numeric').last()).toHaveText(String(position.scores[index]))
    }
  })
}

test('a custom rectangular board has the requested dimensions and remains playable', async ({ page }) => {
  await localSetup(page)
  await page.getByRole('radio', { name: 'Custom', exact: true }).click()
  await page.getByRole('slider', { name: 'Rows', exact: true }).focus()
  await page.keyboard.press('Home')
  await page.getByRole('slider', { name: 'Columns', exact: true }).focus()
  await page.keyboard.press('Home')
  for (let column = 0; column < 3; column++) await page.keyboard.press('ArrowRight')
  await start(page)
  const board = page.getByTestId('board')
  await expect(board).toHaveAttribute('aria-label', 'Game board, 2 by 5 boxes')
  const total = edgeCount({ rows: 2, cols: 5 })
  await expect(board.getByRole('button')).toHaveCount(total)
  await board.getByRole('button').first().click({ force: true })
  await expect(board.getByRole('button')).toHaveCount(total - 1)
  await expect(page.getByRole('group', { name: 'Player 2', exact: true })).toHaveAttribute('aria-current', 'true')
})

test('Speed draws one legal line when the ten-second move deadline expires', async ({ page }) => {
  await page.clock.install()
  await localSetup(page)
  await page.getByRole('radio', { name: 'Speed', exact: true }).click()
  await start(page)
  const edges = page.getByTestId('board').getByRole('button')
  await expect(edges).toHaveCount(24)
  await page.clock.fastForward(10_500)
  await page.clock.runFor(50)
  await expect(edges).toHaveCount(23)
  await expect(page.getByRole('group', { name: 'Player 2', exact: true })).toHaveAttribute('aria-current', 'true')
})

test('pause blocks pointer and keyboard moves until the game is resumed', async ({ page }) => {
  await localGame(page)
  const board = page.getByTestId('board')
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  await expect(page.getByText('Paused', { exact: true })).toBeVisible()
  await board.getByRole('button').first().dispatchEvent('pointerdown')
  await board.focus()
  await page.keyboard.press('Enter')
  await expect(board.getByRole('button')).toHaveCount(24)
  await page.getByRole('button', { name: 'Resume', exact: true }).last().click()
  await expect(page.getByText('Paused', { exact: true })).not.toBeVisible()
  await board.getByRole('button').first().click({ force: true })
  await expect(board.getByRole('button')).toHaveCount(23)
})

test('move confirmation cancels cleanly and commits exactly once when accepted', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByRole('switch', { name: 'Confirm each move', exact: true }).click()
  await localGame(page)
  const board = page.getByTestId('board')
  const edges = board.getByRole('button')
  await edges.first().click({ force: true })
  const dialog = page.getByRole('dialog', { name: 'Confirm each move', exact: true })
  await expect(dialog).toBeVisible()
  await expect(edges).toHaveCount(24)
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  await expect(edges).toHaveCount(24)
  await edges.first().click({ force: true })
  await dialog.getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  await expect(edges).toHaveCount(23)
  await expect(page.getByRole('group', { name: 'Player 2', exact: true })).toHaveAttribute('aria-current', 'true')
})

test('a worker hint points to a legal line and undo restores the decision', async ({ page }) => {
  await localGame(page)
  const board = page.getByTestId('board')
  await page.getByRole('button', { name: 'Hint', exact: true }).click()
  const hint = board.locator('line[stroke="var(--nq-accent)"][aria-hidden="true"]')
  await expect(hint).toHaveCount(1, { timeout: 15_000 })
  const endpoints = await hint.evaluate((line) => ({
    x1: Number(line.getAttribute('x1')),
    y1: Number(line.getAttribute('y1')),
    x2: Number(line.getAttribute('x2')),
    y2: Number(line.getAttribute('y2')),
  }))
  const free = await board.getByRole('button').evaluateAll((elements) => elements.map((element) => Number(element.id.replace('nq-edge-', ''))))
  const hinted = free.find((edge) => JSON.stringify(edgeEndpoints({ rows: 3, cols: 3 }, edge)) === JSON.stringify(endpoints))
  expect(hinted).toBeDefined()
  await page.locator(`#nq-edge-${hinted}`).click({ force: true })
  await expect(board.getByRole('button')).toHaveCount(23)
  await expect(hint).toHaveCount(0)
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(board.getByRole('button')).toHaveCount(24)
  await expect(page.getByRole('group', { name: 'Player 1', exact: true })).toHaveAttribute('aria-current', 'true')
})

test('high contrast and reduced motion persist and allow keyboard play', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/')
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  for (const name of ['High contrast', 'Reduce motion']) {
    const toggle = page.getByRole('switch', { name, exact: true })
    await expect(toggle).toHaveAttribute('aria-checked', 'false')
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-checked', 'true')
  }
  await expect.poll(() => page.evaluate(() => document.documentElement.style.getPropertyValue('--nq-speed'))).toBe('0.001')
  const palette = await page.evaluate(() => ({
    background: document.documentElement.style.getPropertyValue('--nq-bg'),
    foreground: document.documentElement.style.getPropertyValue('--nq-text'),
  }))
  expect([palette.background, palette.foreground].sort()).toEqual(['#000000', '#ffffff'])
  await page.reload()
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await expect(page.getByRole('switch', { name: 'High contrast', exact: true })).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByRole('switch', { name: 'Reduce motion', exact: true })).toHaveAttribute('aria-checked', 'true')
  await localGame(page)
  const board = page.getByTestId('board')
  await board.focus()
  await page.keyboard.press('Enter')
  await expect(board.getByRole('button')).toHaveCount(23)
})
