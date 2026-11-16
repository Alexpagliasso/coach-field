import { expect, test } from '@playwright/test'

const fixture = `<main class="page">
  <section class="calendar-command-page view-agenda"><header class="page-header"><h1>Calendario</h1></header><div class="calendar-toolbar"><div class="calendar-month-control"><button>‹</button><div><strong>novembre 2026</strong></div><button>›</button></div><div class="calendar-filters"><button>Tutti</button><button>Allenamenti</button><button>Partite</button></div></div><section class="calendar-mobile-agenda"><div class="calendar-agenda-heading"><h2>Agenda</h2></div><div><a><time><strong>18</strong><span>mer</span></time><i class="training"></i><span><strong>Allenamento tecnico</strong><small>18:30</small></span></a></div></section></section>
  <section class="training-archive"><header class="training-hub-header"><div><h1>Allenamenti</h1></div><div><button class="gp-button">Nuova seduta</button></div></header><section class="training-archive-overview"><article><strong>12</strong></article><article><strong>3</strong></article><article><strong>9</strong></article></section><section class="training-archive-controls"><input><select></select><select></select><select></select></section><section class="training-archive-list"><article class="training-archive-card"><button class="training-archive-card-main"><div><h2>Tecnica</h2></div></button><div class="training-archive-card-actions"><button class="gp-button">Apri</button><button class="gp-button">Modifica</button></div></article></section></section>
  <section class="match-archive-page"><header class="matches-archive-header"><div><h1>Partite</h1></div><button class="gp-button">Nuova partita</button></header><section class="match-archive-controls"><input><select></select><select></select></section><section class="match-archive-list"><div><article class="match-archive-card"><a class="match-archive-card-main"><div class="match-archive-date">18 nov</div><div class="match-archive-title"><strong>vs Blu</strong></div></a><a class="match-archive-live">Entra nel Live</a></article></div></section></section>
</main>`

for (const viewport of [{ width: 375, height: 812 }, { width: 390, height: 844 }, { width: 430, height: 932 }, { width: 768, height: 900 }, { width: 1280, height: 900 }]) {
  test(`activity archives fit ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.setContent(fixture)
    await page.addStyleTag({ url: 'http://127.0.0.1:4173/src/styles/themes.css' })
    await page.addStyleTag({ url: 'http://127.0.0.1:4173/src/index.css' })
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width)
    for (const selector of ['.calendar-toolbar', '.calendar-mobile-agenda', '.training-archive-controls', '.training-archive-list', '.match-archive-controls', '.match-archive-list']) {
      const box = await page.locator(selector).boundingBox()
      expect(box?.x).toBeGreaterThanOrEqual(0)
      expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(viewport.width)
    }
    if (viewport.width <= 430) expect((await page.locator('.match-archive-live').boundingBox())?.height).toBeGreaterThanOrEqual(44)
  })
}
