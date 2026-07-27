import { ConfirmDeleteDialog } from '@renderer/components/ConfirmDeleteDialog'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger
} from '@renderer/components/ui/context-menu'
import { useConnections } from '@renderer/hooks/use-connections'
import { useDeleteTag } from '@renderer/hooks/use-tags'
import { useInventoryDialogsStore } from '@renderer/stores/inventory-dialogs-store'
import type { Tag } from '@shared/types'
import { useState } from 'react'

type TagContextMenuProps = {
  tag: Tag
  children: React.ReactNode
}

export function TagContextMenu({ tag, children }: TagContextMenuProps): React.JSX.Element {
  const openDialog = useInventoryDialogsStore((s) => s.open)
  const deleteTag = useDeleteTag()
  const { data: tagged = [] } = useConnections({ tagId: tag.id })
  const [confirmOpen, setConfirmOpen] = useState(false)

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onSelect={() => openDialog({ type: 'tag', mode: 'edit', id: tag.id })}>
            Editar
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem variant="destructive" onSelect={() => setConfirmOpen(true)}>
            Excluir
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {confirmOpen ? (
        <ConfirmDeleteDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title={`Excluir tag “${tag.name}”?`}
          description="A tag será removida das conexões associadas."
          cascade={{ tagUses: tagged.length }}
          confirming={deleteTag.isPending}
          onConfirm={async () => {
            await deleteTag.mutateAsync(tag.id)
            setConfirmOpen(false)
          }}
        />
      ) : null}
    </>
  )
}
