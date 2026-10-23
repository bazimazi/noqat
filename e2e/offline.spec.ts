import { expect, test } from '@playwright/test'

test('a cached game launches and remains playable without a network', async ({ page, context }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', {name:'Noqat',exact:true})).toBeVisible()
  await page.evaluate(async () => { await navigator.serviceWorker.ready })
  await page.reload()
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
  await context.setOffline(true)
  await page.reload()
  await page.getByRole('button', {name:'Pass & play',exact:true}).click()
  await page.getByRole('radio', {name:'3×3',exact:true}).click()
  await page.getByRole('button', {name:/start game/i}).click()
  const edges = page.getByTestId('board').getByRole('button')
  await expect(edges).toHaveCount(24)
  await edges.first().click()
  await expect(edges).toHaveCount(23)
  await expect(page.getByRole('button', {name:/undo/i})).toBeEnabled()
})
