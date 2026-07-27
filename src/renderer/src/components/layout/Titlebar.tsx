import { Button } from '@renderer/components/ui/button'
import { useAppVersion } from '@renderer/hooks/use-app-version'
import { useUiStore } from '@renderer/stores/ui-store'
import { PanelLeft } from 'lucide-react'

export function Titlebar(): React.JSX.Element {
  const { data: version, isLoading } = useAppVersion()
  const toggleSidebar = useUiStore((s) => s.toggleSidebar)

  return (
    <header className="titlebar flex h-11 shrink-0 items-center border-b border-border bg-surface px-4">
      <div className="flex w-full items-center justify-between pl-16">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={toggleSidebar}
            aria-label="Alternar barra lateral"
          >
            <PanelLeft className="size-4" />
          </Button>
          <span className="font-display text-sm font-semibold tracking-wide text-foreground">
            North
          </span>
        </div>
        <span className="font-mono text-xs text-muted">
          {isLoading ? '…' : `v${version ?? '—'}`}
        </span>
      </div>
    </header>
  )
}
