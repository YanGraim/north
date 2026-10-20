import { expect, type Page, test } from '@playwright/test'

/**
 * Organization pushes (ADR 0018 fase 5). The harness stands in for main:
 * `__e2eEmitWorkspaceEvent` is what `workspaces:event` delivers.
 */
const ORG_CONNECTION = 'c4000000-0000-4000-8000-000000000004'

type Win = {
  __e2eEmitWorkspaceEvent: (event: unknown) => void
  __e2eSetOrgRole: (role: string) => void
  __e2eRenameOrgConnection: (name: string) => void
}

const emit = (page: Page, event: unknown) =>
  page.evaluate((e) => (window as unknown as Win).__e2eEmitWorkspaceEvent(e), event)

async function openOrg(page: Page, role = 'admin'): Promise<void> {
  await page.goto(`/w/acme/connections?scenario=app&workspaces=org&role=${role}`)
  await expect(page.getByTestId(`inventory-item-connection-${ORG_CONNECTION}`)).toBeVisible()
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('e2e-booted')) {
      localStorage.clear()
      sessionStorage.setItem('e2e-booted', '1')
    }
  })
})

test('a change made by someone else shows up without reloading', async ({ page }) => {
  await openOrg(page)
  await page.evaluate(() => (window as unknown as Win).__e2eRenameOrgConnection('k8s-renamed'))
  await expect(page.getByText('k8s-renamed')).toHaveCount(0)
  await emit(page, { workspaceId: 'acme', kind: 'inventory', entity: 'connection' })
  await expect(page.getByText('k8s-renamed').first()).toBeVisible()
})

test('events from another organization do not touch this one', async ({ page }) => {
  await openOrg(page)
  await page.evaluate(() => (window as unknown as Win).__e2eRenameOrgConnection('should-not-show'))
  await emit(page, { workspaceId: 'other-org', kind: 'inventory', entity: 'connection' })
  await page.waitForTimeout(300)
  await expect(page.getByText('should-not-show')).toHaveCount(0)
})

test('becoming editor shows the edit actions right away', async ({ page }) => {
  await openOrg(page, 'viewer')
  await page.getByTestId(`inventory-item-connection-${ORG_CONNECTION}`).click()
  const edit = page.getByRole('button', { name: 'Editar', exact: true })
  await expect(edit).toHaveCount(0)
  await page.evaluate(() => (window as unknown as Win).__e2eSetOrgRole('editor'))
  await emit(page, { workspaceId: 'acme', kind: 'access' })
  await expect(edit).toBeVisible()
})

test('losing access hides the actions again', async ({ page }) => {
  await openOrg(page, 'editor')
  await page.getByTestId(`inventory-item-connection-${ORG_CONNECTION}`).click()
  const edit = page.getByRole('button', { name: 'Editar', exact: true })
  await expect(edit).toBeVisible()
  await page.evaluate(() => (window as unknown as Win).__e2eSetOrgRole('viewer'))
  await emit(page, { workspaceId: 'acme', kind: 'access' })
  await expect(edit).toHaveCount(0)
})

test('a revoked person is told why and moved to the personal workspace', async ({ page }) => {
  await openOrg(page)
  await emit(page, { workspaceId: 'acme', kind: 'signed-out', reason: 'revoked' })
  await expect(page.getByText('Um admin removeu o seu acesso a esta organização')).toBeVisible()
  await expect(page).toHaveURL(/\/w\/local\//)
  await expect(page.getByTestId('workspace-switcher')).toHaveAttribute('data-kind', 'local')
})

test('an expired session says to sign in again', async ({ page }) => {
  await openOrg(page)
  await emit(page, { workspaceId: 'acme', kind: 'signed-out', reason: 'expired' })
  await expect(page.getByText('Sua sessão nesta organização terminou')).toBeVisible()
  await expect(page).toHaveURL(/\/w\/local\//)
})
