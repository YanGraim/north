import { Badge } from '@renderer/components/ui/badge'
import {
  environmentBadgeLabel,
  environmentKind,
  environmentStatusColor
} from '@renderer/lib/environment-color'
import { cn } from '@renderer/lib/utils'

type EnvironmentBadgeProps = {
  name: string
  color?: string | null
  className?: string
  /** Mostra o nome completo ao lado do rótulo curto (PROD/HML/DEV). */
  showFullName?: boolean
}

export function EnvironmentBadge({
  name,
  color,
  className,
  showFullName = false
}: EnvironmentBadgeProps): React.JSX.Element {
  const kind = environmentKind(name)
  const accent = environmentStatusColor(name, color)
  const shortLabel = environmentBadgeLabel(name)
  const emphasize = kind !== 'other'

  return (
    <Badge
      variant="outline"
      title={name}
      className={cn(
        'gap-1 font-semibold uppercase tracking-wide',
        emphasize && 'ring-1 ring-offset-0',
        className
      )}
      style={{
        borderColor: `${accent}66`,
        color: accent,
        backgroundColor: `${accent}${kind === 'production' ? '24' : '14'}`,
        ...(emphasize ? { boxShadow: `0 0 0 1px ${accent}33 inset` } : {})
      }}
    >
      {shortLabel}
      {showFullName && shortLabel !== name ? (
        <span className="font-normal normal-case tracking-normal text-muted">· {name}</span>
      ) : null}
    </Badge>
  )
}
