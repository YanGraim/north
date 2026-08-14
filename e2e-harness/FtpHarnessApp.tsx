import { ConnectionDetailsPanel } from '@renderer/features/connections/ConnectionDetailsPanel'
import { SessionTabs } from '@renderer/features/sessions/SessionTabs'
import { SessionView } from '@renderer/features/sessions/SessionView'
import { useSelectedConnectionId } from '@renderer/hooks/use-route-selection'
import { useSessionsStore, WORKSPACE_TAB_ID } from '@renderer/stores/sessions-store'
import { useEffect } from 'react'
import { harnessIds } from './mock-north'

export function FtpHarnessApp(): React.JSX.Element {
  const { connectionId, setConnectionId } = useSelectedConnectionId()
  const tabs = useSessionsStore((s) => s.tabs)
  const activeTabId = useSessionsStore((s) => s.activeTabId)
  const workspaceActive = activeTabId === WORKSPACE_TAB_ID

  useEffect(() => {
    if (!connectionId) {
      setConnectionId(harnessIds.FTP_CONNECTION_ID)
    }
  }, [connectionId, setConnectionId])

  return (
    <div
      className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground"
      data-testid="ftp-harness"
    >
      <SessionTabs />
      <div className="relative flex min-h-0 flex-1">
        <div
          className="flex min-h-0 min-w-0 flex-1"
          style={{ display: workspaceActive ? 'flex' : 'none' }}
          data-testid="ftp-workspace"
        >
          <aside className="w-full max-w-md border-r border-border">
            <ConnectionDetailsPanel />
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
