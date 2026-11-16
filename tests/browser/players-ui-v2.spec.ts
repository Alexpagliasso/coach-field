import { expect, test } from '@playwright/test'

const fixture = `<main class="page players-command-page">
  <header class="page-header"><h1>Giocatori</h1><p>Rosa del gruppo</p></header>
  <section class="players-group-section"><div><h2>Gruppi disponibili</h2></div><div class="players-group-pills"><button class="active">Rosso</button><button>Blu</button></div></section>
  <div class="players-command-actions"><button class="gp-button">Assegna dalla rosa</button></div>
  <section class="players-control-panel"><label class="search-field"><input placeholder="Cerca per nome"></label><div class="players-mobile-sort"><select><option>Nome</option></select><button class="gp-button">Ordine</button></div></section>
  <div class="desktop-table"><table class="players-data-table"><thead><tr><th>Giocatore</th><th>Ruolo</th><th>Valutazione</th><th>Allenamenti</th><th>Convocazioni</th><th>Partite</th></tr></thead><tbody><tr><td><button class="player-profile-trigger"><strong>Mario Rossi</strong><small>Anno 2016</small></button></td><td><span class="player-role-indicator">Difensore</span></td><td>★★★★</td><td>8/10</td><td>4</td><td>3</td></tr></tbody></table></div>
  <div class="mobile-list"><article class="player-mobile-card"><button class="player-profile-trigger"><span class="player-mobile-heading"><strong>Mario Rossi</strong><span class="player-role-indicator">Difensore</span></span><span class="player-mobile-rating">★★★★</span><span class="player-mobile-metrics"><span>Allenamenti<b>8/10</b></span><span>Convocazioni<b>4</b></span><span>Partite<b>3</b></span></span></button><div class="player-mobile-actions"><button class="gp-button">Rimuovi</button></div></article></div>
</main>`

for (const viewport of [{ width: 375, height: 812 }, { width: 390, height: 844 }, { width: 430, height: 932 }, { width: 768, height: 900 }, { width: 1280, height: 900 }]) {
  test(`players layout fits ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.setContent(fixture)
    await page.addStyleTag({ url: 'http://127.0.0.1:4173/src/styles/themes.css' })
    await page.addStyleTag({ url: 'http://127.0.0.1:4173/src/index.css' })
    await page.addStyleTag({ content: viewport.width < 768 ? '.desktop-table{display:none}.mobile-list{display:grid}' : '.desktop-table{display:block;overflow:hidden;border:1px solid var(--border)}.mobile-list{display:none}' })
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width)
    for (const selector of ['.players-group-section', '.players-control-panel', viewport.width < 768 ? '.player-mobile-card' : '.players-data-table']) {
      const box = await page.locator(selector).boundingBox()
      expect(box?.x).toBeGreaterThanOrEqual(0)
      expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(viewport.width)
    }
    if (viewport.width < 768) {
      expect((await page.locator('.player-profile-trigger').last().boundingBox())?.height).toBeGreaterThanOrEqual(44)
      expect((await page.locator('.player-mobile-actions .gp-button').boundingBox())?.height).toBeGreaterThanOrEqual(44)
    }
  })
}
