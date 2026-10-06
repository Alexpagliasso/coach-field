import { expect, test, type Page } from '@playwright/test'
test('public home, login, missing config, protected deep link and no blank screen', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /Il campo ti dice/ })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Accedi', exact: true })).toBeVisible()
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: 'Login staff' })).toBeVisible()
  await expect(page.getByRole('alert')).toContainText('Supabase non configurato')
  await expect(page.getByRole('button', { name: /accedi/i })).toBeDisabled()
  await page.goto('/app/unknown/players/unknown')
  await expect(page).toHaveURL(/\/login$/)
  expect(errors).toEqual([])
})

test('public product home is responsive and its navigation remains usable', async ({ page }) => {
  for (const viewport of [{ width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1280, height: 800 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport)
    await page.goto('/')
    await expect(page.getByRole('heading', { name: /Il campo ti dice/ })).toBeVisible()
    await expect(page.getByRole('link', { name: /Entra in Coach Field/ }).first()).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false)
  }
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.getByRole('link', { name: 'Metodo', exact: true }).click()
  await expect(page).toHaveURL(/#metodo$/)
  await expect(page.getByRole('heading', { name: 'Ogni dettaglio diventa evoluzione.' })).toBeInViewport()
  await page.getByRole('link', { name: 'Accedi', exact: true }).click()
  await expect(page).toHaveURL(/\/login$/)
})

const uid = '00000000-0000-0000-0000-000000000001'
const org = '10000000-0000-0000-0000-000000000001'
const a = '20000000-0000-0000-0000-000000000001', b = '20000000-0000-0000-0000-000000000002'
async function mockCloud(page: Page, role: 'coach' | 'collaborator' | 'admin' = 'coach', failure?: 'profile' | 'groups') {
  const user = { id: uid, email: 'staff@test.local', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() }
  const token = `${Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: uid, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.fixture`
  await page.route('https://fixture.supabase.co/**', async route => {
    const url = new URL(route.request().url())
    if (failure === 'groups' && url.pathname.endsWith('/groups')) { await route.fulfill({ status: 400, json: { code: 'PGRST000', message: 'Rete gruppi non disponibile' } }); return }
    let data: unknown = []
    if (url.pathname.includes('/auth/v1/token')) data = { access_token: token, refresh_token: 'fixture-refresh', token_type: 'bearer', expires_in: 3600, user }
    else if (url.pathname.includes('/auth/v1/user')) data = user
    else if (url.pathname.includes('/profiles')) data = failure === 'profile' ? null : url.searchParams.has('id') ? { ...user, first_name: 'Staff' } : [{ ...user, first_name: 'Staff' }]
    else if (url.pathname.endsWith('/organizations')) data = [{ id: org, name: 'Club test', slug: 'club' }]
    else if (url.pathname.endsWith('/organization_memberships')) data = role === 'admin' ? [{ id: 'org-admin', organization_id: org, user_id: uid, role: 'admin', active: true }] : []
    else if (url.pathname.endsWith('/groups')) data = [{ id: a, organization_id: org, name: 'Gruppo A', active: true }, { id: b, organization_id: org, name: 'Gruppo B', active: true }]
    else if (url.pathname.endsWith('/group_memberships')) data = role === 'admin' ? [] : [a, b].map((id, index) => ({ id: `member-${index}`, organization_id: org, group_id: id, user_id: uid, role, active: true }))
    await route.fulfill({ json: data })
  })
  await page.goto('http://127.0.0.1:4174/login')
  await page.getByLabel('Email', { exact: true }).fill('staff@test.local')
  await page.getByLabel('Password', { exact: true }).fill('fixture-password')
  await page.getByRole('button', { name: /accedi/i }).click()
  if (!failure) await expect(page.getByRole('heading', { name: 'I tuoi gruppi' })).toBeVisible()
}
test('mock staff login, explicit binding, V1–V4 pages, group isolation and logout', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await mockCloud(page)
  await page.evaluate(async () => {
    const request = indexedDB.open('coach-field-db')
    const db = await new Promise<IDBDatabase>((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
    const tx = db.transaction('players', 'readwrite')
    tx.objectStore('players').put({ id: 'fixture-player', firstName: 'Fixture', lastName: 'Player', year: 2016, previousRoles: [], rating: null, idealRoles: [], goalkeeperCandidate: false })
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error) })
    db.close()
  })
  await page.getByRole('button', { name: /entra nel gruppo/i }).first().click()
  await expect(page.getByRole('button', { name: 'Associa al gruppo attuale' })).toBeVisible()
  page.on('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'Associa al gruppo attuale' }).click()
  await expect(page.getByRole('heading', { name: 'Primo allenamento', exact: false })).toBeVisible()
  await page.getByRole('link', { name: 'Giocatori', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Giocatori', exact: true })).toBeVisible()
  const playerLink = page.locator('a.player-row').first()
  const playerName = await playerLink.locator('strong').textContent()
  await playerLink.click()
  await expect(page.getByRole('button', { name: 'Panoramica', exact: true })).toBeVisible()
  for (const tab of ['Timeline', 'Obiettivi', 'Storico']) {
    await page.getByLabel('Sezioni profilo').getByRole('button', { name: tab, exact: true }).click()
    await expect(page.getByRole('heading', { name: playerName!, exact: true })).toBeVisible()
  }
  for (const [path, heading] of [['matches', 'Partite'], ['training', 'Training'], ['notes', 'Note']]) {
    await page.goto(`http://127.0.0.1:4174/app/${a}/${path}`)
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible()
  }
  await page.getByRole('link', { name: 'Cambia gruppo' }).click()
  await page.getByRole('button', { name: /entra nel gruppo/i }).nth(1).click()
  await expect(page.getByText('Nessun dato locale per questo gruppo.', { exact: false })).toBeVisible()
  await page.goto(`http://127.0.0.1:4174/app/${b}/players`)
  await expect(page.getByText(playerName!, { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Esci', exact: true }).click()
  await expect(page).toHaveURL(/\/login$/)
  expect(errors).toEqual([])
})
test('collaborator cannot bind or access staff/admin; denied deep links remain readable', async ({ page }) => {
  await mockCloud(page, 'collaborator')
  await page.getByRole('button', { name: /entra nel gruppo/i }).first().click()
  await expect(page.getByRole('button', { name: 'Associa al gruppo attuale' })).toHaveCount(0)
  await page.goto(`http://127.0.0.1:4174/app/${a}/staff`)
  await expect(page.getByRole('alert')).toHaveText('Permesso negato.')
  await page.goto('http://127.0.0.1:4174/admin')
  await expect(page.getByRole('alert')).toContainText('Accesso riservato')
})
test('organization admin sees groups without group memberships', async ({ page }) => {
  await mockCloud(page, 'admin')
  await page.getByRole('link', { name: 'Amministrazione', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Nuovo gruppo' })).toBeVisible()
  await expect(page.getByText('Gruppo A', { exact: true })).toBeVisible()
  await expect(page.getByText('Gruppo B', { exact: true })).toBeVisible()
})
test('four themes, focus treatment and mobile layout stay usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await mockCloud(page)
  await page.getByRole('button', { name: /entra nel gruppo/i }).first().click()
  for (const theme of ['Pitch', 'Electric', 'Purple', 'Ice', 'Light']) {
    await page.getByRole('button', { name: 'Tema' }).click()
    await page.getByRole('button', { name: new RegExp(`^${theme}`) }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme.toLowerCase())
    await page.getByRole('button', { name: 'Chiudi tema' }).click()
    const overflows = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
    expect(overflows).toBe(false)
  }
  await page.keyboard.press('Tab')
  const focused = page.locator(':focus-visible')
  await expect(focused).toBeVisible()
  expect(await focused.evaluate(element => getComputedStyle(element).boxShadow)).not.toBe('none')
  await expect(page.getByRole('navigation', { name: 'Navigazione principale' })).toBeVisible()
})
test('authenticated UI lab renders foundation controls without responsive overflow', async ({ page }) => {
  await mockCloud(page)
  await page.goto('http://127.0.0.1:4174/app/ui-lab')
  await expect(page.getByRole('heading', { name: 'Sport-tech, leggibile, pronto per il campo.' })).toBeVisible()
  await expect(page.getByText('Palette semantica')).toBeVisible()
  await expect(page.getByText('MATCH DAY · U10')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Cambia tema' })).toBeVisible()
  await page.keyboard.press('Tab')
  await expect(page.locator(':focus-visible')).toBeVisible()
  for (const width of [390, 768, 1280]) {
    await page.setViewportSize({ width, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false)
  }
  await page.getByRole('button', { name: 'Cambia tema' }).click()
  await page.getByRole('button', { name: /^Light/ }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await page.getByRole('button', { name: 'Chiudi tema' }).click()
  await page.getByRole('button', { name: 'Esci' }).click()
  await expect(page).toHaveURL(/\/login$/)
})
test('mobile quick observations work for match team and training player', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await mockCloud(page)
  await page.evaluate(async () => {
    const request = indexedDB.open('coach-field-db')
    const db = await new Promise<IDBDatabase>((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
    const tx = db.transaction('players', 'readwrite')
    tx.objectStore('players').put({ id: 'fixture-player', firstName: 'Fixture', lastName: 'Player', year: 2016, previousRoles: [], rating: null, idealRoles: [], goalkeeperCandidate: false })
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error) })
    db.close()
  })
  await page.getByRole('button', { name: /entra nel gruppo/i }).first().click()
  page.on('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'Associa al gruppo attuale' }).click()
  await expect(page.getByRole('button', { name: 'Associa al gruppo attuale' })).toHaveCount(0)
  await page.goto(`http://127.0.0.1:4174/app/${a}/matches`)
  await page.getByRole('button', { name: 'Nuova partita', exact: true }).click()
  await page.getByLabel('Avversario *').fill('Test Match')
  await page.getByRole('button', { name: 'Crea partita' }).click()
  await page.getByRole('button', { name: '+ Osservazione' }).click()
  await page.getByLabel('Osservazione', { exact: true }).fill('Osservazione squadra E2E')
  await page.getByRole('button', { name: 'Salva osservazione' }).click()
  await expect(page.getByText('Osservazione salvata')).toBeVisible()
  await page.goto(`http://127.0.0.1:4174/app/${a}/training/first-training-2016-2017`)
  await page.getByRole('button', { name: '+ Osservazione' }).click()
  await page.getByRole('button', { name: 'Giocatore', exact: true }).click()
  await page.getByLabel('Giocatore').selectOption('fixture-player')
  await page.getByLabel('Osservazione', { exact: true }).fill('Osservazione giocatore E2E')
  await page.getByRole('button', { name: 'Salva osservazione' }).click()
  await expect(page.getByText('Osservazione salvata')).toBeVisible()
  await page.goto(`http://127.0.0.1:4174/app/${a}/notes`)
  await expect(page.getByText('Osservazione squadra E2E')).toBeVisible()
  await expect(page.getByText('Osservazione giocatore E2E')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false)
})
test('wrong credentials have a readable error', async ({ page }) => {
  await page.route('https://fixture.supabase.co/auth/v1/token**', route => route.fulfill({ status: 400, json: { error: 'invalid_grant', error_description: 'Invalid login credentials' } }))
  await page.goto('http://127.0.0.1:4174/login')
  await page.getByLabel('Email', { exact: true }).fill('wrong@test.local')
  await page.getByLabel('Password', { exact: true }).fill('wrong-password')
  await page.getByRole('button', { name: /accedi/i }).click()
  await expect(page.getByRole('alert')).toContainText('Email o password non corrette')
})
test('missing profile is readable and never opens private content', async ({ page }) => {
  await mockCloud(page, 'coach', 'profile')
  await expect(page.getByRole('alert')).toContainText('Profilo staff mancante')
  await expect(page.getByRole('heading', { name: 'I tuoi gruppi' })).toHaveCount(0)
})
test('cloud group error and unauthorized group deep link are readable', async ({ page }) => {
  await mockCloud(page, 'coach', 'groups')
  await expect(page.getByRole('alert')).toContainText('Rete gruppi non disponibile')
  await page.unroute('https://fixture.supabase.co/**')
  await page.evaluate(() => localStorage.clear())
  await mockCloud(page)
  await page.goto('http://127.0.0.1:4174/app/unknown/players')
  await expect(page.getByText('Gruppo non disponibile o accesso negato.')).toBeVisible()
})
