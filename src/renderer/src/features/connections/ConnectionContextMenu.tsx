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
import { useCanEditConnection } from '@renderer/hooks/use-permissions'
import { useWorkspaces } from '@renderer/hooks/use-workspaces'
import { copyToClipboard } from '@renderer/lib/clipboard'
import { toastError } from '@renderer/lib/toast'
import { useCopyToWorkspaceStore } from '@renderer/stores/copy-to-workspace-store'
import { useInventoryDialogsStore } from '@renderer/stores/inventory-dialogs-store'
import { openConnectionSession, sessionKindForProtocol } from '@renderer/stores/sessions-store'
import type { Connection } from '@shared/types'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

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
  const canEdit = useCanEditConnection(connection)
  const { t } = useTranslation()
  const openCopy = useCopyToWorkspaceStore((s) => s.open)
  const canCopy = (useWorkspaces().data?.length ?? 0) > 1

  async function handleConnect(as?: 'sftp'): Promise<void> {
    setConnecting(true)
    try {
      const protocol = as ?? connection.protocol
      await openConnectionSession(connection.id, {
        title: as ? `${connection.name} (arquivos)` : connection.name,
        protocol,
        sessionKind: sessionKindForProtocol(protocol),
        username: connection.username,
        host: connection.host,
        as
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
          {connection.protocol === 'ssh' ? (
            <ContextMenuItem disabled={connecting} onSelect={() => void handleConnect('sftp')}>
              Abrir arquivos (SFTP)
            </ContextMenuItem>
          ) : null}
          {canEdit ? (
            <>
              <ContextMenuItem
                onSelect={() => openDialog({ type: 'connection', mode: 'edit', id: connection.id })}
              >
                Editar
              </ContextMenuItem>
              <ContextMenuItem onSelect={() => duplicate.mutate(connection.id)}>
                Duplicar
              </ContextMenuItem>
            </>
          ) : null}
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
          {canCopy ? (
            <ContextMenuItem
              onSelect={() =>
                openCopy({ kind: 'connection', id: connection.id, name: connection.name })
              }
            >
              {t('workspaces.copy.menu')}
            </ContextMenuItem>
          ) : null}
          {canEdit ? (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem variant="destructive" onSelect={() => setConfirmOpen(true)}>
                Excluir
              </ContextMenuItem>
            </>
          ) : null}
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
