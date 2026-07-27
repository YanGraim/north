import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import { Toaster } from './components/ui/sonner'
import { TooltipProvider } from './components/ui/tooltip'
import { useAppUpdates } from './hooks/use-app-updates'
import { useLocaleEffect } from './hooks/use-locale-effect'
import { useThemeEffect } from './hooks/use-theme-effect'
import './i18n'
import '@fontsource/ibm-plex-sans/400.css'
import '@fontsource/ibm-plex-sans/500.css'
import '@fontsource/ibm-plex-sans/600.css'
import '@fontsource/ibm-plex-sans/700.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import './assets/index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false
    }
  }
})

function Bootstrap(): React.JSX.Element {
  useThemeEffect()
  useLocaleEffect()
  useAppUpdates()
  return (
    <>
      <App />
      <Toaster position="bottom-right" richColors closeButton />
    </>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <HashRouter>
          <Bootstrap />
        </HashRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </StrictMode>
)
