import { expect, test } from '@playwright/test'

const fixture = `<div class="sheet-backdrop"><section class="field-mode-sheet"><div class="field-mode-scroll">
  <header class="field-mode-header"><div><p class="eyebrow">Rosso · Modalità campo</p><h1>Seduta tecnica</h1><small>Esercizio 2 di 6</small></div><button class="gp-button">Chiudi</button></header>
  <div class="field-mode-main"><section class="field-mode-exercise"><span class="gp-badge">Esercizio 2 di 6</span><h2>Possesso orientato</h2><p class="field-mode-objective">Ricezione e scelta</p><details class="field-mode-instructions" open><summary>Istruzioni</summary><p class="field-mode-description">Mantieni distanze e orientamento del corpo.</p></details></section>
  <section class="field-mode-timer"><div><p>Timer in pausa</p><strong>08:30</strong><small>Originale 10 min · scelta 12 min</small></div><div class="field-mode-timer-actions"><button class="gp-button">Avvia</button><button class="gp-button">Reset</button><button class="gp-button">Ripristina 10 min</button></div><div class="field-mode-duration"><span>Durata esercizio</span><div><button class="gp-button">-</button><button class="gp-button">5</button><button class="gp-button">10</button><button class="gp-button">15</button><button class="gp-button">20</button><button class="gp-button">+</button></div></div></section></div>
  <nav class="field-mode-navigation"><button class="gp-button">Precedente</button><button class="gp-button">Successivo</button></nav>
  <section class="field-mode-notes"><div><h2>Osservazioni di campo</h2></div><div class="field-mode-note-scope"><button class="gp-button">Esercizio 2</button><button class="gp-button">Seduta generale</button></div><textarea class="gp-control"></textarea><div class="field-mode-note-actions"><button class="gp-button">Detta</button><button class="gp-button">Salva nota</button></div></section>
</div></section></div>`

for (const viewport of [{ width: 375, height: 812 }, { width: 390, height: 844 }, { width: 430, height: 932 }, { width: 768, height: 900 }, { width: 1280, height: 900 }, { width: 1440, height: 960 }]) {
  test(`Field Mode controls remain usable at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.setContent(fixture)
    await page.addStyleTag({ url: 'http://127.0.0.1:4173/src/styles/themes.css' })
    await page.addStyleTag({ url: 'http://127.0.0.1:4173/src/index.css' })
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width)
    for (const selector of ['.field-mode-header', '.field-mode-timer', '.field-mode-exercise', '.field-mode-navigation', '.field-mode-notes']) {
      const box = await page.locator(selector).boundingBox()
      expect(box?.x).toBeGreaterThanOrEqual(0)
      expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(viewport.width)
    }
    for (const control of await page.locator('.field-mode-timer-actions .gp-button, .field-mode-navigation .gp-button').all()) expect((await control.boundingBox())?.height).toBeGreaterThanOrEqual(44)
    if (viewport.width <= 430) {
      expect(await page.locator('.field-mode-sheet').evaluate(element => getComputedStyle(element).height)).toContain(`${viewport.height}px`)
      expect(await page.locator('.field-mode-timer').evaluate(element => getComputedStyle(element).position)).toBe('relative')
      const navigation = await page.locator('.field-mode-navigation').boundingBox()
      const notes = await page.locator('.field-mode-notes').boundingBox()
      expect((navigation?.y ?? 0) + (navigation?.height ?? 0)).toBeLessThanOrEqual(notes?.y ?? 0)
      await page.locator('textarea').focus()
      expect(await page.locator('.field-mode-navigation').evaluate(element => getComputedStyle(element).position)).toBe('static')
    } else if (viewport.width >= 1280) {
      const timer = await page.locator('.field-mode-timer').boundingBox()
      const exercise = await page.locator('.field-mode-exercise').boundingBox()
      expect((timer?.x ?? 0) + (timer?.width ?? 0)).toBeLessThan(exercise?.x ?? 0)
      expect((exercise?.width ?? 0)).toBeGreaterThan(timer?.width ?? 0)
    }
  })
}
