import { ConfirmDeleteDialog } from '@renderer/components/ConfirmDeleteDialog'
import { InventoryIcon } from '@renderer/components/InventoryIcon'
import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@renderer/components/ui/dropdown-menu'
import { ConnectionContextMenu } from '@renderer/features/connections/ConnectionContextMenu'
import { TagBadges } from '@renderer/features/connections/TagBadges'
import {
  useDeleteConnection,
  useDuplicateConnection,
  useToggleFavoriteConnection
} from '@renderer/hooks/use-connections'
import { useConnectionTags } from '@renderer/hooks/use-tags'
import { copyToClipboard } from '@renderer/lib/clipboard'
import { formatRelativeDate } from '@renderer/lib/connection-ui'
import { cn } from '@renderer/lib/utils'
import { useInventoryDialogsStore } from '@renderer/stores/inventory-dialogs-store'
import type { ListSort } from '@renderer/stores/ui-store'
import type { Connection } from '@shared/types'
import { MoreHorizontal, Star } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

type ConnectionListItemProps = {
  connection: Connection
  selected: boolean
  listSort?: ListSort
  onSelect: () => void
}

export function ConnectionListItem({
  connection,
  selected,
  listSort = 'name',
  onSelect
}: ConnectionListItemProps): React.JSX.Element {
  const { t } = useTranslation()
  const { data: tags = [] } = useConnectionTags(connection.id)
  const toggleFavorite = useToggleFavoriteConnection()
  const duplicate = useDuplicateConnection()
  const deleteConnection = useDeleteConnection()
  const openDialog = useInventoryDialogsStore((s) => s.open)
  const [confirmOpen, setConfirmOpen] = useState(false)

  return (
    <li>
      <ConnectionContextMenu connection={connection}>
        <div
          className={cn(
            'group relative flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors motion-safe:duration-150',
            selected ? 'bg-surface-elevated' : 'hover:bg-surface-elevated/60'
          )}
        >
          <button
            type="button"
            onClick={onSelect}
            className="absolute inset-0 z-0"
            aria-label={`Selecionar ${connection.name}`}
          />
          <span
            className="relative z-10 mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-surface text-muted ring-1 ring-border/60"
            style={
              connection.color
                ? { color: connection.color, backgroundColor: `${connection.color}18` }
                : undefined
            }
          >
            <InventoryIcon
              className="size-3.5"
              icon={connection.icon}
              protocol={connection.protocol}
            />
          </span>
          <span className="pointer-events-none relative z-10 min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="truncate text-[13px] font-medium text-foreground">
                {connection.name}
              </span>
              <Badge variant="secondary">{t('connection.badge')}</Badge>
              <Badge variant="outline" className="uppercase tracking-wide">
                {connection.protocol}
              </Badge>
            </span>
            <span className="mt-0.5 block truncate font-mono text-[12px] text-muted">
              {connection.host}:{connection.port}
            </span>
            {listSort === 'lastAccess' ? (
              <span className="mt-0.5 block truncate text-[11px] text-muted">
                {formatRelativeDate(connection.lastConnectedAt)}
              </span>
            ) : null}
            {tags.length > 0 ? <TagBadges tags={tags} className="mt-1.5" max={3} /> : null}
          </span>
          <span className="relative z-10 flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity motion-safe:duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7"
              aria-label={
                connection.isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'
              }
              disabled={toggleFavorite.isPending}
              onClick={(event) => {
                event.stopPropagation()
                toggleFavorite.mutate(connection.id)
              }}
            >
              <Star
                className={
                  connection.isFavorite ? 'size-3.5 fill-accent text-accent' : 'size-3.5 text-muted'
                }
              />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  aria-label="Mais ações"
                  onClick={(event) => event.stopPropagation()}
                >
                  <MoreHorizontal className="size-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
                <DropdownMenuItem
                  onSelect={() =>
                    openDialog({ type: 'connection', mode: 'edit', id: connection.id })
                  }
                >
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => duplicate.mutate(connection.id)}>
                  Duplicar
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => void copyToClipboard(connection.host, 'Host')}>
                  Copiar IP
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!connection.username}
                  onSelect={() =>
                    connection.username
                      ? void copyToClipboard(connection.username, 'Usuário')
                      : undefined
                  }
                >
                  Copiar usuário
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => setConfirmOpen(true)}>
                  Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </span>
          {connection.isFavorite ? (
            <Star className="relative z-10 mt-1 size-3.5 shrink-0 fill-accent text-accent group-hover:hidden" />
          ) : null}
        </div>
      </ConnectionContextMenu>

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
    </li>
  )
}
