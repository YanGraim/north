import { useLocalProfile } from '@renderer/hooks/use-local-profile'
import { cn } from '@renderer/lib/utils'
import { Link } from 'react-router-dom'

type ProfileChipProps = {
  collapsed: boolean
}

export function ProfileChip({ collapsed }: ProfileChipProps): React.JSX.Element {
  const { effectiveName, initials } = useLocalProfile()

  if (collapsed) {
    return (
      <Link
        to="/settings#profile"
        aria-label={effectiveName}
        title={effectiveName}
        className="flex size-8 shrink-0 items-center justify-center rounded-md text-[11px] font-medium uppercase tracking-wide text-muted transition-colors hover:bg-surface-elevated/40 hover:text-foreground"
      >
        {initials}
      </Link>
    )
  }

  return (
    <Link
      to="/settings#profile"
      title={effectiveName}
      className={cn(
        'flex h-8 min-w-0 items-center gap-2 rounded-md px-2 text-left transition-colors',
        'text-muted hover:bg-surface-elevated/40 hover:text-foreground'
      )}
    >
      <span
        className="flex size-5 shrink-0 items-center justify-center rounded text-[10px] font-medium uppercase tracking-wide text-foreground"
        aria-hidden
      >
        {initials}
      </span>
      <span className="min-w-0 flex-1 truncate text-[13px]">{effectiveName}</span>
    </Link>
  )
}
