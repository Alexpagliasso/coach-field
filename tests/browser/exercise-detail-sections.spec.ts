import { expect, test } from '@playwright/test'

for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
  test(`exercise detail remains readable at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.setContent(`<main style="width:min(100%,52rem);margin:auto;padding:1rem"><div class="exercise-detail-sections"><div class="exercise-library-media detail" style="aspect-ratio:16/9"><div style="width:100%;height:100%;background:var(--surface-raised)"></div></div><header class="exercise-detail-identity"><div class="exercise-detail-meta"><span class="gp-badge">Tecnica</span></div><h1>Rondo con pressione e transizione immediata</h1></header><section class="exercise-detail-objective"><h3>Obiettivo</h3><p>Possesso orientato</p></section><section class="exercise-detail-section"><h3>Organizzazione</h3><div class="exercise-detail-facts"><span><strong>Durata</strong>15 min</span><span><strong>Giocatori</strong>8</span><span><strong>Campo</strong>18 × 24 m</span><span class="is-wide"><strong>Materiali</strong>Palloni, cinesini, casacche</span></div></section><section class="exercise-detail-section"><h3>Svolgimento</h3><p>${'Descrizione lunga con indicazioni tecniche e interruzioni di riga. '.repeat(40)}</p></section><section class="exercise-detail-section exercise-detail-coach"><h3>Note dell’allenatore</h3><p>Correggere postura e tempi di pressione.</p></section></div></main>`)
    await page.addStyleTag({ url: 'http://127.0.0.1:4173/src/index.css' })
    await expect(page.getByRole('heading', { name: 'Rondo con pressione e transizione immediata' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
    const media = await page.locator('.exercise-library-media').boundingBox()
    const identity = await page.locator('.exercise-detail-identity').boundingBox()
    const objective = await page.locator('.exercise-detail-objective').boundingBox()
    expect(media && identity && objective).toBeTruthy()
    expect(media!.y + media!.height).toBeLessThanOrEqual(identity!.y)
    expect(identity!.y + identity!.height).toBeLessThanOrEqual(objective!.y)
  })
}
