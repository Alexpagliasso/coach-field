import { expect, test } from '@playwright/test'

const player = (name: string, x: number, y: number) => `<button style="position:absolute;left:${x}%;top:${y}%;transform:translate(-50%,-50%)">${name}</button>`
const pitch = `<div class="relative" style="aspect-ratio:.72;max-width:288px;width:100%;position:relative">${player('Luca',50,88)}${player('Marco',25,65)}${player('Paolo',75,65)}${player('Andrea',50,20)}</div>`

async function styles(page: import('@playwright/test').Page) {
  await page.addStyleTag({ url: 'http://127.0.0.1:4173/src/styles/themes.css' })
  await page.addStyleTag({ url: 'http://127.0.0.1:4173/src/index.css' })
}

for (const viewport of [{ width:375,height:812 },{ width:390,height:844 },{ width:430,height:932 },{ width:1280,height:900 },{ width:1440,height:960 }]) test(`Matchday layout remains operable at ${viewport.width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize(viewport)
  await page.setContent(`<main class="page"><section class="match-live-panel grid gap-4"><header><p>Match Live</p><h2>GrowPitch vs Blu</h2><strong>01 — 00</strong><div><b>08:42</b> · 2°/4</div></header><section aria-label="Punteggi"><article>Tempo 1—0</article></section><section class="grid gap-3"><div><h3>Campo e panchina</h3></div><p>Cambio rapido: tocca un titolare, poi la panchina.</p>${pitch}<div class="bench" style="display:grid;gap:8px"><button>Giovanni</button><button>Matteo</button><button>Samuele</button><button>Alessio</button></div></section><section><h3>Minutaggi e rotazioni</h3><p>${'Luca 18:20 · Marco 15:10 · '.repeat(12)}</p></section><section><h3>Cronologia</h3><p>${'Cambio Luca → Giovanni. '.repeat(20)}</p></section></section></main>`)
  await styles(page)
  const root = page.locator('.match-live-panel')
  await expect(root).toBeVisible()
  expect(await root.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
  const field = await page.locator('.relative').boundingBox(), bench = await page.locator('.bench').boundingBox()
  if (viewport.width >= 1280) {
    expect((field?.x ?? 0) + (field?.width ?? 0)).toBeLessThanOrEqual(bench?.x ?? 0)
    expect(bench?.width ?? 0).toBeGreaterThan(300)
  } else {
    expect(bench?.y ?? 0).toBeGreaterThanOrEqual((field?.y ?? 0) + (field?.height ?? 0))
    for (const button of await page.locator('button').all()) expect((await button.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(0)
  }
  const sections = await root.locator(':scope > section').all()
  for (let index=1; index<sections.length; index++) {
    const previous=await sections[index-1].boundingBox(), current=await sections[index].boundingBox()
    expect(current?.y ?? 0).toBeGreaterThanOrEqual((previous?.y ?? 0)+(previous?.height ?? 0)-1)
  }
  await page.screenshot({ path:testInfo.outputPath(`matchday-${viewport.width}.png`), fullPage:true })
})

test('planned lineup desktop keeps pitch and bench side by side', async ({ page }) => {
  await page.setViewportSize({ width:1440,height:960 })
  await page.setContent(`<section class="match-lineup-panel grid gap-4"><header><h2>Formazioni per tempo</h2></header><div role="tablist"><button>1°</button><button>2°</button><button>3°</button><button>4°</button></div><section>Tempi previsti</section><div aria-label="Modulo 1° tempo"><button>3-2-1</button><button>2-3-1</button></div><section aria-label="Campo di gioco" style="aspect-ratio:.68;width:100%;max-width:384px"></section><section><h3>Panchina e convocati</h3><p>${'Giocatore convocato · '.repeat(50)}</p></section><div>Salva 1° tempo</div></section>`)
  await styles(page)
  const field=await page.locator('[aria-label="Campo di gioco"]').boundingBox(), bench=await page.locator('[aria-label="Campo di gioco"] + section').boundingBox()
  expect((field?.x ?? 0)+(field?.width ?? 0)).toBeLessThanOrEqual(bench?.x ?? 0)
  expect(bench?.y ?? 0).toBe(field?.y ?? 0)
})

test('training scheduled badge stays compact', async ({ page }) => {
  await page.setViewportSize({ width:1280,height:800 })
  await page.setContent(`<header class="training-session-hero"><div><p>18 novembre</p><h1>Allenamento tecnico</h1></div><span class="gp-badge">In programma</span><div class="training-session-actions"><button>Modalità campo</button></div></header>`)
  await styles(page)
  const badge=await page.locator('.gp-badge').boundingBox(), hero=await page.locator('.training-session-hero').boundingBox()
  expect(badge?.height ?? 0).toBeLessThan(40)
  expect(badge?.width ?? 0).toBeLessThan(160)
  expect(badge?.height ?? 0).toBeLessThan((hero?.height ?? 0)/2)
})

for (const viewport of [{width:375,height:812},{width:390,height:844},{width:430,height:932},{width:1280,height:900},{width:1440,height:960}]) test(`Live dock and three-player line remain collision-free at ${viewport.width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize(viewport)
  await page.setContent(`<main class="page match-live-page"><section class="match-live-panel grid gap-4"><header><h2>GrowPitch vs Avversari</h2></header><section class="match-live-dock"><div><span>2–1</span><strong>13:42</strong><small>3°/4</small></div><div><button class="gp-button">Gol nostro</button><button class="gp-button">Gol avversario</button></div></section><section class="grid gap-3"><div><h3>Campo e panchina</h3></div><p>Cambio rapido</p><div class="relative" style="position:relative;width:100%;max-width:${viewport.width < 768 ? 288 : 440}px;aspect-ratio:.72"><button style="position:absolute;left:20%;top:68%;transform:translate(-50%,-50%)">Alessandro M.</button><button style="position:absolute;left:50%;top:68%;transform:translate(-50%,-50%)">Francesco B.</button><button style="position:absolute;left:80%;top:68%;transform:translate(-50%,-50%)">Gianluca R.</button></div><div>${'<button class="gp-button">Panchinaro</button>'.repeat(8)}</div></section><section style="height:1600px"><h3>Minutaggi e cronologia</h3></section></section></main>`)
  await styles(page)
  const labels=await page.locator('.relative button').all()
  const boxes=await Promise.all(labels.map(label=>label.boundingBox()))
  for(let index=1;index<boxes.length;index++) expect(boxes[index-1]!.x+boxes[index-1]!.width).toBeLessThanOrEqual(boxes[index]!.x)
  await page.screenshot({path:testInfo.outputPath(`live-field-long-names-${viewport.width}.png`),fullPage:false})
  const dock=page.locator('.match-live-dock'); await page.evaluate(()=>window.scrollTo(0,200)); const before=await dock.boundingBox()
  for (const button of await dock.locator('button').all()) { const bounds=await button.boundingBox(); expect(bounds!.y).toBeGreaterThanOrEqual(before!.y); expect(bounds!.y+bounds!.height).toBeLessThanOrEqual(before!.y+before!.height+1) }
  await page.evaluate(()=>window.scrollTo(0,600)); await page.waitForTimeout(50)
  await page.screenshot({path:testInfo.outputPath(`live-dock-middle-${viewport.width}.png`),fullPage:false})
  await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight)); await page.waitForTimeout(50)
  const after=await dock.boundingBox()
  expect(Math.abs((after?.y??0)-(before?.y??0))).toBeLessThanOrEqual(2)
  await expect(dock.getByText('Gol nostro')).toBeVisible(); await expect(dock.getByText('Gol avversario')).toBeVisible()
  await page.screenshot({path:testInfo.outputPath(`live-dock-bottom-${viewport.width}.png`),fullPage:false})
})
