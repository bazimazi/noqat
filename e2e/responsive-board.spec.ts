import { expect, test } from '@playwright/test'

for (const viewport of [{width:320,height:568},{width:360,height:740},{width:740,height:360}]) {
  test(`the whole board and four player cards fit ${viewport.width}×${viewport.height}`, async ({page}, testInfo) => {
    await page.setViewportSize(viewport)
    await page.emulateMedia({reducedMotion:'reduce'})
    await page.goto('/')
    await page.getByRole('button', {name:'Pass & play',exact:true}).click()
    await page.getByRole('radiogroup', {name:'Players',exact:true}).getByRole('radio', {name:'4',exact:true}).click()
    await page.getByRole('radio', {name:'3×3',exact:true}).click()
    await page.getByRole('button', {name:'Start game',exact:true}).click()
    const board = page.getByTestId('board')
    await expect(board.getByRole('button')).toHaveCount(24)
    const visible = page.locator('.nq-game-screen, .nq-player-rail [role="group"], [data-testid="board"], #nq-board-region, .nq-game-screen aside')
    for (const element of await visible.all()) {
      const bounds = await element.boundingBox()
      expect(bounds).not.toBeNull()
      expect(bounds!.x).toBeGreaterThanOrEqual(-1)
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width + 1)
      expect(bounds!.y).toBeGreaterThanOrEqual(-1)
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height + 1)
    }
    const first = board.getByRole('button').first()
    await first.click()
    await expect(board.getByRole('button')).toHaveCount(23)
    await page.screenshot({path:`test-results/screenshots/game-${viewport.width}-${testInfo.project.name}.png`,animations:'disabled'})
  })
}
