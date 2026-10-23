import { expect, test, type Page } from '@playwright/test'
import { createPosition, applyMove, isComplete, outcome } from '../src/core/rules.ts'
import { DEFAULT_RULES, type Position, type RuleSet } from '../src/core/types.ts'
import { decodeShareCode, deserializeGame } from '../src/core/serialization.ts'

const size = { rows: 3, cols: 3 }
const totalEdges = 24
const modes = [
  { name: 'Persian Garden', mode: 'garden', rules: DEFAULT_RULES },
  { name: 'Reverse', mode: 'misere', rules: { ...DEFAULT_RULES, misere: true } },
  { name: 'One Line', mode: 'one-line', rules: { ...DEFAULT_RULES, extraTurnOnCapture: false } },
] as const

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (data: { url?: string }) => {
        ;(window as unknown as { sharedGameUrl?: string }).sharedGameUrl = data.url
      },
    })
  })
})

async function startVariant(page: Page, name: string, local = true) {
  await page.goto('/')
  await page.getByRole('button', { name: new RegExp(name, 'i') }).click()
  await expect(page.getByRole('radio', { name, exact: true })).toHaveAttribute('aria-checked', 'true')
  await page.getByRole('radio', { name: '3×3' }).click()
  if (local) await page.getByRole('radio', { name: 'Pass & play' }).click()
  else await page.getByRole('radio', { name: 'Beginner' }).click()
  await page.getByRole('button', { name: /start game/i }).click()
  await expect(page.getByTestId('board')).toBeVisible()
}

async function freeEdges(page: Page): Promise<number[]> {
  return page.getByTestId('board').getByRole('button').evaluateAll((elements) => elements.map((el) => Number(el.id.replace('nq-edge-', ''))))
}

async function openingPosition(page: Page, rules: RuleSet) {
  const free = new Set(await freeEdges(page))
  const preplacedEdges = Array.from({ length: totalEdges }, (_, id) => id).filter((id) => !free.has(id))
  return createPosition(size, { ...rules, preplacedEdges })
}

async function playLocalToEnd(page: Page, initial: Position, rules: RuleSet) {
  let position = initial
  while (!isComplete(position)) {
    const [edge] = await freeEdges(page)
    const result = applyMove(position, edge, rules)
    await page.locator(`#nq-edge-${edge}`).click({ force: true })
    position = result.position
    // Verifies actual turn changes after every capture, including the contrast
    // between One Line and the classic rules used by Garden and Reverse.
    if (!isComplete(position)) {
      await expect(page.locator('.nq-game-ribbon strong')).toHaveText(`Player ${position.current + 1}`)
    }
  }
  const result = outcome(position, rules)
  const headline = result.kind === 'draw' ? 'Draw' : result.kind === 'win' ? `Player ${result.winners[0] + 1} wins` : ''
  await expect(page.getByRole('heading', { name: headline, exact: true })).toBeVisible()
  const score = await page.locator('main p.nq-numeric').first().innerText()
  expect(score.replace(/[^\d–]/g, '')).toBe(`${position.scores[0]}–${position.scores[1]}`)
  return position
}

async function sharedGame(page: Page) {
  await page.getByRole('button', { name: /^share$/i }).click()
  const url = await page.evaluate(() => (window as unknown as { sharedGameUrl?: string }).sharedGameUrl)
  expect(url).toBeTruthy()
  const code = new URL(url!).searchParams.get('replay')!
  return { url: url!, decoded: decodeShareCode(code) }
}

for (const variant of modes) {
  test(`${variant.name} plays to its correct result and shares all rules`, async ({ page }) => {
    await startVariant(page, variant.name)
    const initial = await openingPosition(page, variant.rules)
    if (variant.mode === 'garden') {
      expect(await freeEdges(page)).toHaveLength(totalEdges - initial.edges.filter((owner) => owner !== 0).length)
      expect(await freeEdges(page)).not.toHaveLength(totalEdges)
    }
    const final = await playLocalToEnd(page, initial, variant.rules)
    const { url, decoded } = await sharedGame(page)
    expect(decoded.rules.misere).toBe(variant.rules.misere)
    expect(decoded.rules.extraTurnOnCapture).toBe(variant.rules.extraTurnOnCapture)
    expect(deserializeGame(decoded).positions.at(-1)).toEqual(final)

    await page.goto(url)
    await expect(page.getByTestId('board')).toBeVisible()
    await page.getByRole('button', { name: /jump to the end/i }).click()
    await expect(page.getByTestId('board').getByRole('button')).toHaveCount(0)
    // Shared replays stay watchable after reaching their finished position.
    await expect(page.getByTestId('board')).toBeVisible()
  })
}

test('a Persian Garden resumes the same paths and turn after reload', async ({ page }) => {
  await startVariant(page, 'Persian Garden')
  const initial = await freeEdges(page)
  await page.locator(`#nq-edge-${initial[0]}`).click({ force: true })
  const after = await freeEdges(page)
  await expect(page.locator('.nq-game-ribbon strong')).toHaveText('Player 2')
  await page.waitForTimeout(900)
  await page.reload()
  await page.getByRole('button', { name: /continue game/i }).click()
  await expect(page.getByTestId('board')).toBeVisible()
  expect(await freeEdges(page)).toEqual(after)
  await expect(page.locator('.nq-game-ribbon strong')).toHaveText('Player 2')
  await expect(page.locator('.nq-mode-label')).toHaveText('Persian Garden')
  await page.locator(`#nq-edge-${after[0]}`).click({ force: true })
  await expect(page.getByTestId('board').getByRole('button')).toHaveCount(after.length - 1)
})

test('the worker plays a complete Reverse game and the lower score wins', async ({ page }) => {
  test.setTimeout(60_000)
  await startVariant(page, 'Reverse', false)
  const board = page.getByTestId('board')
  for (let turn = 0; turn < totalEdges; turn++) {
    const edges = board.getByRole('button')
    await expect.poll(async () => {
      if (!await board.isVisible() || await edges.count() === 0) return 'finished'
      return edges.first().evaluate((el) => getComputedStyle(el).pointerEvents === 'auto' ? 'human' : 'thinking')
    }, { timeout: 15_000 }).not.toBe('thinking')
    if (!await board.isVisible() || await edges.count() === 0) break
    await edges.first().click({ force: true })
  }
  await expect(page.getByRole('button', { name: /rematch/i })).toBeVisible({ timeout: 15_000 })
  const { decoded } = await sharedGame(page)
  expect(decoded.rules.misere).toBe(true)
  const final = deserializeGame(decoded).positions.at(-1)!
  const result = outcome(final, decoded.rules)
  const title = result.kind === 'draw' ? 'Draw' : result.kind === 'win' && result.winners.includes(0) ? 'Victory' : 'Defeat'
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible()
})
