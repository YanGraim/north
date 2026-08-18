import { Button } from '@renderer/components/ui/button'
import { useAppVersion } from '@renderer/hooks/use-app-version'
import { isApplePlatform } from '@renderer/lib/platform'
import { cn } from '@renderer/lib/utils'
import { useUiStore } from '@renderer/stores/ui-store'
import northIcon from '@resources/icon.png'
import { PanelLeft } from 'lucide-react'

export function Titlebar(): React.JSX.Element {
  const { data: version, isLoading } = useAppVersion()
  const toggleSidebar = useUiStore((s) => s.toggleSidebar)
  const isMac = isApplePlatform()

  return (
    <header className="titlebar flex h-11 shrink-0 items-center border-b border-border bg-surface px-4">
      <div
        className={cn('flex items-center justify-between', isMac && 'w-full pl-16')}
        style={
          isMac
            ? undefined
            : {
                width: 'env(titlebar-area-width, 100%)',
                marginLeft: 'env(titlebar-area-x, 0px)'
              }
        }
      >
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 no-drag"
            onClick={toggleSidebar}
            aria-label="Alternar barra lateral"
          >
            <PanelLeft className="size-4" />
          </Button>
          <img src={northIcon} alt="" className="size-5 shrink-0 rounded-sm no-drag" aria-hidden />
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
