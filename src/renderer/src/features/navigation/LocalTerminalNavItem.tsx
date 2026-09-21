import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { toastError } from '@renderer/lib/toast'
import { cn } from '@renderer/lib/utils'
import { openLocalTerminalSession } from '@renderer/stores/sessions-store'
import { SquareTerminal } from 'lucide-react'

type LocalTerminalNavItemProps = {
  label: string
  collapsed?: boolean
}

/**
 * Opens the local shell session (no host, no credential) — an action, not a
 * route, so it can't be a plain NavItem/NavLink. Accent-colored icon so it
 * reads as "yours" rather than another server in the Overview list.
 */
export function LocalTerminalNavItem({
  label,
  collapsed = false
}: LocalTerminalNavItemProps): React.JSX.Element {
  function open(): void {
    void openLocalTerminalSession().catch((error) => {
      toastError(error, 'Não foi possível abrir o terminal local.')
    })
  }

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={label}
            onClick={open}
            className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted transition-colors motion-safe:duration-150 hover:bg-surface-elevated/40 hover:text-accent"
          >
            <SquareTerminal className="size-3.5 shrink-0 text-accent" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    )
  }

  return (
    <button
      type="button"
      onClick={open}
      className={cn(
        'flex h-8 min-w-0 items-center gap-2 rounded-md px-2 text-left text-[13px] text-muted transition-colors motion-safe:duration-150 hover:bg-surface-elevated/40 hover:text-foreground'
      )}
    >
      <SquareTerminal className="size-3.5 shrink-0 text-accent" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </button>
  )
}
