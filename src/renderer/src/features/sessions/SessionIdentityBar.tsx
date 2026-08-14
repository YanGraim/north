import { environmentStatusColor, hasEnvironmentContext } from '@renderer/lib/environment-color'
import { cn } from '@renderer/lib/utils'
import { Folder, User } from 'lucide-react'

type SessionIdentityBarProps = {
  username?: string | null
  host?: string | null
  /** Chip with folder icon — connection/session title or environment name. */
  folderLabel: string
  environmentName?: string | null
  environmentColor?: string | null
  className?: string
  children?: React.ReactNode
}

export function SessionIdentityBar({
  username,
  host,
  folderLabel,
  environmentName,
  environmentColor,
  className,
  children
}: SessionIdentityBarProps): React.JSX.Element {
  const identity =
    username && host ? `${username}@${host}` : host ? host : username ? username : null
  const hasContext = Boolean(environmentName && hasEnvironmentContext(environmentName))
  const accent = hasContext ? environmentStatusColor(environmentName ?? '', environmentColor) : null

  return (
    <div
      className={cn(
        'flex h-9 shrink-0 items-center gap-2 border-b px-3',
        accent ? '' : 'border-border bg-surface',
        className
      )}
      style={
        accent
          ? {
              borderColor: `${accent}4d`,
              backgroundColor: `${accent}1a`
            }
          : undefined
      }
      data-testid="session-identity-bar"
    >
      {identity ? (
        <span className="inline-flex items-center gap-1.5 rounded-md bg-surface-elevated px-2 py-1 font-mono text-[11px] text-foreground">
          <User className="size-3 text-muted" aria-hidden />
          {identity}
        </span>
      ) : null}
      <span className="inline-flex min-w-0 items-center gap-1.5 rounded-md bg-surface-elevated px-2 py-1 font-mono text-[11px] text-foreground">
        <Folder className="size-3 shrink-0 text-muted" aria-hidden />
        <span className="truncate">{folderLabel}</span>
      </span>
      {children ? <div className="ml-auto flex shrink-0 items-center gap-1">{children}</div> : null}
    </div>
  )
}
