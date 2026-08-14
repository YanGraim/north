import { AccessDetailsPanel } from '@renderer/features/accesses/AccessDetailsPanel'
import { SessionTabs } from '@renderer/features/sessions/SessionTabs'
import { SessionView } from '@renderer/features/sessions/SessionView'
import { useSelectedAccessId } from '@renderer/hooks/use-route-selection'
import { useSessionsStore, WORKSPACE_TAB_ID } from '@renderer/stores/sessions-store'
import { useEffect } from 'react'
import { harnessIds } from './mock-north'

export function DatabaseHarnessApp(): React.JSX.Element {
  const { accessId, setAccessId } = useSelectedAccessId()
  const tabs = useSessionsStore((s) => s.tabs)
  const activeTabId = useSessionsStore((s) => s.activeTabId)
  const workspaceActive = activeTabId === WORKSPACE_TAB_ID

  useEffect(() => {
    if (!accessId) {
      setAccessId(harnessIds.DB_ACCESS_ID)
    }
  }, [accessId, setAccessId])

  return (
    <div
      className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground"
      data-testid="database-harness"
    >
      <SessionTabs />
      <div className="relative flex min-h-0 flex-1">
        <div
          className="flex min-h-0 min-w-0 flex-1"
          style={{ display: workspaceActive ? 'flex' : 'none' }}
          data-testid="database-workspace"
        >
          <aside className="w-full max-w-md border-r border-border">
            <AccessDetailsPanel />
          </aside>
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
    </div>
  )
}
