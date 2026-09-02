import App from '@renderer/App'

/**
 * Renders the production AppShell (titlebar, sidebar tree, list, details, session tabs)
 * so E2E covers the real workspace instead of a harness-only clone.
 */
export function AppHarnessApp(): React.JSX.Element {
  return <App />
}
