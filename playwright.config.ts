import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright drives the same `e2e-harness/` as Cypress (production AppShell
 * over a mocked `window.north`). Cypress keeps the older specs; new specs go here.
 * `admin-panel.spec.ts` drives the North Server's own admin page instead.
 */
export default defineConfig({
  testDir: 'playwright',
  fullyParallel: true,
  // The harness is served unbundled by Vite; too many workers starve it on a cold start.
  workers: process.env.CI ? 2 : 4,
  timeout: 60_000,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:5179',
    trace: 'retain-on-failure'
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'vite --config e2e-harness/vite.config.ts',
      url: 'http://127.0.0.1:5179',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000
    },
    {
      // Real North Server on in-memory Postgres, for the admin panel specs.
      command: 'npx tsx src/dev-pglite.ts',
      cwd: 'server',
      url: 'http://127.0.0.1:5181/healthz',
      reuseExistingServer: false,
      timeout: 60_000
    },
    {
      // Same, with "Sign in with Microsoft" through a fake Entra on :5184.
      command: 'npx tsx src/dev-pglite.ts',
      cwd: 'server',
      env: { PORT: '5183', NORTH_FAKE_ENTRA: '5184' },
      url: 'http://127.0.0.1:5183/healthz',
      reuseExistingServer: false,
      timeout: 60_000
    }
  ]
})
