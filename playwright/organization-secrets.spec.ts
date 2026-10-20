import { expect, type Page, test } from '@playwright/test'

/** Org dataset of e2e-harness/mock-north.ts (`applyOrganizationOverlay`). */
const ORG_CONNECTION = 'c4000000-0000-4000-8000-000000000004'
const LOCAL_CONNECTION = 'b5000000-0000-4000-8000-000000000005'
const ORG_HINT = 'Fica criptografada no servidor da organização'

const orgVaultCalls = (page: Page) =>
  page.evaluate(
    () => (window as unknown as { __e2eOrgVault: Array<{ method: string }> }).__e2eOrgVault
  )

async function openDetails(page: Page, workspace: string, connectionId: string): Promise<void> {
  await page.goto(`/w/${workspace}/connections?scenario=app&workspaces=org`)
  await page.getByTestId(`inventory-item-connection-${connectionId}`).click()
  await expect(page.getByRole('button', { name: 'Conectar' })).toBeVisible()
}

async function openEdit(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Editar' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
}

async function setOrgPassword(page: Page, password = 'org-secret'): Promise<void> {
  await openDetails(page, 'acme', ORG_CONNECTION)
  await openEdit(page)
  await page.getByRole('dialog').getByLabel('Senha', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Salvar' }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('e2e-booted')) {
      localStorage.clear()
      sessionStorage.setItem('e2e-booted', '1')
    }
  })
})

test.describe('passwords in an organization', () => {
  test('the password field says it is kept on the organization server', async ({ page }) => {
    await openDetails(page, 'acme', ORG_CONNECTION)
    await openEdit(page)
    await expect(page.getByRole('dialog')).toContainText(ORG_HINT)
    await expect(page.getByRole('dialog')).not.toContainText('lida de volta do vault')
  })

  test('the personal workspace keeps the local vault wording', async ({ page }) => {
    await openDetails(page, 'local', LOCAL_CONNECTION)
    await openEdit(page)
    await expect(page.getByRole('dialog')).not.toContainText(ORG_HINT)
  })

  test('saving a password sends it to the organization', async ({ page }) => {
    await setOrgPassword(page)
    await expect
      .poll(async () => (await orgVaultCalls(page)).map((c) => c.method))
      .toContain('setSecret')
  })

  test('after saving, the form shows the password as defined', async ({ page }) => {
    await setOrgPassword(page)
    await openEdit(page)
    await expect(page.getByRole('dialog')).toContainText('Senha definida')
    await expect(page.getByRole('button', { name: 'Substituir' })).toBeEnabled()
  })

  test('the password never shows up in the page', async ({ page }) => {
    await setOrgPassword(page, 'super-secret-123')
    await openEdit(page)
    await expect(page.locator('body')).not.toContainText('super-secret-123')
  })

  test('removing the password takes it off the organization', async ({ page }) => {
    await setOrgPassword(page)
    await openEdit(page)
    await page.getByRole('button', { name: 'Remover' }).click()
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByRole('dialog')).toBeHidden()
    await expect
      .poll(async () => (await orgVaultCalls(page)).map((c) => c.method))
      .toContain('deleteSecret')
  })
})

test.describe('connecting from an organization', () => {
  test('without a password the session explains what is missing', async ({ page }) => {
    await openDetails(page, 'acme', ORG_CONNECTION)
    await page.getByRole('button', { name: 'Conectar' }).click()
    await expect(page.getByText('Senha não configurada para esta conexão').first()).toBeVisible()
  })

  test('with a password it opens a session tab', async ({ page }) => {
    await setOrgPassword(page)
    await page.getByRole('button', { name: 'Conectar' }).click()
    await expect(page.getByRole('tab', { name: /k8s-bastion/ })).toBeVisible()
  })
})
