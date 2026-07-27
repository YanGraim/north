import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { SIDEBAR_ROW, SIDEBAR_TRAILING } from '@renderer/features/navigation/SidebarSection'
import { cn } from '@renderer/lib/utils'
import type { LucideIcon } from 'lucide-react'
import { NavLink } from 'react-router-dom'

type NavItemProps = {
  to: string
  label: string
  icon: LucideIcon
  collapsed?: boolean
  end?: boolean
  count?: number
  color?: string | null
  /** Skip Tooltip when parent already owns the DOM node (e.g. ContextMenu asChild). */
  plain?: boolean
}

export function NavItem({
  to,
  label,
  icon: Icon,
  collapsed = false,
  end,
  count,
  color,
  plain = false
}: NavItemProps): React.JSX.Element {
  if (collapsed) {
    const link = (
      <NavLink
        to={to}
        end={end}
        aria-label={label}
        title={label}
        className={({ isActive }) =>
          cn(
            'flex size-8 shrink-0 items-center justify-center rounded-md text-[13px] transition-colors motion-safe:duration-150',
            isActive
              ? 'bg-surface-elevated/80 text-foreground'
              : 'text-muted hover:bg-surface-elevated/40 hover:text-foreground'
          )
        }
      >
        <Icon className="size-3.5 shrink-0" style={color ? { color } : undefined} />
      </NavLink>
    )

    if (plain) return link

    return (
      <Tooltip>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    )
  }

  const linkClass = ({ isActive }: { isActive: boolean }): string =>
    cn(
      'flex min-w-0 items-center gap-2 rounded-md text-left text-[13px] transition-colors motion-safe:duration-150',
      isActive
        ? 'bg-surface-elevated/80 text-foreground'
        : 'text-muted hover:bg-surface-elevated/40 hover:text-foreground'
    )

  if (typeof count === 'number') {
    return (
      <div className={cn(SIDEBAR_ROW, 'h-8')}>
        <NavLink to={to} end={end} className={linkClass}>
          <Icon className="size-3.5 shrink-0" style={color ? { color } : undefined} />
          <span className="min-w-0 flex-1 truncate">{label}</span>
        </NavLink>
        <span className={SIDEBAR_TRAILING}>{count}</span>
      </div>
    )
  }

  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => cn(linkClass({ isActive }), 'h-8 w-full px-2')}
    >
      <Icon className="size-3.5 shrink-0" style={color ? { color } : undefined} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </NavLink>
  )
}
