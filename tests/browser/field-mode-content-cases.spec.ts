import { expect, test } from '@playwright/test'

const longDescription = 'Mantieni distanze, orientamento e qualità tecnica durante la progressione. '.repeat(24)
const cases = [
  { name: 'breve', content: '<p class="field-mode-description">Corsa leggera.</p>' },
  { name: 'descrizione-1500', content: `<p class="field-mode-description">${longDescription}</p>` },
  { name: 'media-materiali-dimensioni', content: `<div class="field-mode-media"><img alt="Schema fixture" src="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 800 450%22%3E%3Crect width=%22800%22 height=%22450%22 fill=%22%23dfe8df%22/%3E%3C/svg%3E"></div><p class="field-mode-description">${longDescription}</p><div class="field-mode-info"><span>Materiali: palloni e cinesini</span><span>Dimensioni: 24 × 18 m</span></div>` },
]

for (const width of [1280, 1440]) for (const exercise of cases) test(`${exercise.name} remains in document flow at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 820 })
  await page.setContent(`<div class="sheet-backdrop"><section class="field-mode-sheet"><div class="field-mode-scroll"><header class="field-mode-header"><h1>Seduta tecnica</h1></header><div class="field-mode-main"><section class="field-mode-timer"><div><strong>10:00</strong></div><div class="field-mode-timer-actions"><button class="gp-button">Play</button><button class="gp-button">Reset</button><button class="gp-button">Ripristina</button></div><div class="field-mode-duration"><span>Durata</span><div><button class="gp-button">5</button><button class="gp-button">10</button></div></div></section><section class="field-mode-exercise"><h2>${exercise.name}</h2>${exercise.content}</section></div><nav class="field-mode-navigation"><button>Precedente</button><button>Successivo</button></nav><section class="field-mode-notes"><h2>Note</h2><textarea></textarea><div style="height:360px">Cronologia</div></section></div></section></div>`)
  await page.addStyleTag({ url: 'http://127.0.0.1:4173/src/styles/themes.css' })
  await page.addStyleTag({ url: 'http://127.0.0.1:4173/src/index.css' })

  const box = async (selector: string) => page.locator(selector).evaluate(element => element.getBoundingClientRect().toJSON())
  const main = await box('.field-mode-main'), navigation = await box('.field-mode-navigation'), notes = await box('.field-mode-notes')
  const timer = await box('.field-mode-timer'), content = await box('.field-mode-exercise'), clock = await box('.field-mode-timer strong'), actions = await box('.field-mode-timer-actions')
  expect(main.bottom).toBeLessThanOrEqual(navigation.top)
  expect(navigation.bottom).toBeLessThanOrEqual(notes.top)
  expect(content.bottom).toBeLessThanOrEqual(main.bottom)
  expect(content.bottom).toBeLessThanOrEqual(notes.top)
  expect(clock.bottom).toBeLessThanOrEqual(actions.top)
  expect(content.width).toBeGreaterThan(timer.width * 1.45)

  const scroll = page.locator('.field-mode-scroll')
  if (exercise.name !== 'breve') expect(await scroll.evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath(`${exercise.name}-${width}-top.png`) })
  await scroll.evaluate(element => { element.scrollTop = element.scrollHeight / 2 })
  await page.screenshot({ path: testInfo.outputPath(`${exercise.name}-${width}-middle.png`) })
  await scroll.evaluate(element => { element.scrollTop = element.scrollHeight })
  await expect(page.locator('.field-mode-notes')).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath(`${exercise.name}-${width}-bottom.png`) })
})
