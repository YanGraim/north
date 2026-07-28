import { ConfirmDeleteDialog } from '@renderer/components/ConfirmDeleteDialog'
import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@renderer/components/ui/dropdown-menu'
import { TagBadges } from '@renderer/features/connections/TagBadges'
import { useDeleteAccess, useToggleFavoriteAccess } from '@renderer/hooks/use-accesses'
import { useAccessTags } from '@renderer/hooks/use-tags'
import { accessDisplayIcon } from '@renderer/lib/access-ui'
import { cn } from '@renderer/lib/utils'
import { useInventoryDialogsStore } from '@renderer/stores/inventory-dialogs-store'
import type { Access } from '@shared/types'
import { MoreHorizontal, Star } from 'lucide-react'
import { useState } from 'react'

type AccessListItemProps = {
  access: Access
  selected: boolean
  onSelect: () => void
}

export function AccessListItem({
  access,
  selected,
  onSelect
}: AccessListItemProps): React.JSX.Element {
  const Icon = accessDisplayIcon(access)
  const { data: tags = [] } = useAccessTags(access.id)
  const toggleFavorite = useToggleFavoriteAccess()
  const deleteAccess = useDeleteAccess()
  const openDialog = useInventoryDialogsStore((s) => s.open)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const subtitle =
    access.type === 'database'
      ? [access.host, access.port ? String(access.port) : null].filter(Boolean).join(':') ||
        access.database ||
        '—'
      : access.url || access.username || '—'

  return (
    <li>
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
          aria-label={`Selecionar ${access.name}`}
        />
        <span
          className="relative z-10 mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-surface text-muted ring-1 ring-border/60"
          style={
            access.color ? { color: access.color, backgroundColor: `${access.color}18` } : undefined
          }
        >
          <Icon className="size-3.5" />
        </span>
        <span className="pointer-events-none relative z-10 min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-[13px] font-medium text-foreground">{access.name}</span>
            <Badge variant="secondary">{accessTypeLabel(access.type)}</Badge>
          </span>
          <span className="mt-0.5 block truncate font-mono text-[12px] text-muted">{subtitle}</span>
          {tags.length > 0 ? <TagBadges tags={tags} className="mt-1.5" max={3} /> : null}
        </span>
        <span className="relative z-10 flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity motion-safe:duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label={access.isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
            disabled={toggleFavorite.isPending}
            onClick={(event) => {
              event.stopPropagation()
              toggleFavorite.mutate(access.id)
            }}
          >
            <Star
              className={
                access.isFavorite ? 'size-3.5 fill-accent text-accent' : 'size-3.5 text-muted'
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
              >
                <MoreHorizontal className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={() => openDialog({ type: 'access', mode: 'edit', id: access.id })}
              >
                Editar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setConfirmOpen(true)}>
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </span>
      </div>

      <ConfirmDeleteDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Excluir acesso?"
        description={`O acesso “${access.name}” será removido permanentemente.`}
        confirming={deleteAccess.isPending}
        onConfirm={async () => {
          await deleteAccess.mutateAsync(access.id)
          setConfirmOpen(false)
        }}
      />
    </li>
  )
}
