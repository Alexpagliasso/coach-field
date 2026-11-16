import { expect, test } from '@playwright/test'

async function mount(page: import('@playwright/test').Page) {
  await page.setContent(`<main><button class="gp-button" id="action">Azione</button><button class="gp-button" id="disabled" disabled>Disabilitato</button><article class="gp-card training-archive-card"><button class="training-archive-card-main">Apri scheda</button></article><table class="players-data-table"><tbody><tr><td><button>Apri giocatore</button></td></tr></tbody></table><button role="tab" id="tab">Dettagli</button><select id="filter"><option>Tutti</option></select><a href="#target" id="link">Naviga</a></main>`)
  await page.addStyleTag({ url: 'http://127.0.0.1:4173/src/styles/themes.css' })
  await page.addStyleTag({ url: 'http://127.0.0.1:4173/src/index.css' })
}

test('semantic interactions expose hover focus active and disabled feedback', async ({ page }) => {
  await mount(page)
  for (const selector of ['#action', '.training-archive-card-main', '#tab', '#filter', '#link']) {
    expect(await page.locator(selector).evaluate(element => getComputedStyle(element).cursor)).toBe('pointer')
  }
  expect(await page.locator('#disabled').evaluate(element => getComputedStyle(element).cursor)).not.toBe('pointer')

  const card = page.locator('.training-archive-card')
  const initialTransform = await card.evaluate(element => getComputedStyle(element).transform)
  await page.locator('.training-archive-card-main').hover()
  await expect.poll(() => card.evaluate(element => getComputedStyle(element).transform)).not.toBe(initialTransform)

  await page.locator('#tab').focus()
  expect(await page.locator('#tab').evaluate(element => getComputedStyle(element).outlineStyle)).not.toBe('none')
  await page.locator('#action').hover()
  await page.mouse.down()
  expect(await page.locator('#action').evaluate(element => getComputedStyle(element).transform)).not.toBe('none')
  await page.mouse.up()
})

test('reduced motion removes transforms and transitions', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await mount(page)
  await page.locator('.training-archive-card-main').hover()
  expect(await page.locator('.training-archive-card').evaluate(element => getComputedStyle(element).transform)).toBe('none')
  expect(parseFloat(await page.locator('.gp-button').first().evaluate(element => getComputedStyle(element).transitionDuration))).toBeLessThanOrEqual(.001)
})
