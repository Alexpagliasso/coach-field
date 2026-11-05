import { expect, test } from '@playwright/test'

test.use({ hasTouch: true })

const fixture = `<div class="sheet-backdrop"><section class="field-mode-sheet"><div class="field-mode-scroll"><header class="field-mode-header"><h1>Timer iPhone</h1></header><section class="field-mode-timer"><div><p id="timer-status">Timer in pausa</p><strong data-testid="field-timer-value">05:00</strong><small id="timer-duration">5 min previsti</small></div><div class="field-mode-timer-actions"><button type="button" class="gp-button" id="toggle" aria-label="Avvia">Avvia</button><button type="button" class="gp-button" id="reset" aria-label="Reset timer">Reset</button><button type="button" class="gp-button" id="set-duration">Imposta timer a 5 minuti</button></div></section><nav class="field-mode-navigation">${[5, 15, 25, 45].map(value => `<button type="button" class="gp-button duration" data-minutes="${value}">${value} min</button>`).join('')}</nav></div></section></div>
<script>
let duration=300,remaining=300,running=false,tick
const value=document.querySelector('[data-testid="field-timer-value"]'),status=document.querySelector('#timer-status'),toggle=document.querySelector('#toggle'),setButton=document.querySelector('#set-duration')
const draw=()=>{value.textContent=String(Math.floor(remaining/60)).padStart(2,'0')+':'+String(remaining%60).padStart(2,'0');status.textContent=running?'Timer attivo':'Timer in pausa';toggle.textContent=running?'Pausa':remaining<duration?'Riprendi':'Avvia';toggle.setAttribute('aria-label',toggle.textContent)}
document.querySelectorAll('.duration').forEach(button=>button.addEventListener('click',()=>{const minutes=Number(button.dataset.minutes);setButton.textContent='Imposta timer a '+minutes+' minuti';setButton.dataset.minutes=String(minutes);document.querySelector('#timer-duration').textContent=minutes+' min previsti'}))
setButton.addEventListener('click',()=>{clearInterval(tick);running=false;duration=Number(setButton.dataset.minutes||5)*60;remaining=duration;draw()})
toggle.addEventListener('click',()=>{running=!running;clearInterval(tick);if(running)tick=setInterval(()=>{remaining=Math.max(0,remaining-1);if(!remaining){running=false;clearInterval(tick)}draw()},250);draw()})
document.querySelector('#reset').addEventListener('click',()=>{clearInterval(tick);running=false;remaining=duration;draw()})
</script>`

for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
  test(`timer controls work at ${viewport.width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport)
    await page.setContent(fixture)
    await page.addStyleTag({ url: 'http://127.0.0.1:4173/src/index.css' })
    const value = page.getByTestId('field-timer-value')
    for (const minutes of [5, 15, 25, 45]) {
      await page.getByRole('button', { name: `${minutes} min`, exact: true }).click()
      await page.getByRole('button', { name: `Imposta timer a ${minutes} minuti` }).click()
      await expect(value).toHaveText(`${String(minutes).padStart(2, '0')}:00`)
    }
    await page.getByRole('button', { name: 'Avvia' }).click()
    await expect.poll(async () => await value.textContent()).not.toBe('45:00')
    await page.getByRole('button', { name: 'Pausa' }).click()
    const paused = await value.textContent()
    await page.waitForTimeout(350)
    await expect(value).toHaveText(paused ?? '')
    await page.getByRole('button', { name: 'Riprendi' }).click()
    await expect.poll(async () => await value.textContent()).not.toBe(paused)
    await page.getByRole('button', { name: 'Pausa' }).click()
    await page.getByRole('button', { name: 'Reset timer' }).click()
    await expect(value).toHaveText('45:00')
    for (const control of await page.locator('.field-mode-timer-actions .gp-button').all()) expect((await control.boundingBox())?.height).toBeGreaterThanOrEqual(44)
    if (viewport.width === 390) expect(await page.locator('.field-mode-timer').evaluate(element => getComputedStyle(element).position)).toBe('relative')
    await page.screenshot({ path: testInfo.outputPath(`field-timer-${viewport.width}.png`), fullPage: true })
  })
}
