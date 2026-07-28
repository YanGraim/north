import { ResizablePanels } from '@renderer/components/layout/ResizablePanels'
import { Titlebar } from '@renderer/components/layout/Titlebar'
import { WorkspaceLayout } from '@renderer/components/layout/WorkspaceLayout'
import { TooltipProvider } from '@renderer/components/ui/tooltip'
import { CommandPalette } from '@renderer/features/command-palette/CommandPalette'
import { InventoryDialogs } from '@renderer/features/inventory/InventoryDialogs'
import { HostKeyDialog } from '@renderer/features/sessions/HostKeyDialog'
import { SessionTabs } from '@renderer/features/sessions/SessionTabs'
import { SessionView } from '@renderer/features/sessions/SessionView'
import { matchesShortcut } from '@renderer/lib/shortcuts'
import { toastError } from '@renderer/lib/toast'
import { useCommandPaletteStore } from '@renderer/stores/command-palette-store'
import { useInventoryDialogsStore } from '@renderer/stores/inventory-dialogs-store'
import { useSessionsStore, WORKSPACE_TAB_ID } from '@renderer/stores/sessions-store'
import { useUiStore } from '@renderer/stores/ui-store'
import { useEffect } from 'react'
import { Outlet, useMatch } from 'react-router-dom'

export function AppShell(): React.JSX.Element {
  const toggleSidebar = useUiStore((s) => s.toggleSidebar)
  const togglePalette = useCommandPaletteStore((s) => s.toggle)
  const openDialog = useInventoryDialogsStore((s) => s.open)
  const activeTabId = useSessionsStore((s) => s.activeTabId)
  const tabs = useSessionsStore((s) => s.tabs)
  const closeTab = useSessionsStore((s) => s.closeTab)
  const duplicateTab = useSessionsStore((s) => s.duplicateTab)
  const dashboardMatch = useMatch('/dashboard')
  const historyMatch = useMatch('/history')
  const manualMatch = useMatch('/settings/manual')
  const isFullBleed = Boolean(dashboardMatch || historyMatch || manualMatch)
  const workspaceActive = activeTabId === WORKSPACE_TAB_ID

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null
      const inXterm = Boolean(target?.closest?.('.xterm'))
      const typing =
        target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable
      // xterm uses a textarea; session shortcuts still apply when the terminal is focused.
      const typingOutsideTerminal = typing && !inXterm

      if (matchesShortcut(event, 'commandPalette')) {
        event.preventDefault()
        togglePalette()
        return
      }

      if (matchesShortcut(event, 'toggleSidebar')) {
        event.preventDefault()
        toggleSidebar()
        return
      }

      if (!typing && matchesShortcut(event, 'newConnection')) {
        event.preventDefault()
        openDialog({ type: 'connection', mode: 'create' })
        return
      }

      if (!typingOutsideTerminal && matchesShortcut(event, 'closeTab')) {
        event.preventDefault()
        if (activeTabId !== WORKSPACE_TAB_ID) {
          void closeTab(activeTabId)
        }
        return
      }

      if (!typingOutsideTerminal && matchesShortcut(event, 'duplicateTab')) {
        event.preventDefault()
        if (activeTabId !== WORKSPACE_TAB_ID) {
          void duplicateTab(activeTabId).catch((error: unknown) => {
            toastError(error instanceof Error ? error.message : 'Falha ao duplicar sessão')
          })
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [toggleSidebar, togglePalette, openDialog, activeTabId, closeTab, duplicateTab])

  return (
    <TooltipProvider>
      <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
        <Titlebar />
        <SessionTabs />
        <div className="relative flex min-h-0 flex-1">
          <div
            className="flex min-h-0 min-w-0 flex-1"
            style={{ display: workspaceActive ? 'flex' : 'none' }}
          >
            <WorkspaceLayout>
              {isFullBleed ? (
                <main className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-background">
                  <Outlet />
                </main>
              ) : (
                <ResizablePanels>
                  <Outlet />
                </ResizablePanels>
              )}
            </WorkspaceLayout>
          </div>

          {tabs
            .filter((tab) => tab.kind === 'session')
            .map((tab) => (
              <div
                key={tab.id}
                className="absolute inset-0 flex h-full min-h-0 min-w-0 flex-col"
                style={{ display: activeTabId === tab.id ? 'flex' : 'none' }}
              >
                <SessionView tab={tab} visible={activeTabId === tab.id} />
              </div>
            ))}
        </div>
        <CommandPalette />
        <HostKeyDialog />
        <InventoryDialogs />
      </div>
    </TooltipProvider>
  )
}
