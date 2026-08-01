import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup
} from '@renderer/components/ui/resizable'
import { AccessDetailsPanel } from '@renderer/features/accesses/AccessDetailsPanel'
import { ConnectionDetailsPanel } from '@renderer/features/connections/ConnectionDetailsPanel'
import { useSelectedAccessId, useSelectedConnectionId } from '@renderer/hooks/use-route-selection'
import { useSessionsStore, WORKSPACE_TAB_ID } from '@renderer/stores/sessions-store'
import { useEffect } from 'react'
import { useDefaultLayout, usePanelRef } from 'react-resizable-panels'

type ResizablePanelsProps = {
  children: React.ReactNode
}

export function ResizablePanels({ children }: ResizablePanelsProps): React.JSX.Element {
  const { connectionId, setConnectionId } = useSelectedConnectionId()
  const { accessId, setAccessId } = useSelectedAccessId()
  const selected = Boolean(connectionId || accessId)
  const workspaceActive = useSessionsStore((s) => s.activeTabId === WORKSPACE_TAB_ID)
  const detailsPanelRef = usePanelRef()
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: 'north-list-details-v2',
    storage: localStorage
  })

  useEffect(() => {
    const panel = detailsPanelRef.current
    if (!panel) return
    if (selected) {
      if (panel.isCollapsed()) panel.expand()
    } else if (!panel.isCollapsed()) {
      panel.collapse()
    }
  }, [selected, detailsPanelRef])

  useEffect(() => {
    if (!selected || !workspaceActive) return
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      const target = event.target as HTMLElement | null
      const inXterm = Boolean(target?.closest?.('.xterm'))
      const typing =
        target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable
      // Never steal Esc from a terminal (layout stays mounted under session tabs).
      if (typing || inXterm) return
      event.preventDefault()
      setConnectionId(null)
      setAccessId(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selected, workspaceActive, setConnectionId, setAccessId])

  return (
    <ResizablePanelGroup
      id="north-list-details-v2"
      orientation="horizontal"
      className="min-h-0 min-w-0 flex-1"
      defaultLayout={defaultLayout}
      onLayoutChanged={onLayoutChanged}
    >
      <ResizablePanel id="list" minSize="20%" defaultSize="52%" className="min-w-0">
        <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">{children}</div>
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel
        id="details"
        panelRef={detailsPanelRef}
        minSize="28%"
        defaultSize="48%"
        collapsible
        collapsedSize={0}
        className="min-w-0 overflow-hidden bg-surface"
      >
        {accessId ? <AccessDetailsPanel /> : <ConnectionDetailsPanel />}
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}
