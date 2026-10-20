import { expect, type Page, test } from '@playwright/test'

/**
 * The North Server's admin page, against a real server on in-memory Postgres
 * (`server/src/dev-pglite.ts`: admin@north.test + Acme → Prod → Web / Db).
 * Tests share that server, so each one uses its own people.
 */
const SERVER = 'http://127.0.0.1:5181'
const ADMIN = 'admin@north.test'

const unique = (name: string) =>
  `${name}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@acme.test`

async function signIn(page: Page, email = ADMIN): Promise<void> {
  await page.goto(`${SERVER}/admin?lang=pt-BR`)
  await page.getByLabel('E-mail').fill(email)
  await page.getByRole('button', { name: 'Entrar' }).click()
  if (email === ADMIN) await expect(page.getByRole('tab', { name: 'Pessoas' })).toBeVisible()
}

async function addPerson(page: Page, email: string): Promise<void> {
  await page.getByRole('tab', { name: 'Pessoas' }).click()
  await page.getByLabel('E-mail', { exact: true }).fill(email)
  await page.getByRole('button', { name: 'Adicionar' }).click()
  await expect(page.getByTestId(`user-${email}`)).toBeVisible()
}

/** Signs a member in through the API, the way the desktop does. */
async function memberApi(page: Page, email: string) {
  const login = await page.request.post(`${SERVER}/api/v1/auth/dev/login`, { data: { email } })
  const headers = { authorization: `Bearer ${(await login.json()).accessToken}` }
  return {
    clients: async () => (await page.request.get(`${SERVER}/api/v1/clients`, { headers })).json(),
    groups: async () => (await page.request.get(`${SERVER}/api/v1/groups`, { headers })).json()
  }
}

test('shows the organization name and the test sign-in notice', async ({ page }) => {
  await page.goto(`${SERVER}/admin?lang=pt-BR`)
  await expect(page.getByRole('heading', { name: 'Acme Test' })).toBeVisible()
  await expect(page.getByText('Login de teste por e-mail')).toBeVisible()
})

test('a project shows who has access, and never prints empty values', async ({ page }) => {
  await signIn(page)
  await page.getByRole('tab', { name: 'Projetos' }).click()
  await page.getByTestId('project-Web').click()
  const panel = page.getByTestId('project-access')
  await expect(panel).toContainText('Web · Quem tem acesso')
  await expect(panel).not.toContainText('null')
  await expect(panel).not.toContainText('undefined')
})

test('members cannot use the panel', async ({ page }) => {
  await signIn(page, unique('member'))
  await expect(page.getByTestId('login-error')).toContainText('Só admins usam este painel')
})

test('an admin adds a person, who then shows up as a member', async ({ page }) => {
  await signIn(page)
  const email = unique('davi')
  await addPerson(page, email)
  const row = page.getByTestId(`user-${email}`)
  await expect(row.getByRole('combobox')).toHaveValue('member')
  await expect(row).toContainText('Ativo')
})

test('adding the same e-mail twice explains the conflict', async ({ page }) => {
  await signIn(page)
  const email = unique('dup')
  await addPerson(page, email)
  await page.getByLabel('E-mail', { exact: true }).fill(email)
  await page.getByRole('button', { name: 'Adicionar' }).click()
  await expect(page.getByTestId('people-error')).toContainText('already exists')
})

test('giving viewer access on a group lets the person see only that project', async ({ page }) => {
  await signIn(page)
  const email = unique('vera')
  await addPerson(page, email)
  const member = await memberApi(page, email)
  expect(await member.clients()).toEqual([])

  await page.getByRole('tab', { name: 'Projetos' }).click()
  await page.getByTestId('project-Web').click()
  await page.getByLabel('Pessoa').selectOption({ label: email })
  await page.getByLabel('Papel').selectOption('viewer')
  await page.getByRole('button', { name: 'Dar acesso' }).click()
  await expect(page.getByTestId(`grant-${email}`)).toContainText('Visualizador')

  expect((await member.groups()).map((g: { name: string }) => g.name)).toEqual(['Web'])
})

test('access given on a client shows as inherited on its groups', async ({ page }) => {
  await signIn(page)
  const email = unique('edu')
  await addPerson(page, email)
  await page.getByRole('tab', { name: 'Projetos' }).click()
  await page.getByTestId('project-Acme').click()
  await page.getByLabel('Pessoa').selectOption({ label: email })
  await page.getByLabel('Papel').selectOption('editor')
  await page.getByRole('button', { name: 'Dar acesso' }).click()
  await expect(page.getByTestId(`grant-${email}`)).toContainText('Editor')

  await page.getByTestId('project-Db').click()
  const inherited = page.getByTestId(`grant-${email}`)
  await expect(inherited).toContainText('herdado de Acme')
  await expect(inherited.getByRole('button', { name: 'Remover' })).toHaveCount(0)
})

test('removing access hides the project again', async ({ page }) => {
  await signIn(page)
  const email = unique('rui')
  await addPerson(page, email)
  await page.getByRole('tab', { name: 'Projetos' }).click()
  await page.getByTestId('project-Web').click()
  await page.getByLabel('Pessoa').selectOption({ label: email })
  await page.getByRole('button', { name: 'Dar acesso' }).click()
  await page.getByTestId(`grant-${email}`).getByRole('button', { name: 'Remover' }).click()
  await expect(page.getByTestId(`grant-${email}`)).toHaveCount(0)
  expect(await (await memberApi(page, email)).clients()).toEqual([])
})

test('disabling a person cuts their sign-in', async ({ page }) => {
  await signIn(page)
  const email = unique('ida')
  await addPerson(page, email)
  await page.getByTestId(`user-${email}`).getByRole('button', { name: 'Desativar' }).click()
  await expect(page.getByTestId(`user-${email}`)).toContainText('Desativado')
  const login = await page.request.post(`${SERVER}/api/v1/auth/dev/login`, { data: { email } })
  expect(login.status()).toBe(401)
})

test('the audit lists access changes with who did them', async ({ page }) => {
  await signIn(page)
  const email = unique('aud')
  await addPerson(page, email)
  await page.getByRole('tab', { name: 'Projetos' }).click()
  await page.getByTestId('project-Web').click()
  await page.getByLabel('Pessoa').selectOption({ label: email })
  await page.getByRole('button', { name: 'Dar acesso' }).click()
  await expect(page.getByTestId(`grant-${email}`)).toBeVisible()

  await page.getByRole('tab', { name: 'Auditoria' }).click()
  await page.getByLabel('Filtrar').fill(email)
  const row = page.getByTestId('audit-grant.set')
  await expect(row).toContainText('acesso dado')
  await expect(row).toContainText(ADMIN)
  await expect(row).toContainText(email)
  await expect(page.getByTestId('audit-user.create')).toContainText('pessoa adicionada')
})

test('a reload keeps the admin signed in; signing out does not', async ({ page }) => {
  await signIn(page)
  await expect(page.getByRole('tab', { name: 'Pessoas' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('tab', { name: 'Pessoas' })).toBeVisible()
  await page.getByRole('button', { name: 'Sair' }).click()
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible()
})

test('names typed by users are shown as text, never as HTML', async ({ page }) => {
  await signIn(page)
  const email = unique('xss')
  const name = '<img src=x onerror="window.__pwned=1">'
  await page.getByLabel('E-mail', { exact: true }).fill(email)
  await page.getByLabel('Nome (opcional)').fill(name)
  await page.getByRole('button', { name: 'Adicionar' }).click()
  await expect(page.getByTestId(`user-${email}`).getByText(name)).toBeVisible()
  expect(
    await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned)
  ).toBeUndefined()
})

test('works in English', async ({ page }) => {
  await page.goto(`${SERVER}/admin?lang=en`)
  await page.getByLabel('E-mail').fill(ADMIN)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('tab', { name: 'People' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Audit' })).toBeVisible()
})
