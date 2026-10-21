import { expect, type Page, test } from '@playwright/test'

/**
 * The admin panel signing in with "Microsoft" — a real North Server plus the
 * fake Entra provider (`server/src/dev/fake-oidc.ts`, port 5184): authorization
 * code + PKCE from the browser, the id_token checked by the server.
 */
const SERVER = 'http://127.0.0.1:5183'
const ADMIN = 'admin@north.test'

/** Fills the fake Microsoft page and comes back to the panel. */
async function microsoft(page: Page, email: string): Promise<void> {
  await page.getByRole('button', { name: 'Entrar com a Microsoft' }).click()
  await expect(page).toHaveTitle('Fake Entra')
  await page.getByLabel('E-mail').fill(email)
  await page.getByRole('button', { name: 'Entrar' }).click()
}

test('offers Microsoft first, and the test e-mail only as a fallback', async ({ page }) => {
  await page.goto(`${SERVER}/admin?lang=pt-BR`)
  await expect(page.getByRole('button', { name: 'Entrar com a Microsoft' })).toBeFocused()
  await expect(page.getByText('ou, num servidor de teste, entre por e-mail:')).toBeVisible()
})

test('an admin signs in with Microsoft and lands on the panel', async ({ page }) => {
  await page.goto(`${SERVER}/admin?lang=pt-BR`)
  await microsoft(page, ADMIN)
  await expect(page.getByRole('tab', { name: 'Pessoas' })).toBeVisible()
  await expect(page.locator('.who')).toHaveText(ADMIN)
  // The one-time code never stays in the address bar.
  expect(new URL(page.url()).searchParams.has('code')).toBe(false)
  expect(new URL(page.url()).searchParams.get('lang')).toBe('pt-BR')
})

test('the session survives a reload', async ({ page }) => {
  await page.goto(`${SERVER}/admin?lang=pt-BR`)
  await microsoft(page, ADMIN)
  await expect(page.getByRole('tab', { name: 'Pessoas' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('tab', { name: 'Pessoas' })).toBeVisible()
})

test('a member signing in with Microsoft is told the panel is for admins', async ({ page }) => {
  await page.goto(`${SERVER}/admin?lang=pt-BR`)
  await microsoft(page, `member-${Date.now()}@acme.test`)
  await expect(page.getByTestId('login-error')).toContainText('Só admins usam este painel')
})

test('a forged callback (wrong state) is refused', async ({ page }) => {
  await page.goto(`${SERVER}/admin/?lang=pt-BR&code=stolen&state=forged`)
  await expect(page.getByTestId('login-error')).toContainText('O login não confere')
  expect(new URL(page.url()).searchParams.has('code')).toBe(false)
})

test('shows the AADSTS code when Microsoft refuses', async ({ page }) => {
  await page.goto(
    `${SERVER}/admin/?lang=pt-BR&error=access_denied&error_description=AADSTS50105%3A+not+assigned`
  )
  await expect(page.getByTestId('login-error')).toContainText(
    'A Microsoft recusou o login (AADSTS50105)'
  )
})

test('the panel sends the Microsoft page a PKCE challenge and no secret', async ({ page }) => {
  await page.goto(`${SERVER}/admin?lang=pt-BR`)
  const request = page.waitForRequest((r) => r.url().includes('/oauth2/v2.0/authorize'))
  await page.getByRole('button', { name: 'Entrar com a Microsoft' }).click()
  const params = new URL((await request).url()).searchParams
  expect(params.get('code_challenge_method')).toBe('S256')
  expect(params.get('redirect_uri')).toBe(`${SERVER}/admin/`)
  expect(params.get('client_secret')).toBeNull()
})
