import { expect, type Page, test } from '@playwright/test'

/** Org dataset of e2e-harness/mock-north.ts; `?role=` sets the signed-in user's role. */
const ORG_CONNECTION = 'c4000000-0000-4000-8000-000000000004'
const LOCAL_CONNECTION = 'b5000000-0000-4000-8000-000000000005'

async function openDetails(
  page: Page,
  role: string,
  workspace = 'acme',
  connectionId = ORG_CONNECTION
): Promise<void> {
  await page.goto(`/w/${workspace}/connections?scenario=app&workspaces=org&role=${role}`)
  await page.getByTestId(`inventory-item-connection-${connectionId}`).click()
  await expect(page.getByRole('button', { name: 'Conectar' })).toBeVisible()
}

const editButton = (page: Page) => page.getByRole('button', { name: 'Editar', exact: true })
const newClientButton = (page: Page) => page.getByRole('button', { name: 'Novo cliente' })

async function moreActions(page: Page, where = 'connection-details-panel'): Promise<string[]> {
  await page.getByTestId(where).getByRole('button', { name: 'Mais ações' }).click()
  const items = await page.getByRole('menuitem').allInnerTexts()
  await page.keyboard.press('Escape')
  return items.map((s) => s.trim())
}

async function treeMenu(page: Page, name: string): Promise<string[]> {
  await page.getByRole('link', { name, exact: true }).first().click({ button: 'right' })
  const items = await page.getByRole('menuitem').allInnerTexts()
  await page.keyboard.press('Escape')
  return items.map((s) => s.trim())
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('e2e-booted')) {
      localStorage.clear()
      sessionStorage.setItem('e2e-booted', '1')
    }
  })
})

test.describe('viewer', () => {
  test('connects but has no edit, duplicate or delete', async ({ page }) => {
    await openDetails(page, 'viewer')
    await expect(page.getByRole('button', { name: 'Conectar' })).toBeEnabled()
    await expect(editButton(page)).toHaveCount(0)
    const items = await moreActions(page)
    expect(items).toContain('Copiar IP')
    expect(items).not.toContain('Duplicar')
    expect(items).not.toContain('Excluir')
    const listItems = await moreActions(page, 'list')
    expect(listItems).toContain('Copiar IP')
    expect(listItems).not.toContain('Editar')
    expect(listItems).not.toContain('Excluir')
  })

  test('cannot add clients', async ({ page }) => {
    await openDetails(page, 'viewer')
    await expect(newClientButton(page)).toHaveCount(0)
  })

  test('right-clicking a project offers nothing to change', async ({ page }) => {
    await openDetails(page, 'viewer')
    expect(await treeMenu(page, 'Acme Cloud')).toEqual([])
  })

  test('the connection menu keeps favorite and copy, not edit', async ({ page }) => {
    await openDetails(page, 'viewer')
    await page.getByTestId(`inventory-item-connection-${ORG_CONNECTION}`).click({ button: 'right' })
    const items = (await page.getByRole('menuitem').allInnerTexts()).map((s) => s.trim())
    expect(items).toEqual(expect.arrayContaining(['Conectar', 'Copiar IP', 'Favoritar']))
    expect(items).not.toContain('Editar')
    expect(items).not.toContain('Excluir')
  })
})

test.describe('editor of a group', () => {
  test('edits the connections in it', async ({ page }) => {
    await openDetails(page, 'editor')
    await expect(editButton(page)).toBeVisible()
    expect(await moreActions(page)).toEqual(expect.arrayContaining(['Duplicar', 'Excluir']))
  })

  test('adds connections to the group, but not clients or environments', async ({ page }) => {
    await openDetails(page, 'editor')
    await expect(newClientButton(page)).toHaveCount(0)
    expect(await treeMenu(page, 'Acme Cloud')).toEqual([])
    await page.getByRole('link', { name: 'Acme Cloud', exact: true }).first().click()
    await page.getByRole('link', { name: 'Produção', exact: true }).first().click()
    expect(await treeMenu(page, 'Kubernetes')).toEqual(
      expect.arrayContaining(['Nova conexão', 'Editar', 'Excluir'])
    )
  })
})

test.describe('member without access', () => {
  test('sees an empty tree that says to ask an admin', async ({ page }) => {
    await page.goto('/w/acme/connections?scenario=app&workspaces=org&role=none')
    await expect(page.getByTestId('no-projects-granted')).toContainText('Peça acesso a um admin')
    await expect(page.getByRole('button', { name: 'Criar cliente' })).toHaveCount(0)
  })
})

test.describe('admin', () => {
  test('keeps every action', async ({ page }) => {
    await openDetails(page, 'admin')
    await expect(editButton(page)).toBeVisible()
    await expect(newClientButton(page)).toBeVisible()
    expect(await treeMenu(page, 'Acme Cloud')).toEqual(
      expect.arrayContaining(['Novo ambiente', 'Editar', 'Excluir'])
    )
  })
})

test('the personal workspace ignores organization roles', async ({ page }) => {
  await openDetails(page, 'viewer', 'local', LOCAL_CONNECTION)
  await expect(editButton(page)).toBeVisible()
  await expect(newClientButton(page)).toBeVisible()
})
