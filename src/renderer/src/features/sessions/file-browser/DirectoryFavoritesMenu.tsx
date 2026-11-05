import { Button } from '@renderer/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@renderer/components/ui/dropdown-menu'
import { queryKeys } from '@renderer/lib/query-keys'
import { toastError, toastWarning } from '@renderer/lib/toast'
import type { RemoteEntry } from '@shared/protocols'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Bookmark, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

type DirectoryFavoritesMenuProps = {
  connectionId: string
  /** Folder the pane is listing. The path draft is not this value. */
  path: string
  canAdd: boolean
  list: (path: string) => Promise<RemoteEntry[]>
  onOpen: (path: string) => void
}

export function DirectoryFavoritesMenu({
  connectionId,
  path,
  canAdd,
  list,
  onOpen
}: DirectoryFavoritesMenuProps): React.JSX.Element {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState(false)
  const favorites = useQuery({
    queryKey: queryKeys.connections.directoryFavorites(connectionId),
    queryFn: () => window.north.connections.listDirectoryFavorites(connectionId)
  })
  const paths = favorites.data ?? []

  function refresh(): void {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.connections.directoryFavorites(connectionId)
    })
  }

  async function add(): Promise<void> {
    if (!canAdd || busy) return
    setBusy(true)
    try {
      const result = await window.north.connections.addDirectoryFavorite(connectionId, path)
      if (result.status === 'duplicate') {
        toastWarning(t('connection.fileBrowser.favoritesDuplicate'))
      } else if (result.status === 'invalid') {
        toastWarning(t('connection.fileBrowser.favoritesInvalid'))
      }
      refresh()
    } catch (error) {
      toastError(error, t('connection.fileBrowser.favoritesInvalid'))
    } finally {
      setBusy(false)
    }
  }

  async function open(favoritePath: string): Promise<void> {
    try {
      await list(favoritePath)
      onOpen(favoritePath)
    } catch (error) {
      toastError(error, 'Falha ao listar diretório')
    }
  }

  async function remove(favoritePath: string): Promise<void> {
    try {
      await window.north.connections.removeDirectoryFavorite(connectionId, favoritePath)
      refresh()
    } catch (error) {
      toastError(error, t('connection.fileBrowser.favoritesInvalid'))
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          aria-label={t('connection.fileBrowser.favorites')}
          data-testid="directory-favorites"
        >
          <Bookmark className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-64 w-72 overflow-y-auto">
        <DropdownMenuItem
          disabled={!canAdd || busy}
          data-testid="directory-favorites-add"
          onSelect={() => void add()}
        >
          {t('connection.fileBrowser.favoritesAdd')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {paths.length === 0 ? (
          <p className="px-2 py-1.5 text-xs text-muted" data-testid="directory-favorites-empty">
            {t('connection.fileBrowser.favoritesEmpty')}
          </p>
        ) : (
          paths.map((favoritePath) => (
            <DropdownMenuItem
              key={favoritePath}
              className="font-mono"
              title={favoritePath}
              data-testid="directory-favorites-item"
              onSelect={() => void open(favoritePath)}
            >
              <span className="min-w-0 flex-1 truncate">{favoritePath}</span>
              <button
                type="button"
                className="rounded p-0.5 text-muted hover:text-foreground"
                aria-label={`${t('connection.fileBrowser.favoritesRemove')} ${favoritePath}`}
                data-testid="directory-favorites-remove"
                onPointerDown={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  void remove(favoritePath)
                }}
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                }}
              >
                <X className="size-3.5" />
              </button>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
