import { Button } from '@renderer/components/ui/button'
import { cn } from '@renderer/lib/utils'
import type { LucideIcon } from 'lucide-react'

type EmptyStateProps = {
  icon: LucideIcon
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
  secondaryActionLabel?: string
  onSecondaryAction?: () => void
  className?: string
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  className
}: EmptyStateProps): React.JSX.Element {
  return (
    <div
      className={cn(
        'flex h-full min-h-40 flex-col items-center justify-center gap-3 px-6 py-12 text-center',
        className
      )}
    >
      <div className="flex size-10 items-center justify-center rounded-md bg-surface-elevated text-muted ring-1 ring-border/70">
        <Icon className="size-5" />
      </div>
      <div className="space-y-1.5">
        <p className="text-[13px] font-medium text-foreground">{title}</p>
        {description ? (
          <p className="max-w-sm text-xs leading-relaxed text-muted">{description}</p>
        ) : null}
      </div>
      {actionLabel && onAction ? (
        <div className="mt-1 flex flex-col items-center gap-2">
          <Button type="button" variant="default" size="sm" onClick={onAction}>
            {actionLabel}
          </Button>
          {secondaryActionLabel && onSecondaryAction ? (
            <Button type="button" variant="ghost" size="sm" onClick={onSecondaryAction}>
              {secondaryActionLabel}
            </Button>
          ) : null}
        </div>
      ) : secondaryActionLabel && onSecondaryAction ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-1"
          onClick={onSecondaryAction}
        >
          {secondaryActionLabel}
        </Button>
      ) : null}
    </div>
  )
}
