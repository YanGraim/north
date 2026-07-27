import { EmptyState } from '@renderer/components/EmptyState'
import { Skeleton } from '@renderer/components/ui/skeleton'
import { AccessListItem } from '@renderer/features/accesses/AccessListItem'
import { ConnectionListItem } from '@renderer/features/connections/ConnectionListItem'
import { useSelectedAccessId, useSelectedConnectionId } from '@renderer/hooks/use-route-selection'
import { useInventoryDialogsStore } from '@renderer/stores/inventory-dialogs-store'
import type { Access, Connection } from '@shared/types'
import { Server } from 'lucide-react'

export type InventoryListItem =
  | { kind: 'connection'; connection: Connection }
  | { kind: 'access'; access: Access }

type ConnectionListProps = {
  items: InventoryListItem[]
  listSort?: 'name' | 'lastAccess'
  isLoading: boolean
  isError: boolean
  emptyTitle?: string
  emptyDescription?: string
  emptyActionLabel?: string
  onEmptyAction?: () => void
  emptySecondaryActionLabel?: string
  onEmptySecondaryAction?: () => void
  createDefaults?: {
    groupId?: string
    environmentId?: string
    clientId?: string
  }
}

export function ConnectionList({
  items,
  listSort = 'name',
  isLoading,
  isError,
  emptyTitle = 'Nenhuma conexão',
  emptyDescription = 'Não há conexões neste contexto.',
  emptyActionLabel,
  onEmptyAction,
  emptySecondaryActionLabel,
  onEmptySecondaryAction,
  createDefaults
}: ConnectionListProps): React.JSX.Element {
  const { connectionId, setConnectionId } = useSelectedConnectionId()
  const { accessId, setAccessId } = useSelectedAccessId()
  const openDialog = useInventoryDialogsStore((s) => s.open)

  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        {['s1', 's2', 's3', 's4', 's5', 's6'].map((id) => (
          <div key={id} className="flex items-start gap-3 py-1">
            <Skeleton className="size-7 rounded-md" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-1/2" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <EmptyState
        icon={Server}
        title="Falha ao carregar"
        description="Não foi possível listar o inventário. Tente novamente."
      />
    )
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={Server}
        title={emptyTitle}
        description={emptyDescription}
        actionLabel={emptyActionLabel ?? (createDefaults ? 'Nova conexão' : undefined)}
        onAction={
          onEmptyAction ??
          (createDefaults
            ? () =>
                openDialog({
                  type: 'connection',
                  mode: 'create',
                  groupId: createDefaults.groupId,
                  environmentId: createDefaults.environmentId,
                  clientId: createDefaults.clientId
                })
            : undefined)
        }
        secondaryActionLabel={emptySecondaryActionLabel}
        onSecondaryAction={onEmptySecondaryAction}
      />
    )
  }

  return (
    <ul className="divide-y divide-border/80">
      {items.map((item) =>
        item.kind === 'connection' ? (
          <ConnectionListItem
            key={`c-${item.connection.id}`}
            connection={item.connection}
            listSort={listSort}
            selected={item.connection.id === connectionId}
            onSelect={() =>
              setConnectionId(item.connection.id === connectionId ? null : item.connection.id)
            }
          />
        ) : (
          <AccessListItem
            key={`a-${item.access.id}`}
            access={item.access}
            selected={item.access.id === accessId}
            onSelect={() => setAccessId(item.access.id === accessId ? null : item.access.id)}
          />
        )
      )}
    </ul>
  )
}
