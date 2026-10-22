import { expect, test } from '@playwright/test'

const fixture = `
  <main class="page training-archive">
    <button class="training-next-session"><span>Prossima seduta</span><strong>Costruzione dal basso e finalizzazione</strong><small>venerdì 23 ottobre · 18:30 · 90 min</small><svg viewBox="0 0 24 24" width="22"><circle cx="12" cy="12" r="9" fill="currentColor" /></svg></button>
    <section class="weekly-objectives-panel"><div class="weekly-objectives-panel-head"><div><p class="eyebrow">Area famiglie</p><h2>Obiettivi settimanali</h2><p>Collegati al WorkGroup attivo.</p></div><div><button class="gp-button">Copia link famiglie</button><button class="gp-button">Crea obiettivi</button></div></div><div class="weekly-objectives-panel-date"><label>Settimana di riferimento<input type="date" value="2026-10-19"></label></div></section>
    <section class="training-archive-controls"><label class="search-field"><input placeholder="Titolo, obiettivo, note o esercizio"></label><select><option>Tutti gli stati</option></select><select><option>Intera stagione</option></select><select><option>Più recenti</option></select><input placeholder="Tema / obiettivo"><div class="training-view-switch"><button class="gp-button">Griglia</button><button class="gp-button">Lista</button></div></section>
    <section class="field-mode-sheet"><div class="field-mode-scroll"><header class="field-mode-header"><h1>Seduta attiva</h1></header><section class="field-mode-timer"><div><p>Timer attivo</p><strong>09:42</strong><small>10 min previsti</small></div><div class="field-mode-timer-actions"><button class="gp-button">Pausa</button><button class="gp-button">Reset</button><button class="gp-button">Imposta 10 min</button></div></section><nav class="field-mode-navigation"><button class="gp-button">Precedente</button><button class="gp-button">Successivo</button></nav></div></section>
  </main>`

for (const viewport of [{ width: 375, height: 812 }, { width: 390, height: 844 }, { width: 430, height: 932 }, { width: 1280, height: 900 }]) {
  test(`keeps archive and Field Mode within ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.setContent(fixture)
    await page.addStyleTag({ url: 'http://127.0.0.1:4173/src/styles/themes.css' })
    await page.addStyleTag({ url: 'http://127.0.0.1:4173/src/index.css' })

    for (const theme of ['light', 'pitch', 'electric', 'purple']) {
      await page.evaluate(value => { document.documentElement.dataset.theme = value }, theme)
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width)
      for (const selector of ['.training-next-session', '.weekly-objectives-panel', '.training-archive-controls', '.field-mode-sheet']) {
        const box = await page.locator(selector).boundingBox()
        expect(box?.x).toBeGreaterThanOrEqual(0)
        expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(viewport.width)
      }
    }

    if (viewport.width <= 430) {
      for (const button of await page.locator('.weekly-objectives-panel-head .gp-button, .training-view-switch .gp-button, .field-mode-navigation .gp-button').all()) {
        expect((await button.boundingBox())?.height).toBeGreaterThanOrEqual(44)
      }
      const title = await page.locator('.training-next-session strong').boundingBox()
      const meta = await page.locator('.training-next-session small').boundingBox()
      expect((meta?.y ?? 0)).toBeGreaterThan((title?.y ?? 0))
    }
  })
}
