import { expect, test } from '@playwright/test'

for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
  test(`field mode GIF viewer is responsive at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.setContent(`<div class="sheet-backdrop"><section class="field-mode-sheet"><div class="field-mode-scroll"><section class="field-mode-exercise"><h2>Rondo animato</h2><button id="open" class="gp-button">Guarda animazione</button></section><div class="field-mode-gif-viewer" role="dialog" aria-modal="true"><div class="field-mode-gif-panel"><header><h2>Rondo animato</h2><button id="close" class="gp-button">Chiudi</button></header><div class="field-mode-gif-canvas"><img alt="Animazione di Rondo animato" src="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22800%22 height=%22450%22 viewBox=%220 0 800 450%22%3E%3Crect width=%22800%22 height=%22450%22 fill=%22%23dfe8df%22/%3E%3C/svg%3E"></div></div></div></div></section></div>`)
    await page.addStyleTag({ url: 'http://127.0.0.1:4173/src/index.css' })
    const image = page.getByAltText('Animazione di Rondo animato')
    await expect(image).toBeVisible()
    const box = await image.boundingBox()
    expect(box?.width).toBeLessThanOrEqual(viewport.width)
    expect(await image.evaluate(element => getComputedStyle(element).objectFit)).toBe('contain')
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width)
    await expect(page.getByRole('button', { name: 'Chiudi' })).toBeVisible()
  })
}
