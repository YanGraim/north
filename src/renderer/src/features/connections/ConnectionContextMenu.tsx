import { ConfirmDeleteDialog } from '@renderer/components/ConfirmDeleteDialog'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger
} from '@renderer/components/ui/context-menu'
import {
  useDeleteConnection,
  useDuplicateConnection,
  useToggleFavoriteConnection
} from '@renderer/hooks/use-connections'
import { copyToClipboard } from '@renderer/lib/clipboard'
import { toastError } from '@renderer/lib/toast'
import { useInventoryDialogsStore } from '@renderer/stores/inventory-dialogs-store'
import { openConnectionSession, sessionKindForProtocol } from '@renderer/stores/sessions-store'
import type { Connection } from '@shared/types'
import { useState } from 'react'

type ConnectionContextMenuProps = {
  connection: Connection
  children: React.ReactNode
}

export function ConnectionContextMenu({
  connection,
  children
}: ConnectionContextMenuProps): React.JSX.Element {
  const openDialog = useInventoryDialogsStore((s) => s.open)
  const toggleFavorite = useToggleFavoriteConnection()
  const duplicate = useDuplicateConnection()
  const deleteConnection = useDeleteConnection()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [connecting, setConnecting] = useState(false)

  async function handleConnect(): Promise<void> {
    setConnecting(true)
    try {
      await openConnectionSession(connection.id, {
        title: connection.name,
        protocol: connection.protocol,
        sessionKind: sessionKindForProtocol(connection.protocol),
        username: connection.username,
        host: connection.host
      })
    } catch (error) {
      toastError(error, 'Não foi possível conectar. Verifique a senha salva e tente novamente.')
    } finally {
      setConnecting(false)
    }
  }

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem
            disabled={connecting || !sessionKindForProtocol(connection.protocol)}
            onSelect={() => void handleConnect()}
          >
            {connecting ? 'Conectando…' : 'Conectar'}
          </ContextMenuItem>
          <ContextMenuItem
            onSelect={() => openDialog({ type: 'connection', mode: 'edit', id: connection.id })}
          >
            Editar
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => duplicate.mutate(connection.id)}>
            Duplicar
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onSelect={() => void copyToClipboard(connection.host, 'Host')}>
            Copiar IP
          </ContextMenuItem>
          <ContextMenuItem
            disabled={!connection.username}
            onSelect={() =>
              connection.username ? void copyToClipboard(connection.username, 'Usuário') : undefined
            }
          >
            Copiar usuário
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => toggleFavorite.mutate(connection.id)}>
            {connection.isFavorite ? 'Remover dos favoritos' : 'Favoritar'}
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem variant="destructive" onSelect={() => setConfirmOpen(true)}>
            Excluir
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <ConfirmDeleteDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Excluir conexão?"
        description={`A conexão “${connection.name}” será removida permanentemente.`}
        confirming={deleteConnection.isPending}
        onConfirm={async () => {
          await deleteConnection.mutateAsync(connection.id)
          setConfirmOpen(false)
        }}
      />
    </>
  )
}
