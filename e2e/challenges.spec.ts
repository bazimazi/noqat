import { expect, test, type Page } from '@playwright/test'
import { DEFAULT_RULES } from '../src/core/types.ts'

const winningOpponentMoves = [7, 10, 4, 0, 9, 8, 3, 11, 5, 6, 2, 1]

async function readRecord(page: Page, store: string, key: string) {
  return page.evaluate(async ({ store, key }) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('noqat', 1)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    return new Promise<Record<string, unknown> | undefined>((resolve, reject) => {
      const request = db.transaction(store).objectStore(store).get(key)
      request.onsuccess = () => { db.close(); resolve(request.result) }
      request.onerror = () => { db.close(); reject(request.error) }
    })
  }, { store, key })
}

/** A legal, almost-complete 1–3 game makes expected puzzle losses reproducible. */
async function resumeChallenge(page: Page, mode: 'puzzle' | 'daily', par: number) {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Noqat' })).toBeVisible()
  const today = await page.evaluate(() => {
    const date = new Date()
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  })
  await page.evaluate(async ({ mode, par, today, rules, moves }) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('noqat', 1)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const transaction = db.transaction('saves', 'readwrite')
    transaction.objectStore('saves').put({
      id: 'autosave', mode, updatedAt: Date.now(), createdAt: Date.now() - 30_000,
      game: { v: 1, rows: 2, cols: 2, rules, moves: moves.slice(0, -1) },
      players: [{ kind: 'human', name: 'You' }, { kind: 'human', name: 'Partner' }],
      scores: [1, 2], finished: false, themeId: 'persian', clocks: [-1, -1],
      context: mode === 'puzzle' ? { puzzleId: 'target-regression', par } : { dailyDate: today, par },
    })
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
    db.close()
  }, { mode, par, today, rules: DEFAULT_RULES, moves: winningOpponentMoves })
  await page.reload()
  await page.getByRole('button', { name: /continue game/i }).click()
  await expect(page.getByTestId('board')).toBeVisible()
  await expect(page.getByTestId('board').getByRole('button')).toHaveCount(1)
  return today
}

test.describe('challenge progression', () => {
  test('puzzle par is mastery even when the opponent wins, and replay pays once', async ({ page }) => {
    await resumeChallenge(page, 'puzzle', 1)
    await page.locator('#nq-edge-1').click({ force: true })
    await expect(page.getByRole('heading', { name: 'A pattern mastered' })).toBeVisible()
    await expect(page.getByText('Target reached', { exact: true })).toBeVisible()
    await expect(page.getByLabel('Stars: 3 / 3')).toBeVisible()
    await expect.poll(async () => {
      const profile = await readRecord(page, 'profile', 'me')
      return (profile?.puzzleProgress as Record<string, unknown> | undefined)?.['target-regression']
    }).toEqual({ stars: 3, bestScore: 1 })
    await expect.poll(async () => (await readRecord(page, 'profile', 'me'))?.xp).toBeGreaterThan(0)
    const before = (await readRecord(page, 'profile', 'me'))?.xp
    await page.getByRole('button', { name: /watch replay/i }).click()
    await expect(page.getByTestId('board')).toBeVisible()
    await page.getByRole('button', { name: /back/i }).click()
    await expect(page.getByRole('heading', { name: 'A pattern mastered' })).toBeVisible()
    expect((await readRecord(page, 'profile', 'me'))?.xp).toBe(before)
  })

  test('missing puzzle par shows a retry and the actual grade', async ({ page }) => {
    await resumeChallenge(page, 'puzzle', 2)
    await page.locator('#nq-edge-1').click({ force: true })
    await expect(page.getByRole('heading', { name: 'Every pattern has a path' })).toBeVisible()
    await expect(page.getByLabel('Stars: 2 / 3')).toBeVisible()
    await expect(page.getByText('Try another path', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Try again', exact: true }).click()
    await expect(page.getByTestId('board')).toBeVisible()
    await expect(page.getByTestId('board').getByRole('button')).toHaveCount(12)
  })

  test('a resumed daily retains its calendar key, target, personal best and streak', async ({ page }) => {
    const today = await resumeChallenge(page, 'daily', 1)
    // A resumed attempt writes back its original challenge context, rather
    // than becoming an anonymous game after the first reload.
    await page.waitForTimeout(600)
    await expect.poll(async () => (await readRecord(page, 'saves', 'autosave'))?.context)
      .toEqual({ dailyDate: today, par: 1 })
    await page.locator('#nq-edge-1').click({ force: true })
    await expect(page.getByText('Daily target reached', { exact: true })).toBeVisible()
    await expect(page.getByText('Daily streak', { exact: true })).toBeVisible()
    await expect.poll(async () => {
      const profile = await readRecord(page, 'profile', 'me')
      return (profile?.dailyResults as Record<string, unknown> | undefined)?.[today]
    }).toEqual({ score: 1, par: 1, won: false })
  })

  test('menu daily challenge launches a distinct seeded board directly', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /daily challenge/i }).click()
    await expect(page.getByTestId('board')).toBeVisible()
    await page.getByTestId('board').getByRole('button').first().click()
    await expect.poll(async () => (await readRecord(page, 'saves', 'autosave'))?.mode).toBe('daily')
    const saved = await readRecord(page, 'saves', 'autosave')
    expect(saved?.context).toMatchObject({ dailyDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), par: expect.any(Number) })
    expect((saved?.game as { rules: { preplacedEdges: number[] } }).rules.preplacedEdges.length).toBeGreaterThan(0)
  })

  test('quitting and continuing a daily keeps its challenge context', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /daily challenge/i }).click()
    await expect(page.getByTestId('board')).toBeVisible()
    await page.getByTestId('board').getByRole('button').first().click()
    await expect.poll(async () => (await readRecord(page, 'saves', 'autosave'))?.mode).toBe('daily')
    const saved = await readRecord(page, 'saves', 'autosave')
    await page.getByRole('button', { name: /^back$/i }).click()
    await page.getByRole('dialog').getByRole('button', { name: /^quit$/i }).click()
    await expect(page.getByRole('heading', { name: 'Noqat' })).toBeVisible()
    await page.getByRole('button', { name: /continue game/i }).click()
    await expect(page.getByTestId('board')).toBeVisible()
    await page.reload()
    expect((await readRecord(page, 'saves', 'autosave'))?.context).toEqual(saved?.context)
  })

  test('the puzzle library has reversible pagination and clear targets', async ({ page }) => {
    // Each page proves its targets with the exact solver. Allow that work to
    // finish on slower machines while other browser projects are running.
    test.setTimeout(60_000)
    await page.goto('/')
    await page.getByRole('button', { name: /puzzles/i }).click()
    await expect(page.getByText(/match the target/i)).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('button', { name: 'Previous', exact: true })).toBeDisabled()
    const firstTarget = await page.getByText(/Target ≥/).first().textContent()
    await page.getByRole('button', { name: 'Next', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Previous', exact: true })).toBeEnabled()
    await page.getByRole('button', { name: 'Previous', exact: true }).click()
    await expect(page.getByText(/Target ≥/).first()).toHaveText(firstTarget ?? '')
  })

  test('four-player results show every seat and shared table highlights', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /pass & play/i, exact: true }).click()
    await page.getByRole('radio', { name: '3×3', exact: true }).click()
    await page.getByRole('radio', { name: '4', exact: true }).click()
    await page.getByRole('button', { name: /start game/i }).click()
    const board = page.getByTestId('board')
    await expect(board).toBeVisible()
    for (let move = 0; move < 24; move++) await board.getByRole('button').first().click({ force: true })
    const scores = page.getByRole('group', { name: 'Final scores' })
    await expect(scores).toBeVisible()
    for (let player = 1; player <= 4; player++) await expect(scores.getByText(`Player ${player}`, { exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Your table, woven together' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1)
  })
})
