import { Toaster } from '@renderer/components/ui/sonner'
import { TooltipProvider } from '@renderer/components/ui/tooltip'
import './harness.css'
import '@renderer/i18n'
import { workspaceQueryClients } from '@renderer/features/workspaces/WorkspaceScope'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AppHarnessApp } from './AppHarnessApp'
import { DatabaseHarnessApp } from './DatabaseHarnessApp'
import { FtpHarnessApp } from './FtpHarnessApp'
import { HarnessApp } from './HarnessApp'
import { applyOrganizationOverlay, installMockNorth } from './mock-north'

const params = new URLSearchParams(window.location.search)
const scenarioParam = params.get('scenario')
const scenario =
  scenarioParam === 'ftp' || scenarioParam === 'database' || scenarioParam === 'app'
    ? scenarioParam
    : 'workflows'

installMockNorth({
  failSecondStep: params.get('fail') === '1',
  failFirstStep: params.get('failFirst') === '1',
  scenario: scenario === 'app' ? 'database' : scenario,
  fsFail: params.get('fsFail') === '1',
  workspaces:
    params.get('workspaces') === 'org'
      ? 'org'
      : params.get('workspaces') === 'org-signed-out'
        ? 'org-signed-out'
        : 'none'
})

applyOrganizationOverlay(
  (window as unknown as { north: Record<string, Record<string, unknown>> }).north
)

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false }
  }
})

;(window as unknown as { __e2eInvalidate?: () => void }).__e2eInvalidate = () => {
  void queryClient.invalidateQueries()
  for (const client of workspaceQueryClients()) void client.invalidateQueries()
}

const root = document.getElementById('root')
if (root) {
  createRoot(root).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          {scenario === 'app' ? (
            <BrowserRouter>
              <AppHarnessApp />
            </BrowserRouter>
          ) : scenario === 'ftp' ? (
            <BrowserRouter>
              <FtpHarnessApp />
            </BrowserRouter>
          ) : scenario === 'database' ? (
            <BrowserRouter>
              <DatabaseHarnessApp />
            </BrowserRouter>
          ) : (
            <HarnessApp />
          )}
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </StrictMode>
  )
}
