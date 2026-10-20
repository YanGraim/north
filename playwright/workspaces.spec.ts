import { expect, type Page, test } from '@playwright/test'

/** Inventory ids from the `app` scenario of e2e-harness/mock-north.ts. */
const CLIENT_ID = 'b1000000-0000-4000-8000-000000000001'
const ENV_ID = 'b2000000-0000-4000-8000-000000000002'

async function activations(page: Page): Promise<string[]> {
  return page.evaluate(
    () => (window as unknown as { __e2eWorkspaceActivations: string[] }).__e2eWorkspaceActivations
  )
}

function uiState(page: Page): Promise<Record<string, unknown> | null> {
  return page.evaluate(() => {
    const raw = window.localStorage.getItem('north-ui')
    return raw ? (JSON.parse(raw).state as Record<string, unknown>) : null
  })
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('e2e-booted')) {
      localStorage.clear()
      sessionStorage.setItem('e2e-booted', '1')
    }
  })
})

test.describe('workspace routing', () => {
  test('the root lands on the local dashboard', async ({ page }) => {
    await page.goto('/?scenario=app')
    await expect(page).toHaveURL(/\/w\/local\/dashboard\?scenario=app$/)
  })

  test('legacy links move into the local workspace keeping the query', async ({ page }) => {
    await page.goto(`/clients/${CLIENT_ID}?scenario=app&env=${ENV_ID}`)
    await expect(page).toHaveURL(
      new RegExp(`/w/local/clients/${CLIENT_ID}\\?scenario=app&env=${ENV_ID}$`)
    )
  })

  test('the old /help alias opens the manual inside the workspace', async ({ page }) => {
    await page.goto('/help?scenario=app')
    await expect(page).toHaveURL(/\/w\/local\/settings\/manual/)
  })

  test('an unknown workspace falls back to the local one', async ({ page }) => {
    await page.goto('/w/ghost/history?scenario=app')
    await expect(page).toHaveURL(/\/w\/local\/history/)
  })

  test('an organization whose session ended falls back with a message', async ({ page }) => {
    await page.goto('/w/acme/dashboard?scenario=app&workspaces=org-signed-out')
    await expect(page).toHaveURL(/\/w\/local\/dashboard/)
    await expect(page.getByText(/sessão nesta organização terminou/i).first()).toBeVisible()
  })

  test('opening a workspace route activates it in main', async ({ page }) => {
    await page.goto('/w/local/connections?scenario=app')
    await expect(page.getByTestId('workspace-switcher')).toBeVisible()
    await expect.poll(() => activations(page)).toContain('local')
  })

  test('a reload stays on the same scoped route', async ({ page }) => {
    await page.goto('/w/local/history?scenario=app')
    await expect(page.getByTestId('workspace-switcher')).toBeVisible()
    await page.reload()
    await expect(page).toHaveURL(/\/w\/local\/history/)
  })

  test('the last workspace is remembered for legacy redirects', async ({ page }) => {
    await page.goto('/w/local/dashboard?scenario=app')
    await expect(page.getByTestId('workspace-switcher')).toBeVisible()
    await expect.poll(async () => (await uiState(page))?.lastWorkspaceId).toBe('local')
  })
})

test.describe('sidebar navigation stays inside the workspace', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/w/local/dashboard?scenario=app')
    await expect(page.getByTestId('workspace-switcher')).toBeVisible()
  })

  for (const [label, path] of [
    ['Conexões', '/connections'],
    ['Favoritos', '/favorites'],
    ['Histórico', '/history'],
    ['VPNs', '/vpns'],
    ['Configurações', '/settings']
  ] as const) {
    test(`${label} links to /w/local${path}`, async ({ page }) => {
      const link = page.locator('aside').getByRole('link', { name: label, exact: true })
      await expect(link).toHaveAttribute('href', `/w/local${path}`)
      await link.click()
      await expect(page).toHaveURL(new RegExp(`/w/local${path}$`))
    })
  }

  test('the active item is highlighted on a scoped route', async ({ page }) => {
    const link = page.locator('aside').getByRole('link', { name: 'Histórico', exact: true })
    await link.click()
    await expect(link).toHaveAttribute('aria-current', 'page')
  })

  test('client tree links are scoped', async ({ page }) => {
    const clientLink = page.locator(`aside a[href^="/w/local/clients/${CLIENT_ID}"]`).first()
    await expect(clientLink).toBeVisible()
    await clientLink.click()
    await expect(page).toHaveURL(new RegExp(`/w/local/clients/${CLIENT_ID}`))
  })

  test('the profile chip opens settings inside the workspace', async ({ page }) => {
    await expect(page.locator('aside a[href="/w/local/settings#profile"]').first()).toBeVisible()
  })
})

test.describe('workspace switcher', () => {
  test('lives in the titlebar, not in the sidebar', async ({ page }) => {
    await page.goto('/w/local/dashboard?scenario=app')
    await expect(page.locator('header').getByTestId('workspace-switcher')).toBeVisible()
    await expect(page.locator('aside').getByTestId('workspace-switcher')).toHaveCount(0)
  })

  test('shows the personal workspace by default', async ({ page }) => {
    await page.goto('/w/local/dashboard?scenario=app')
    const trigger = page.getByTestId('workspace-switcher')
    await expect(trigger).toContainText('Meu workspace')
    await expect(trigger).toHaveAttribute('data-kind', 'local')
  })

  test('the personal workspace comes first, then the organizations section', async ({ page }) => {
    await page.goto('/w/local/dashboard?scenario=app&workspaces=org')
    await page.getByTestId('workspace-switcher').click()
    const menu = page.getByRole('menu')
    await expect(menu.getByTestId('workspace-option-local')).toBeVisible()
    await expect(menu.getByText('Organizações')).toBeVisible()
    const localBox = await menu.getByTestId('workspace-option-local').boundingBox()
    const orgBox = await menu.getByTestId('workspace-option-acme').boundingBox()
    expect(localBox && orgBox && localBox.y < orgBox.y).toBe(true)
  })

  test('marks the current workspace', async ({ page }) => {
    await page.goto('/w/local/dashboard?scenario=app&workspaces=org')
    await page.getByTestId('workspace-switcher').click()
    await expect(page.getByTestId('workspace-option-local')).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByTestId('workspace-option-acme')).toHaveAttribute('aria-checked', 'false')
  })

  test('organizations are listed and selectable', async ({ page }) => {
    await page.goto('/w/local/dashboard?scenario=app&workspaces=org')
    await page.getByTestId('workspace-switcher').click()
    const acme = page.getByTestId('workspace-option-acme')
    await expect(acme).toContainText('Acme Corp')
    await expect(acme).not.toHaveAttribute('aria-disabled', 'true')
  })

  test('an empty organizations section explains how to get one', async ({ page }) => {
    await page.goto('/w/local/dashboard?scenario=app')
    await page.getByTestId('workspace-switcher').click()
    await expect(page.getByTestId('workspace-organizations-empty')).toBeVisible()
  })

  test('the + next to Organizations opens the add dialog', async ({ page }) => {
    await page.goto('/w/local/dashboard?scenario=app')
    await page.getByTestId('workspace-switcher').click()
    const add = page.getByTestId('workspace-add-organization')
    await expect(add).toHaveAttribute('aria-label', /Adicionar organização/)
    await add.click()
    await expect(page.getByRole('dialog', { name: /Adicionar organização/ })).toBeVisible()
  })

  test('picking the current workspace keeps the route', async ({ page }) => {
    await page.goto('/w/local/history?scenario=app')
    await page.getByTestId('workspace-switcher').click()
    await page.getByTestId('workspace-option-local').click()
    await expect(page).toHaveURL(/\/w\/local\/history/)
  })

  test('closes on Escape and returns focus to the trigger', async ({ page }) => {
    await page.goto('/w/local/dashboard?scenario=app')
    const trigger = page.getByTestId('workspace-switcher')
    await trigger.click()
    await expect(page.getByTestId('workspace-option-local')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('workspace-option-local')).toBeHidden()
    await expect(trigger).toBeFocused()
  })

  test('opens from the keyboard', async ({ page }) => {
    await page.goto('/w/local/dashboard?scenario=app')
    await page.getByTestId('workspace-switcher').focus()
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('workspace-option-local')).toBeVisible()
  })

  test('stays fully visible when the sidebar is collapsed', async ({ page }) => {
    await page.goto('/w/local/dashboard?scenario=app')
    await expect(page.getByTestId('workspace-switcher')).toBeVisible()
    await page.keyboard.press('ControlOrMeta+b')
    const trigger = page.getByTestId('workspace-switcher')
    await expect(trigger).toContainText('Meu workspace')
    await expect(trigger).toHaveAttribute('aria-label', /Meu workspace/)
  })
})

test.describe('command palette keeps the workspace', () => {
  test('"go to history" lands on the scoped route', async ({ page }) => {
    await page.goto('/w/local/dashboard?scenario=app')
    await expect(page.getByTestId('workspace-switcher')).toBeVisible()
    await page.keyboard.press('ControlOrMeta+k')
    await page.getByRole('option', { name: 'Ir para Histórico' }).click()
    await expect(page).toHaveURL(/\/w\/local\/history$/)
  })

  test('"go to settings" lands on the scoped route', async ({ page }) => {
    await page.goto('/w/local/dashboard?scenario=app')
    await expect(page.getByTestId('workspace-switcher')).toBeVisible()
    await page.keyboard.press('ControlOrMeta+k')
    await page.getByRole('option', { name: 'Ir para Configurações' }).click()
    await expect(page).toHaveURL(/\/w\/local\/settings$/)
  })
})

test.describe('naming', () => {
  test('the fixed first tab is called Painel', async ({ page }) => {
    await page.goto('/w/local/dashboard?scenario=app')
    await expect(page.getByTestId('workspace-switcher')).toBeVisible()
    await expect(page.getByText('Painel', { exact: true })).toBeVisible()
    await expect(page.getByText('Workspace', { exact: true })).toHaveCount(0)
  })

  test('the personal workspace reads "Meu workspace" in the menu', async ({ page }) => {
    await page.goto('/w/local/dashboard?scenario=app')
    await page.getByTestId('workspace-switcher').click()
    await expect(page.getByTestId('workspace-option-local')).toContainText('Meu workspace')
  })
})

const ORG_CLIENT = 'Acme Cloud'
const LOCAL_CLIENT_NAME = 'E2E Client'

async function openAddDialog(page: Page): Promise<void> {
  await page.getByTestId('workspace-switcher').click()
  await page.getByTestId('workspace-add-organization').click()
  await expect(page.getByRole('dialog', { name: /Adicionar organização/ })).toBeVisible()
}

test.describe('switching to an organization', () => {
  test('shows the organization tree and marks the pill', async ({ page }) => {
    await page.goto('/w/local/dashboard?scenario=app&workspaces=org')
    await expect(page.locator('aside')).toContainText(LOCAL_CLIENT_NAME)
    await page.getByTestId('workspace-switcher').click()
    await page.getByTestId('workspace-option-acme').click()
    await expect(page).toHaveURL(/\/w\/acme\/dashboard/)
    const pill = page.getByTestId('workspace-switcher')
    await expect(pill).toHaveAttribute('data-kind', 'organization')
    await expect(pill).toContainText('Acme Corp')
    await expect(page.locator('aside')).toContainText(ORG_CLIENT)
    await expect(page.locator('aside')).not.toContainText(LOCAL_CLIENT_NAME)
  })

  test('keeps the current page when switching', async ({ page }) => {
    await page.goto('/w/local/history?scenario=app&workspaces=org')
    await page.getByTestId('workspace-switcher').click()
    await page.getByTestId('workspace-option-acme').click()
    await expect(page).toHaveURL(/\/w\/acme\/history/)
  })

  test('switching back shows the personal tree again', async ({ page }) => {
    await page.goto('/w/acme/dashboard?scenario=app&workspaces=org')
    await expect(page.locator('aside')).toContainText(ORG_CLIENT)
    await page.getByTestId('workspace-switcher').click()
    await page.getByTestId('workspace-option-local').click()
    await expect(page).toHaveURL(/\/w\/local\/dashboard/)
    await expect(page.locator('aside')).toContainText(LOCAL_CLIENT_NAME)
    await expect(page.locator('aside')).not.toContainText(ORG_CLIENT)
  })

  test('shows who is signed in to the organization', async ({ page }) => {
    await page.goto('/w/acme/dashboard?scenario=app&workspaces=org')
    await page.getByTestId('workspace-switcher').click()
    await expect(page.getByTestId('workspace-option-acme')).toContainText('ana@acme.example')
  })

  test('activates the organization in main', async ({ page }) => {
    await page.goto('/w/acme/dashboard?scenario=app&workspaces=org')
    await expect(page.locator('aside')).toContainText(ORG_CLIENT)
    await expect.poll(() => activations(page)).toContain('acme')
  })
})

test.describe('adding an organization', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/w/local/dashboard?scenario=app')
    await expect(page.getByTestId('workspace-switcher')).toBeVisible()
  })

  test('Continuar stays disabled until there is an address', async ({ page }) => {
    await openAddDialog(page)
    await expect(page.getByRole('button', { name: 'Continuar' })).toBeDisabled()
    await page.getByLabel('Endereço do servidor').fill('north.acme.example')
    await expect(page.getByRole('button', { name: 'Continuar' })).toBeEnabled()
  })

  test('explains when the server does not answer', async ({ page }) => {
    await openAddDialog(page)
    await page.getByLabel('Endereço do servidor').fill('https://down.example')
    await page.getByRole('button', { name: 'Continuar' }).click()
    await expect(page.getByRole('alert')).toContainText(/não respondeu/)
  })

  test('explains when the server only offers corporate sign-in', async ({ page }) => {
    await openAddDialog(page)
    await page.getByLabel('Endereço do servidor').fill('https://entra.example')
    await page.getByRole('button', { name: 'Continuar' }).click()
    await expect(page.getByRole('alert')).toContainText(/Entra ID/)
  })

  test('shows the organization name, then signs in and opens it', async ({ page }) => {
    await openAddDialog(page)
    await page.getByLabel('Endereço do servidor').fill('north.acme.example')
    await page.getByRole('button', { name: 'Continuar' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText('Acme Corp')
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeDisabled()
    await page.getByLabel('E-mail').fill('ana@acme.example')
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(dialog).toBeHidden()
    await expect(page).toHaveURL(/\/w\/acme-corp-e2e\/dashboard/)
    await expect(page.getByTestId('workspace-switcher')).toContainText('Acme Corp')
    await expect(page.locator('aside')).toContainText(ORG_CLIENT)
  })

  test('rejects an invalid e-mail before calling the server', async ({ page }) => {
    await openAddDialog(page)
    await page.getByLabel('Endereço do servidor').fill('north.acme.example')
    await page.getByRole('button', { name: 'Continuar' }).click()
    await page.getByLabel('E-mail').fill('ana')
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeDisabled()
  })

  test('shows the server error when sign-in is refused', async ({ page }) => {
    await openAddDialog(page)
    await page.getByLabel('Endereço do servidor').fill('north.acme.example')
    await page.getByRole('button', { name: 'Continuar' }).click()
    await page.getByLabel('E-mail').fill('blocked@acme.example')
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page.getByRole('alert')).toContainText(/desativado/)
    await expect(page).toHaveURL(/\/w\/local\//)
  })

  test('Voltar returns to the address step keeping what was typed', async ({ page }) => {
    await openAddDialog(page)
    await page.getByLabel('Endereço do servidor').fill('north.acme.example')
    await page.getByRole('button', { name: 'Continuar' }).click()
    await page.getByRole('button', { name: 'Voltar' }).click()
    await expect(page.getByLabel('Endereço do servidor')).toHaveValue('north.acme.example')
  })

  test('Enter submits each step', async ({ page }) => {
    await openAddDialog(page)
    await page.getByLabel('Endereço do servidor').fill('north.acme.example')
    await page.keyboard.press('Enter')
    await page.getByLabel('E-mail').fill('ana@acme.example')
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/w\/acme-corp-e2e\//)
  })

  test('Esc closes the dialog without adding anything', async ({ page }) => {
    await openAddDialog(page)
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toBeHidden()
    await page.getByTestId('workspace-switcher').click()
    await expect(page.getByTestId('workspace-organizations-empty')).toBeVisible()
  })
})

test.describe('leaving an organization', () => {
  test('is offered only inside an organization', async ({ page }) => {
    await page.goto('/w/local/dashboard?scenario=app&workspaces=org')
    await page.getByTestId('workspace-switcher').click()
    await expect(page.getByTestId('workspace-leave')).toHaveCount(0)
  })

  test('asks for confirmation, then goes back to Meu workspace', async ({ page }) => {
    await page.goto('/w/acme/dashboard?scenario=app&workspaces=org')
    await expect(page.locator('aside')).toContainText(ORG_CLIENT)
    await page.getByTestId('workspace-switcher').click()
    await page.getByTestId('workspace-leave').click()
    const confirm = page.getByRole('alertdialog')
    await expect(confirm).toContainText('Acme Corp')
    await confirm.getByRole('button', { name: 'Sair' }).click()
    await expect(page).toHaveURL(/\/w\/local\/dashboard/)
    await page.getByTestId('workspace-switcher').click()
    await expect(page.getByTestId('workspace-option-acme')).toHaveCount(0)
  })

  test('cancel keeps the organization', async ({ page }) => {
    await page.goto('/w/acme/dashboard?scenario=app&workspaces=org')
    await page.getByTestId('workspace-switcher').click()
    await page.getByTestId('workspace-leave').click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Cancelar' }).click()
    await expect(page).toHaveURL(/\/w\/acme\//)
  })
})
