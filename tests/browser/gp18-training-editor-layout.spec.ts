import { expect, test } from '@playwright/test'

const editorFixture = `
  <main class="page training-builder-workspace">
    <div class="training-builder">
      <section class="training-builder-information">
        <div class="training-editor-core-fields">
          <label class="grid gap-2 text-sm font-semibold text-app-text">Data<input class="gp-control min-h-10 w-full min-w-0 border border-app-border bg-app-elevated px-3 text-sm" type="date" value="2026-10-20"></label>
          <label class="grid gap-2 text-sm font-semibold text-app-text">Ora<input class="gp-control min-h-10 w-full min-w-0 border border-app-border bg-app-elevated px-3 text-sm" type="time" value="18:30"></label>
          <label class="grid gap-2 text-sm font-semibold text-app-text">Durata (min)<input class="gp-control min-h-10 w-full min-w-0 border border-app-border bg-app-elevated px-3 text-sm" type="number" value="75"></label>
          <label class="grid gap-2 text-sm font-semibold text-app-text">Stato<select class="gp-control min-h-10 w-full min-w-0 border border-app-border bg-app-elevated px-3 text-sm"><option>Programmato</option></select></label>
        </div>
        <div class="training-editor-primary-fields">
          <label class="grid gap-2 text-sm font-semibold text-app-text">Titolo<input class="gp-control min-h-10 w-full min-w-0 border border-app-border bg-app-elevated px-3 text-sm" value="Possesso palla"></label>
          <label class="grid gap-2 text-sm font-semibold text-app-text">Obiettivo<input class="gp-control min-h-10 w-full min-w-0 border border-app-border bg-app-elevated px-3 text-sm" value="Uscita dalla pressione"></label>
        </div>
        <div class="training-editor-detail-fields">
          <section class="training-editor-objective-tags"><div class="mt-3 flex flex-wrap gap-1.5"><button class="training-objective-chip">Possesso palla</button><button class="training-objective-chip is-selected">Finalizzazione</button><button class="training-objective-chip">Transizione</button></div></section>
          <label class="grid gap-2 text-sm font-semibold text-app-text">Note del mister<textarea class="gp-control min-h-24 w-full min-w-0 border border-app-border bg-app-elevated px-3 py-2.5 text-sm training-coach-notes">Indicazioni generali per la seduta</textarea></label>
        </div>
      </section>
      <div class="training-builder-savebar"><button class="gp-button">Annulla</button><button class="gp-button">Salva allenamento</button></div>
    </div>
  </main>`

for (const viewport of [{ width: 375, height: 844 }, { width: 768, height: 900 }, { width: 1280, height: 900 }, { width: 1440, height: 960 }]) {
  test(`keeps the training editor usable at ${viewport.width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport)
    await page.setContent(editorFixture)
    await page.addStyleTag({ url: 'http://127.0.0.1:4173/src/index.css' })

    const fields = page.locator('.training-editor-core-fields .gp-control, .training-editor-primary-fields .gp-control')
    for (let index = 0; index < await fields.count(); index += 1) {
      const box = await fields.nth(index).boundingBox()
      expect(box?.height).toBeGreaterThanOrEqual(40)
      expect(box?.height).toBeLessThanOrEqual(56)
    }

    const textarea = await page.locator('.training-coach-notes').boundingBox()
    const notesLabel = await page.locator('.training-editor-detail-fields > label').boundingBox()
    const chips = await page.locator('.training-objective-chip').all()
    expect(textarea?.width).toBeGreaterThan(viewport.width < 640 ? 240 : 280)
    expect(textarea?.height).toBeGreaterThanOrEqual(120)
    expect(notesLabel?.height).toBeGreaterThanOrEqual((textarea?.height ?? 0))
    for (const chip of chips) expect((await chip.boundingBox())?.width).toBeGreaterThan(55)

    const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    expect(documentWidth).toBeLessThanOrEqual(viewport.width)
    const textareaBottom = (textarea?.y ?? 0) + (textarea?.height ?? 0)
    const footer = await page.locator('.training-builder-savebar').boundingBox()
    expect(footer?.y).toBeGreaterThanOrEqual(textareaBottom)
    await page.screenshot({ path: testInfo.outputPath(`training-editor-${viewport.width}.png`), fullPage: true })
  })
}
