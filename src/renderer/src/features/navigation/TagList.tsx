import { Skeleton } from '@renderer/components/ui/skeleton'
import { NavItem } from '@renderer/features/navigation/NavItem'
import { TagContextMenu } from '@renderer/features/navigation/TagContextMenu'
import { useConnections } from '@renderer/hooks/use-connections'
import { useTags } from '@renderer/hooks/use-tags'
import { useInventoryDialogsStore } from '@renderer/stores/inventory-dialogs-store'
import { Tag } from 'lucide-react'

export function TagList({ collapsed }: { collapsed: boolean }): React.JSX.Element {
  const { data: tags = [], isLoading } = useTags()
  const openDialog = useInventoryDialogsStore((s) => s.open)

  if (isLoading && !collapsed) {
    return (
      <div className="flex flex-col gap-2 px-2">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-4/5" />
      </div>
    )
  }

  if (tags.length === 0 && !collapsed) {
    return (
      <div className="space-y-2 px-2 py-1">
        <p className="text-xs text-muted">Nenhuma tag</p>
        <button
          type="button"
          className="text-xs text-accent hover:underline"
          onClick={() => openDialog({ type: 'tag', mode: 'create' })}
        >
          Criar tag
        </button>
      </div>
    )
  }

  return (
    <>
      {tags.map((tag) => (
        <TagContextMenu key={tag.id} tag={tag}>
          <TagNavItem tagId={tag.id} name={tag.name} color={tag.color} collapsed={collapsed} />
        </TagContextMenu>
      ))}
    </>
  )
}

function TagNavItem({
  tagId,
  name,
  color,
  collapsed
}: {
  tagId: string
  name: string
  color: string | null
  collapsed: boolean
}): React.JSX.Element {
  const { data: tagged = [] } = useConnections({ tagId })

  return (
    <NavItem
      to={`/tags/${tagId}`}
      label={name}
      icon={Tag}
      collapsed={collapsed}
      count={tagged.length}
      color={color}
      plain
    />
  )
}
