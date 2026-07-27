import { Badge } from '@renderer/components/ui/badge'
import { cn } from '@renderer/lib/utils'
import type { Tag } from '@shared/types'

type TagBadgesProps = {
  tags: Tag[]
  className?: string
  max?: number
}

export function TagBadges({ tags, className, max = 4 }: TagBadgesProps): React.JSX.Element | null {
  if (tags.length === 0) return null

  const visible = tags.slice(0, max)
  const overflow = tags.length - visible.length

  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {visible.map((tag) => (
        <Badge
          key={tag.id}
          variant="outline"
          className="gap-1"
          style={
            tag.color
              ? {
                  borderColor: `${tag.color}55`,
                  color: tag.color,
                  backgroundColor: `${tag.color}14`
                }
              : undefined
          }
        >
          {tag.name}
        </Badge>
      ))}
      {overflow > 0 ? <Badge variant="secondary">+{overflow}</Badge> : null}
    </div>
  )
}
