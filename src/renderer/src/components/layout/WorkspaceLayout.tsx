import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup
} from '@renderer/components/ui/resizable'
import { Sidebar } from '@renderer/features/navigation/Sidebar'
import { useUiStore } from '@renderer/stores/ui-store'
import { useEffect } from 'react'
import { useDefaultLayout, usePanelRef } from 'react-resizable-panels'

type WorkspaceLayoutProps = {
  children: React.ReactNode
}

export function WorkspaceLayout({ children }: WorkspaceLayoutProps): React.JSX.Element {
  const collapsed = useUiStore((s) => s.sidebarCollapsed)
  const setSidebarCollapsed = useUiStore((s) => s.setSidebarCollapsed)
  const sidebarPanelRef = usePanelRef()
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: 'north-sidebar-main-v1',
    storage: localStorage
  })

  useEffect(() => {
    const panel = sidebarPanelRef.current
    if (!panel) return
    if (collapsed) {
      if (!panel.isCollapsed()) panel.collapse()
    } else if (panel.isCollapsed()) {
      panel.expand()
    }
  }, [collapsed, sidebarPanelRef])

  return (
    <ResizablePanelGroup
      id="north-sidebar-main-v1"
      orientation="horizontal"
      className="min-h-0 min-w-0 flex-1"
      defaultLayout={defaultLayout}
      onLayoutChanged={onLayoutChanged}
    >
      <ResizablePanel
        id="sidebar"
        panelRef={sidebarPanelRef}
        minSize={180}
        defaultSize={224}
        maxSize={420}
        collapsible
        collapsedSize={48}
        onResize={() => {
          const panel = sidebarPanelRef.current
          if (!panel) return
          const isCollapsed = panel.isCollapsed()
          if (isCollapsed !== useUiStore.getState().sidebarCollapsed) {
            setSidebarCollapsed(isCollapsed)
          }
        }}
        className="min-h-0 min-w-0 overflow-hidden bg-surface"
      >
        <Sidebar />
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel id="main" minSize="40%" className="min-h-0 min-w-0">
        {children}
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}
