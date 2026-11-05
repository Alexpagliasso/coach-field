import { expect, test } from '@playwright/test'

const button = (label: string, extra = '') => `<button class="gp-button ${extra}">${label}</button>`
const cards = Array.from({ length: 20 }, (_, index) => `<article class="exercise-picker-card${index < 2 ? ' is-selected' : ''}" data-card="${index + 1}"><button class="exercise-picker-card-select" aria-pressed="${index < 2}"><span class="exercise-picker-checkbox">${index < 2 ? '✓' : ''}</span><span><strong>Esercizio ${index + 1}</strong><small>Possesso, descrizione e obiettivo tecnico ${index + 1}</small></span></button><p>Descrizione dell’esercizio con indicazioni leggibili per il mister.</p><div><span class="gp-badge">${10 + index} min</span></div><div class="exercise-picker-card-actions">${button('Anteprima')}</div></article>`).join('')

const pickerFixture = `<div class="sheet-backdrop add-player-backdrop"><section class="exercise-picker-sheet"><div class="exercise-picker-layout"><header class="exercise-picker-header"><div><p class="eyebrow">Libreria condivisa</p><h1>Aggiungi esercizi</h1><p>Seleziona le card nell’ordine desiderato.</p></div>${button('Chiudi')}</header><div class="exercise-picker-body" tabindex="0"><div class="exercise-picker-tools"><label class="search-field"><input placeholder="Cerca nome, descrizione, obiettivo o tag"></label><div class="exercise-picker-filters"><select class="gp-control"><option>Categorie</option></select><select class="gp-control"><option>Obiettivi</option></select><select class="gp-control"><option>Giocatori</option></select>${button('Azzera')}</div></div><div class="exercise-picker-results">${cards}</div></div><footer class="exercise-picker-footer"><div><strong>2 selezionati</strong><span>21 min totali</span></div>${button('Annulla')}${button('Aggiungi 2 esercizi')}</footer></div></section></div>`
const longPreview = `<section class="exercise-picker-preview"><h2>Anteprima lunga</h2><p>${'Istruzioni dettagliate per organizzazione, regole, varianti e correzioni. '.repeat(90)}</p>${button('Seleziona esercizio')}</section>`

const libraryCards = Array.from({ length: 8 }, (_, index) => `<article class="exercise-library-card gp-card"><div class="exercise-library-media"><span>GP</span><small>Anteprima esercizio</small></div><h2 class="exercise-library-card-title">Esercizio completo ${index + 1}</h2><p class="text-app-primary">Obiettivo tecnico ordinato</p><p>Descrizione breve leggibile dell’attività.</p><div class="exercise-library-card-actions">${button('Dettaglio')}${button('Modifica')}${button('Variante')}${button('Elimina')}</div></article>`).join('')
const libraryFixture = `<main class="page"><header class="page-header compact"><span class="eyebrow">Cloud · U10</span><h1>Libreria esercizi</h1><p>Una raccolta condivisa per costruire sedute migliori.</p></header><div class="exercise-library-controls"><label class="search-field exercise-library-search"><input placeholder="Cerca nome, descrizione, obiettivo o tag"></label><select class="gp-control"><option>Tutte le categorie</option></select><select class="gp-control"><option>Tutti gli obiettivi</option></select><select class="gp-control"><option>Giocatori</option></select></div><div class="mt-5 exercise-library-grid">${libraryCards}</div></main>`

for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
  test(`picker scroll reaches card 20 and keeps footer at ${viewport.width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport)
    await page.setContent(pickerFixture)
    await page.addStyleTag({ url: 'http://127.0.0.1:4173/src/index.css' })
    const body = page.locator('.exercise-picker-body')
    const footer = page.locator('.exercise-picker-footer')
    await expect(body).toHaveJSProperty('scrollTop', 0)
    await body.hover()
    await page.mouse.wheel(0, 4000)
    await expect.poll(() => body.evaluate(element => element.scrollTop)).toBeGreaterThan(0)
    await body.focus(); await page.keyboard.press('End')
    await expect(page.locator('[data-card="20"]')).toBeInViewport()
    await expect(footer).toBeInViewport()
    const footerAfter = await footer.boundingBox()
    await body.evaluate((element, preview) => { element.innerHTML = preview; element.scrollTop = 0 }, longPreview)
    await body.evaluate(element => { element.scrollTop = element.scrollHeight })
    expect(await body.evaluate(element => element.scrollTop + element.clientHeight >= element.scrollHeight - 2)).toBe(true)
    expect((await footer.boundingBox())?.y).toBe(footerAfter?.y)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width)
    await page.screenshot({ path: testInfo.outputPath(`exercise-picker-${viewport.width}.png`), fullPage: true })
  })
}

for (const viewport of [{ width: 375, height: 844 }, { width: 768, height: 900 }, { width: 1280, height: 900 }, { width: 1440, height: 960 }]) {
  test(`exercise library stays readable at ${viewport.width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport)
    await page.setContent(libraryFixture)
    await page.addStyleTag({ url: 'http://127.0.0.1:4173/src/index.css' })
    const columns = await page.locator('.exercise-library-grid').evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length)
    expect(columns).toBe(viewport.width < 640 ? 1 : 2)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width)
    await expect(page.locator('.exercise-library-card').first()).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath(`exercise-library-${viewport.width}.png`), fullPage: true })
  })
}
