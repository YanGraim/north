import { expect, type Page, test } from '@playwright/test'

/**
 * The North Server's admin page, against a real server on in-memory Postgres
 * (`server/src/dev-pglite.ts`: admin@north.test + Acme → Prod → Web { web-01,
 * web-02 } / Db { pg-01 }). Tests share that server, so each one uses its own
 * people and teams.
 */
const SERVER = 'http://127.0.0.1:5181'
const ADMIN = 'admin@north.test'

const unique = (name: string) =>
  `${name}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@acme.test`

const nav = (page: Page, name: string) =>
  page.getByRole('navigation').getByRole('link', { name, exact: false })

async function signIn(page: Page, email = ADMIN): Promise<void> {
  await page.goto(`${SERVER}/admin?lang=pt-BR`)
  await page.getByLabel('E-mail').fill(email)
  await page.getByRole('button', { name: 'Entrar' }).click()
  if (email === ADMIN) await expect(page.getByTestId('tab-overview')).toBeVisible()
}

/** Adds a person and lands on their page. */
async function addPerson(page: Page, email: string, name?: string): Promise<void> {
  await nav(page, 'Pessoas').click()
  await page.getByRole('button', { name: 'Adicionar pessoa' }).click()
  await page.getByLabel('E-mail', { exact: true }).fill(email)
  if (name) await page.getByLabel('Nome (opcional)').fill(name)
  await page.getByRole('button', { name: 'Adicionar', exact: true }).click()
  await expect(page.getByRole('heading', { name: name ?? email })).toBeVisible()
}

/** Signs a member in through the API, the way the desktop does. */
async function memberApi(page: Page, email: string) {
  const login = await page.request.post(`${SERVER}/api/v1/auth/dev/login`, { data: { email } })
  const headers = { authorization: `Bearer ${(await login.json()).accessToken}` }
  const get = async (path: string) =>
    (await page.request.get(`${SERVER}/api/v1/${path}`, { headers })).json()
  return {
    clients: () => get('clients'),
    groups: () => get('groups'),
    connections: () => get('connections')
  }
}

/** On a person's or team's page: pick a node in the tree and share it. */
async function share(page: Page, node: string, role: 'viewer' | 'editor' = 'viewer') {
  const picker = page.getByTestId('grant-picker')
  await picker.getByTestId(`project-${node}`).click()
  await picker.getByRole('combobox').selectOption(role)
  await picker.getByRole('button', { name: 'Liberar' }).click()
}

test('shows the organization name and the test sign-in notice', async ({ page }) => {
  await page.goto(`${SERVER}/admin?lang=pt-BR`)
  await expect(page.getByRole('heading', { name: 'Acme Test' })).toBeVisible()
  await expect(page.getByText('Login de teste por e-mail')).toBeVisible()
})

test('members cannot use the panel', async ({ page }) => {
  await signIn(page, unique('member'))
  await expect(page.getByTestId('login-error')).toContainText('Só admins usam este painel')
})

test('an admin adds a person, who then shows up as a member with no access', async ({ page }) => {
  await signIn(page)
  const email = unique('davi')
  await addPerson(page, email)
  await expect(page.getByRole('combobox', { name: 'Papel' }).first()).toHaveValue('member')
  await nav(page, 'Pessoas').click()
  await expect(page.getByTestId(`user-${email}`)).toContainText('sem acesso')
})

test('adding the same e-mail twice explains the conflict', async ({ page }) => {
  await signIn(page)
  const email = unique('dup')
  await addPerson(page, email)
  await nav(page, 'Pessoas').click()
  await page.getByRole('button', { name: 'Adicionar pessoa' }).click()
  await page.getByLabel('E-mail', { exact: true }).fill(email)
  await page.getByRole('button', { name: 'Adicionar', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'already exists' })).toBeVisible()
})

test('sharing one connection shows only it, read-only path included', async ({ page }) => {
  await signIn(page)
  const email = unique('vera')
  await addPerson(page, email)
  const member = await memberApi(page, email)
  expect(await member.clients()).toEqual([])

  await share(page, 'pg-01')
  await expect(page.getByTestId('grant-pg-01')).toContainText('Visualizador')
  await expect(page.getByTestId('grant-pg-01')).toContainText('Acme › Prod › Db')

  expect((await member.connections()).map((c: { name: string }) => c.name)).toEqual(['pg-01'])
  expect((await member.groups()).map((g: { name: string }) => g.name)).toEqual(['Db'])
})

test('a project shows who has access, inherited from above', async ({ page }) => {
  await signIn(page)
  const email = unique('edu')
  await addPerson(page, email)
  await share(page, 'Acme', 'editor')

  await nav(page, 'Projetos').click()
  await page.getByTestId('project-web-01').click()
  const panel = page.getByTestId('project-access')
  const inherited = panel.getByTestId(`grant-${email}`)
  await expect(inherited).toContainText('herdado de Acme')
  await expect(inherited).toContainText('Editor')
  await expect(inherited.getByRole('button', { name: 'Remover' })).toHaveCount(0)
  await expect(panel).not.toContainText('null')
  await expect(panel).not.toContainText('undefined')
})

test('removing access hides the project again', async ({ page }) => {
  await signIn(page)
  const email = unique('rui')
  await addPerson(page, email)
  await share(page, 'Web')
  await page.getByTestId('grant-Web').getByRole('button', { name: 'Remover' }).click()
  await expect(page.getByTestId('grant-Web')).toHaveCount(0)
  expect(await (await memberApi(page, email)).clients()).toEqual([])
})

test('a team shares a group with everyone in it, and leaving takes it away', async ({ page }) => {
  await signIn(page)
  const email = unique('tina')
  await addPerson(page, email)
  const member = await memberApi(page, email)

  const team = `Suporte ${Date.now()}`
  await nav(page, 'Equipes').click()
  await page.getByRole('button', { name: 'Nova equipe' }).click()
  await page.getByLabel('Nome da equipe').fill(team)
  await page.getByRole('button', { name: 'Criar' }).click()
  await expect(page.getByRole('heading', { name: team })).toBeVisible()

  await page.getByRole('combobox', { name: 'Adicionar pessoa…' }).selectOption({ label: email })
  await expect(page.getByTestId(`member-${email}`)).toBeVisible()
  await share(page, 'Web')
  await expect(page.getByTestId('grant-Web')).toBeVisible()
  expect((await member.connections()).map((c: { name: string }) => c.name).sort()).toEqual([
    'web-01',
    'web-02'
  ])

  // The person's page shows the team's access as coming from the team.
  await page.getByTestId(`member-${email}`).getByRole('link').click()
  await expect(page.getByTestId('grant-Web')).toContainText(`pela equipe ${team}`)

  await page.getByRole('button', { name: `Remover ${team}` }).click()
  await expect(page.getByTestId('grant-Web')).toHaveCount(0)
  expect(await member.connections()).toEqual([])
})

test('disabling a person cuts their sign-in', async ({ page }) => {
  await signIn(page)
  const email = unique('ida')
  await addPerson(page, email)
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Desativar' }).click()
  await expect(page.getByRole('button', { name: 'Reativar' })).toBeVisible()
  const login = await page.request.post(`${SERVER}/api/v1/auth/dev/login`, { data: { email } })
  expect(login.status()).toBe(401)
})

test('the audit lists access changes with who did them', async ({ page }) => {
  await signIn(page)
  const email = unique('aud')
  await addPerson(page, email)
  await share(page, 'Web')
  await expect(page.getByTestId('grant-Web')).toBeVisible()

  await nav(page, 'Auditoria').click()
  await page.getByLabel('Filtrar').fill(email)
  const row = page.getByTestId('audit-grant.set')
  await expect(row).toContainText('acesso dado')
  await expect(row).toContainText(ADMIN)
  await expect(row).toContainText(email)
  await expect(row).toContainText('grupo Web')
  await expect(page.getByTestId('audit-user.create')).toContainText('pessoa adicionada')
})

test('a reload keeps the admin signed in; signing out does not', async ({ page }) => {
  await signIn(page)
  await nav(page, 'Equipes').click()
  await page.reload()
  await expect(page.getByTestId('tab-teams')).toBeVisible()
  await page.getByRole('button', { name: 'Sair' }).click()
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible()
})

test('names typed by users are shown as text, never as HTML', async ({ page }) => {
  await signIn(page)
  const email = unique('xss')
  const name = '<img src=x onerror="window.__pwned=1">'
  await addPerson(page, email, name)
  await nav(page, 'Pessoas').click()
  await expect(page.getByTestId(`user-${email}`).getByText(name)).toBeVisible()
  expect(
    await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned)
  ).toBeUndefined()
})

test('works in English', async ({ page }) => {
  await page.goto(`${SERVER}/admin?lang=en`)
  await page.getByLabel('E-mail').fill(ADMIN)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(nav(page, 'People')).toBeVisible()
  await expect(nav(page, 'Teams')).toBeVisible()
  await expect(nav(page, 'Audit')).toBeVisible()
})
