import { expect, test } from '@playwright/test'

const fixture = `<main class="page command-dashboard dashboard-v7">
  <header class="dashboard-v8-header"><div><p class="eyebrow">Dashboard WorkGroup</p><h1>Pulcini Rosso</h1><p>Pulcini Misti · 2026/27</p></div></header>
  <div class="dashboard-v7-grid">
    <article class="dashboard-panel dashboard-v8-next"><div class="dashboard-v8-next-copy"><span class="dashboard-v8-activity-icon"><svg></svg></span><div><p class="eyebrow">Prossima attività</p><h2>Allenamento tecnico</h2><p>mar 17 nov · 18:30</p></div></div><a class="dashboard-v8-primary-link">Apri dettaglio</a></article>
    <section class="dashboard-v8-kpis">${Array.from({ length: 4 }, (_, index) => `<article class="dashboard-stat-tile"><span>KPI ${index}</span><strong>${index + 4}</strong><small>Dati reali</small></article>`).join('')}</section>
    <article class="dashboard-panel dashboard-v7-attendance"><div class="dashboard-chart-canvas"></div></article>
    <article class="dashboard-panel dashboard-v7-results"><div class="dashboard-chart-canvas"></div></article>
    <article class="dashboard-panel dashboard-v8-upcoming"></article>
    <article class="dashboard-panel dashboard-v7-family-board"></article>
  </div>
</main>`

for (const viewport of [{ width: 375, height: 812 }, { width: 768, height: 900 }, { width: 1280, height: 900 }]) {
  test(`dashboard remains reachable at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.setContent(fixture)
    await page.addStyleTag({ url: 'http://127.0.0.1:4173/src/styles/themes.css' })
    await page.addStyleTag({ url: 'http://127.0.0.1:4173/src/index.css' })
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width)
    for (const selector of ['.dashboard-v8-header', '.dashboard-v8-next', '.dashboard-v8-kpis', '.dashboard-v7-attendance', '.dashboard-v7-family-board']) {
      const box = await page.locator(selector).boundingBox()
      expect(box?.x).toBeGreaterThanOrEqual(0)
      expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(viewport.width)
    }
    if (viewport.width === 375) expect((await page.locator('.dashboard-v8-primary-link').boundingBox())?.height).toBeGreaterThanOrEqual(44)
  })
}
