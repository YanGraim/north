import { expect, type Page, test } from '@playwright/test'

/**
 * "Copiar para workspace…" (fase 6) against the e2e harness: main's copy is
 * mocked (window.__e2eCopies records each call), the UI flow is real.
 */
const LOCAL_CLIENT = 'E2E Client'
const LOCAL_CLIENT_ID = 'b1000000-0000-4000-8000-000000000001'
const LOCAL_CONNECTION = 'b5000000-0000-4000-8000-000000000005'
const ORG_GROUP = 'c3000000-0000-4000-8000-000000000003'
const COPY_ID = 'e9000000-0000-4000-8000-000000000009'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('e2e-booted')) {
      localStorage.clear()
      sessionStorage.setItem('e2e-booted', '1')
    }
  })
})

const copies = (page: Page) =>
  page.evaluate(() => (window as unknown as { __e2eCopies: unknown[] }).__e2eCopies)

async function openFromTree(
  page: Page,
  name: string,
  query = 'workspaces=org',
  expand: string[] = []
): Promise<void> {
  await page.goto(`/w/local/connections?scenario=app&${query}`)
  for (const parent of expand) {
    await page.getByRole('link', { name: parent, exact: true }).first().click()
  }
  await page.getByRole('link', { name, exact: true }).first().click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Copiar para workspace…' }).click()
  await expect(page.getByTestId('copy-to-workspace')).toBeVisible()
}

test('is not offered when there is no other workspace', async ({ page }) => {
  await page.goto('/w/local/connections?scenario=app')
  await page
    .getByRole('link', { name: LOCAL_CLIENT, exact: true })
    .first()
    .click({ button: 'right' })
  await expect(page.getByRole('menuitem', { name: 'Editar' })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: 'Copiar para workspace…' })).toHaveCount(0)
})

test('copies a whole client to the organization, with passwords, and opens it', async ({
  page
}) => {
  await openFromTree(page, LOCAL_CLIENT)
  const dialog = page.getByTestId('copy-to-workspace')
  await expect(dialog).toContainText(`Copiar “${LOCAL_CLIENT}”`)
  // Only one other workspace: it comes preselected; a client needs no destination.
  await expect(dialog.getByLabel('Para qual workspace')).toContainText('Acme Corp')
  await expect(dialog.getByLabel('Copiar senhas')).toBeChecked()
  await expect(dialog).toContainText('criptografadas para o servidor da organização')
  await dialog.getByRole('button', { name: 'Copiar', exact: true }).click()

  const report = page.getByTestId('copy-report')
  await expect(report).toContainText('Pronto — copiado para Acme Corp.')
  await expect(report).toContainText('1 cliente · 2 conexões · 1 senha')
  await expect(report).toContainText('ficaram de fora')
  expect(await copies(page)).toEqual([
    {
      kind: 'client',
      id: LOCAL_CLIENT_ID,
      targetWorkspaceId: 'acme',
      targetParentId: null,
      includePasswords: true
    }
  ])

  await report.getByRole('button', { name: 'Abrir em Acme Corp' }).click()
  await expect(page).toHaveURL(new RegExp(`/w/acme/clients/${COPY_ID}`))
})

test('unchecking "Copiar senhas" copies without them', async ({ page }) => {
  await openFromTree(page, LOCAL_CLIENT)
  const dialog = page.getByTestId('copy-to-workspace')
  await dialog.getByLabel('Copiar senhas').click()
  await dialog.getByRole('button', { name: 'Copiar', exact: true }).click()
  await expect(page.getByTestId('copy-report')).not.toContainText('senha')
  expect(await copies(page)).toEqual([expect.objectContaining({ includePasswords: false })])
})

test('a connection needs a destination group in the target', async ({ page }) => {
  await page.goto('/w/local/connections?scenario=app&workspaces=org')
  await page.getByTestId(`inventory-item-connection-${LOCAL_CONNECTION}`).click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Copiar para workspace…' }).click()
  const dialog = page.getByTestId('copy-to-workspace')
  const submit = dialog.getByRole('button', { name: 'Copiar', exact: true })
  await expect(submit).toBeDisabled()
  await dialog.getByLabel('Dentro de qual grupo').click()
  await page.getByRole('option', { name: 'Acme Cloud › Produção › Kubernetes' }).click()
  await expect(submit).toBeEnabled()
  await submit.click()
  await expect(page.getByTestId('copy-report')).toContainText('2 conexões')
  expect(await copies(page)).toEqual([
    expect.objectContaining({ kind: 'connection', targetParentId: ORG_GROUP })
  ])
  await page.getByRole('button', { name: 'Abrir em Acme Corp' }).click()
  await expect(page).toHaveURL(new RegExp(`/w/acme/connections\\?connection=${COPY_ID}`))
})

test('copying an environment lists the target clients', async ({ page }) => {
  await openFromTree(page, 'lab', 'workspaces=org', [LOCAL_CLIENT])
  const dialog = page.getByTestId('copy-to-workspace')
  await dialog.getByLabel('Dentro de qual cliente').click()
  await page.getByRole('option', { name: 'Acme Cloud' }).click()
  await dialog.getByRole('button', { name: 'Copiar', exact: true }).click()
  await expect(page.getByTestId('copy-report')).toContainText('1 ambiente')
})

test('from the organization, the hint says reads are audited', async ({ page }) => {
  await page.goto('/w/acme/connections?scenario=app&workspaces=org')
  await page
    .getByRole('link', { name: 'Acme Cloud', exact: true })
    .first()
    .click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Copiar para workspace…' }).click()
  const dialog = page.getByTestId('copy-to-workspace')
  await expect(dialog.getByLabel('Para qual workspace')).toContainText('Meu workspace')
  await expect(dialog).toContainText('fica registrada na auditoria')
  await dialog.getByRole('button', { name: 'Copiar', exact: true }).click()
  expect(await copies(page)).toEqual([
    expect.objectContaining({ kind: 'client', targetWorkspaceId: 'local' })
  ])
})

test('a viewer can still copy a project out (and nothing else)', async ({ page }) => {
  await page.goto('/w/acme/connections?scenario=app&workspaces=org&role=viewer')
  await page
    .getByRole('link', { name: 'Acme Cloud', exact: true })
    .first()
    .click({ button: 'right' })
  const items = (await page.getByRole('menuitem').allInnerTexts()).map((s) => s.trim())
  expect(items).toEqual(['Copiar para workspace…'])
})

test('shows the error when the copy is refused, keeping the form', async ({ page }) => {
  await openFromTree(page, LOCAL_CLIENT, 'workspaces=org&copy=fail')
  const dialog = page.getByTestId('copy-to-workspace')
  await dialog.getByRole('button', { name: 'Copiar', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('Only admins')
  await expect(dialog.getByRole('button', { name: 'Copiar', exact: true })).toBeEnabled()
})

test('Esc closes without copying', async ({ page }) => {
  await openFromTree(page, LOCAL_CLIENT)
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('copy-to-workspace')).toBeHidden()
  expect(await copies(page)).toEqual([])
})
