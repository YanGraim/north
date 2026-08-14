import { Toaster } from '@renderer/components/ui/sonner'
import '../src/renderer/src/assets/index.css'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { FtpHarnessApp } from './FtpHarnessApp'
import { HarnessApp } from './HarnessApp'
import { installMockNorth } from './mock-north'

const params = new URLSearchParams(window.location.search)
const scenario = params.get('scenario') === 'ftp' ? 'ftp' : 'workflows'

installMockNorth({
  failSecondStep: params.get('fail') === '1',
  failFirstStep: params.get('failFirst') === '1',
  scenario,
  fsFail: params.get('fsFail') === '1'
})

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false }
  }
})

;(window as unknown as { __e2eInvalidate?: () => void }).__e2eInvalidate = () => {
  void queryClient.invalidateQueries()
}

const root = document.getElementById('root')
if (root) {
  createRoot(root).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        {scenario === 'ftp' ? (
          <BrowserRouter>
            <FtpHarnessApp />
          </BrowserRouter>
        ) : (
          <HarnessApp />
        )}
        <Toaster />
      </QueryClientProvider>
    </StrictMode>
  )
}
