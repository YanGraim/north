import { type CascadeSummary, ConfirmDeleteDialog } from '@renderer/components/ConfirmDeleteDialog'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger
} from '@renderer/components/ui/context-menu'
import { useDeleteClient } from '@renderer/hooks/use-clients'
import { useConnections } from '@renderer/hooks/use-connections'
import { useDeleteEnvironment } from '@renderer/hooks/use-environments'
import { useDeleteGroup } from '@renderer/hooks/use-groups'
import { useOrgLookup } from '@renderer/hooks/use-org-lookup'
import { useInventoryDialogsStore } from '@renderer/stores/inventory-dialogs-store'
import type { Client, Environment, Group } from '@shared/types'
import { useMemo, useState } from 'react'

type TreeNodeContextMenuProps =
  | { kind: 'client'; client: Client; children: React.ReactNode }
  | { kind: 'environment'; environment: Environment; clientId: string; children: React.ReactNode }
  | {
      kind: 'group'
      group: Group
      clientId: string
      environmentId: string
      children: React.ReactNode
    }

export function TreeNodeContextMenu(props: TreeNodeContextMenuProps): React.JSX.Element {
  const openDialog = useInventoryDialogsStore((s) => s.open)
  const { environments, groups } = useOrgLookup()
  const { data: connections = [] } = useConnections()
  const deleteClient = useDeleteClient()
  const deleteEnvironment = useDeleteEnvironment()
  const deleteGroup = useDeleteGroup()
  const [confirmOpen, setConfirmOpen] = useState(false)

  const cascade = useMemo((): CascadeSummary => {
    if (props.kind === 'client') {
      const envIds = environments.filter((e) => e.clientId === props.client.id).map((e) => e.id)
      const groupIds = groups.filter((g) => envIds.includes(g.environmentId)).map((g) => g.id)
      return {
        environments: envIds.length,
        groups: groupIds.length,
        connections: connections.filter((c) => groupIds.includes(c.groupId)).length
      }
    }
    if (props.kind === 'environment') {
      const groupIds = groups
        .filter((g) => g.environmentId === props.environment.id)
        .map((g) => g.id)
      return {
        groups: groupIds.length,
        connections: connections.filter((c) => groupIds.includes(c.groupId)).length
      }
    }
    return {
      connections: connections.filter((c) => c.groupId === props.group.id).length
    }
  }, [props, environments, groups, connections])

  const title =
    props.kind === 'client'
      ? `Excluir cliente “${props.client.name}”?`
      : props.kind === 'environment'
        ? `Excluir ambiente “${props.environment.name}”?`
        : `Excluir grupo “${props.group.name}”?`

  const description =
    props.kind === 'client'
      ? 'Ambientes, grupos e conexões deste cliente serão excluídos em cascata.'
      : props.kind === 'environment'
        ? 'Grupos e conexões deste ambiente serão excluídos em cascata.'
        : 'Conexões deste grupo serão excluídas em cascata.'

  const confirming = deleteClient.isPending || deleteEnvironment.isPending || deleteGroup.isPending

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>{props.children}</ContextMenuTrigger>
        <ContextMenuContent>
          {props.kind === 'client' ? (
            <ContextMenuItem
              onSelect={() =>
                openDialog({ type: 'environment', mode: 'create', clientId: props.client.id })
              }
            >
              Novo ambiente
            </ContextMenuItem>
          ) : null}
          {props.kind === 'environment' ? (
            <ContextMenuItem
              onSelect={() =>
                openDialog({
                  type: 'group',
                  mode: 'create',
                  environmentId: props.environment.id
                })
              }
            >
              Novo grupo
            </ContextMenuItem>
          ) : null}
          {props.kind === 'group' ? (
            <>
              <ContextMenuItem
                onSelect={() =>
                  openDialog({
                    type: 'connection',
                    mode: 'create',
                    groupId: props.group.id,
                    environmentId: props.environmentId,
                    clientId: props.clientId
                  })
                }
              >
                Nova conexão
              </ContextMenuItem>
              <ContextMenuItem
                onSelect={() =>
                  openDialog({
                    type: 'access',
                    mode: 'create',
                    groupId: props.group.id,
                    environmentId: props.environmentId,
                    clientId: props.clientId,
                    accessType: 'login'
                  })
                }
              >
                Novo acesso
              </ContextMenuItem>
            </>
          ) : null}
          <ContextMenuSeparator />
          <ContextMenuItem
            onSelect={() => {
              if (props.kind === 'client') {
                openDialog({ type: 'client', mode: 'edit', id: props.client.id })
              } else if (props.kind === 'environment') {
                openDialog({ type: 'environment', mode: 'edit', id: props.environment.id })
              } else {
                openDialog({ type: 'group', mode: 'edit', id: props.group.id })
              }
            }}
          >
            Editar
          </ContextMenuItem>
          <ContextMenuItem variant="destructive" onSelect={() => setConfirmOpen(true)}>
            Excluir
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {confirmOpen ? (
        <ConfirmDeleteDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title={title}
          description={description}
          cascade={cascade}
          confirming={confirming}
          onConfirm={async () => {
            if (props.kind === 'client') {
              await deleteClient.mutateAsync(props.client.id)
            } else if (props.kind === 'environment') {
              await deleteEnvironment.mutateAsync(props.environment.id)
            } else {
              await deleteGroup.mutateAsync(props.group.id)
            }
            setConfirmOpen(false)
          }}
        />
      ) : null}
    </>
  )
}
