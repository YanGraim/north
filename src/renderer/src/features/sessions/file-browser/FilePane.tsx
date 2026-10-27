import { ConfirmDeleteDialog } from '@renderer/components/ConfirmDeleteDialog'
import { Button } from '@renderer/components/ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger
} from '@renderer/components/ui/context-menu'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { toastError } from '@renderer/lib/toast'
import { cn } from '@renderer/lib/utils'
import type { RemoteEntry } from '@shared/protocols'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowDown,
  ArrowUp,
  CornerLeftUp,
  File,
  Folder,
  FolderPlus,
  HardDrive,
  Home,
  Link2,
  Loader2,
  RefreshCw
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { NameDialog, type NameRequest } from './NameDialog'
import { formatSize, isRootPath, joinPath, type PathStyle, parentPath } from './paths'

export type PaneSide = 'local' | 'remote'

/** Everything a pane needs from its backend — the local disk or the session's server. */
export type PaneSource = {
  side: PaneSide
  sessionId: string
  sep: PathStyle
  home: string
  roots: string[]
  list: (path: string) => Promise<RemoteEntry[]>
  mkdir: (path: string) => Promise<void>
  rename: (from: string, to: string) => Promise<void>
  remove: (path: string) => Promise<void>
  /** Double-click on a file. */
  openFile: (entry: RemoteEntry) => void
}

export const FILE_DRAG_MIME = 'application/x-north-files'

export type FileDragPayload = { from: PaneSide; sessionId: string; entries: RemoteEntry[] }

export function paneQueryKey(side: PaneSide, sessionId: string, path?: string): unknown[] {
  return path ? ['file-browser', side, sessionId, path] : ['file-browser', side, sessionId]
}

type SortKey = 'name' | 'size' | 'modifiedAt' | 'permissions' | 'owner'

function compareEntries(a: RemoteEntry, b: RemoteEntry, key: SortKey, dir: 1 | -1): number {
  // Folders always first, like WinSCP/Explorer.
  if (a.type === 'dir' && b.type !== 'dir') return -1
  if (a.type !== 'dir' && b.type === 'dir') return 1
  let result = 0
  if (key === 'size') result = a.size - b.size
  else if (key === 'modifiedAt') result = (a.modifiedAt ?? '').localeCompare(b.modifiedAt ?? '')
  else if (key === 'name') result = a.name.localeCompare(b.name, undefined, { numeric: true })
  else result = (a[key] ?? '').localeCompare(b[key] ?? '')
  return result * dir || a.name.localeCompare(b.name)
}

type FilePaneProps = {
  source: PaneSource
  path: string
  onPathChange: (path: string) => void
  visible: boolean
  active: boolean
  onActivate: () => void
  /** F5 / "Copiar para o outro lado". */
  onCopy: (entries: RemoteEntry[]) => void
  /** Something was dropped on this pane (from the other pane or the OS). */
  onDrop: (payload: FileDragPayload | null, osPaths: string[]) => void
  copyLabel: string
}

export function FilePane({
  source,
  path,
  onPathChange,
  visible,
  active,
  onActivate,
  onCopy,
  onDrop,
  copyLabel
}: FilePaneProps): React.JSX.Element {
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [anchor, setAnchor] = useState<string | null>(null)
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'name', dir: 1 })
  const [pathDraft, setPathDraft] = useState(path)
  const [dragOver, setDragOver] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<RemoteEntry[] | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [nameRequest, setNameRequest] = useState<NameRequest | null>(null)
  const rootRef = useRef<HTMLElement>(null)

  useEffect(() => {
    setPathDraft(path)
    setSelected(new Set())
    setAnchor(null)
  }, [path])

  const query = useQuery({
    queryKey: paneQueryKey(source.side, source.sessionId, path),
    queryFn: () => source.list(path),
    enabled: visible && path !== '',
    retry: false
  })

  useEffect(() => {
    if (query.error) toastError(query.error, 'Falha ao listar diretório')
  }, [query.error])

  const entries = useMemo(
    () =>
      [...(query.data ?? [])]
        .filter((e) => e.name !== '.' && e.name !== '..')
        .sort((a, b) => compareEntries(a, b, sort.key, sort.dir)),
    [query.data, sort]
  )
  const selectedEntries = entries.filter((e) => selected.has(e.path))
  const showOwner = source.side === 'remote' || source.sep === '/'

  function refresh(): void {
    void queryClient.invalidateQueries({ queryKey: paneQueryKey(source.side, source.sessionId) })
  }

  function open(entry: RemoteEntry): void {
    if (entry.type === 'dir' || entry.type === 'link') {
      // A link may point to a file; listing it fails harmlessly and we stay put.
      if (entry.type === 'link' && source.side === 'remote') {
        source
          .list(entry.path)
          .then(() => onPathChange(entry.path))
          .catch(() => source.openFile(entry))
        return
      }
      onPathChange(entry.path)
      return
    }
    source.openFile(entry)
  }

  function select(entry: RemoteEntry, event: React.MouseEvent): void {
    onActivate()
    if (event.shiftKey && anchor) {
      const from = entries.findIndex((e) => e.path === anchor)
      const to = entries.findIndex((e) => e.path === entry.path)
      const [lo, hi] = from < to ? [from, to] : [to, from]
      setSelected(new Set(entries.slice(lo, hi + 1).map((e) => e.path)))
      return
    }
    if (event.metaKey || event.ctrlKey) {
      const next = new Set(selected)
      if (next.has(entry.path)) next.delete(entry.path)
      else next.add(entry.path)
      setSelected(next)
      setAnchor(entry.path)
      return
    }
    if (!selected.has(entry.path) || selected.size > 1) {
      setSelected(new Set([entry.path]))
    }
    setAnchor(entry.path)
  }

  function mkdir(): void {
    setNameRequest({
      title: 'Nova pasta',
      confirmLabel: 'Criar',
      initial: '',
      onSubmit: async (name) => {
        try {
          await source.mkdir(joinPath(path, name, source.sep))
          refresh()
        } catch (error) {
          toastError(error, 'Falha ao criar pasta')
          throw error
        }
      }
    })
  }

  function rename(entry: RemoteEntry): void {
    setNameRequest({
      title: `Renomear “${entry.name}”`,
      confirmLabel: 'Renomear',
      initial: entry.name,
      onSubmit: async (name) => {
        if (name === entry.name) return
        try {
          await source.rename(entry.path, joinPath(path, name, source.sep))
          refresh()
        } catch (error) {
          toastError(error, 'Falha ao renomear')
          throw error
        }
      }
    })
  }

  function remove(targets: RemoteEntry[]): void {
    if (targets.length > 0) setPendingDelete(targets)
  }

  async function confirmRemove(): Promise<void> {
    if (!pendingDelete) return
    setDeleting(true)
    for (const target of pendingDelete) {
      try {
        await source.remove(target.path)
      } catch (error) {
        toastError(error, `Falha ao excluir ${target.name}`)
      }
    }
    setDeleting(false)
    setPendingDelete(null)
    setSelected(new Set())
    refresh()
  }

  const deleteLabel = pendingDelete
    ? pendingDelete.length === 1
      ? `“${pendingDelete[0].name}”`
      : `${pendingDelete.length} itens`
    : ''
  const deleteHasFolder = pendingDelete?.some((e) => e.type === 'dir') ?? false
  // The server has no trash: say plainly that this is permanent, and what a folder takes with it.
  const deleteDescription =
    source.side === 'local'
      ? `${deleteLabel} vai para a lixeira do sistema e pode ser restaurado de lá.`
      : `${deleteLabel} será apagado do servidor permanentemente — não há lixeira em SFTP/FTP e não dá para desfazer.${
          deleteHasFolder ? ' Pastas são apagadas com todo o conteúdo.' : ''
        }`

  function handleKeyDown(event: React.KeyboardEvent): void {
    if ((event.target as HTMLElement).tagName === 'INPUT') return
    const first = selectedEntries[0]
    if (event.key === 'F5') {
      event.preventDefault()
      if (selectedEntries.length > 0) onCopy(selectedEntries)
    } else if (event.key === 'F2' && first) {
      event.preventDefault()
      rename(first)
    } else if (event.key === 'F7') {
      event.preventDefault()
      mkdir()
    } else if (event.key === 'Delete' || (event.key === 'Backspace' && event.metaKey)) {
      event.preventDefault()
      remove(selectedEntries)
    } else if (event.key === 'Enter' && first) {
      event.preventDefault()
      open(first)
    } else if (event.key === 'Backspace') {
      event.preventDefault()
      onPathChange(parentPath(path, source.sep))
    } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'a') {
      event.preventDefault()
      setSelected(new Set(entries.map((e) => e.path)))
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const idx = first ? entries.findIndex((e) => e.path === (anchor ?? first.path)) : -1
      const next =
        entries[
          Math.max(0, Math.min(entries.length - 1, idx + (event.key === 'ArrowDown' ? 1 : -1)))
        ]
      if (next) {
        setSelected(new Set([next.path]))
        setAnchor(next.path)
        rootRef.current
          ?.querySelector(`[data-path="${CSS.escape(next.path)}"]`)
          ?.scrollIntoView({ block: 'nearest' })
      }
    }
  }

  const totalFiles = entries.filter((e) => e.type !== 'dir').length
  const totalBytes = entries.reduce((sum, e) => sum + (e.type === 'dir' ? 0 : e.size), 0)
  const selBytes = selectedEntries.reduce((sum, e) => sum + (e.type === 'dir' ? 0 : e.size), 0)

  const columns: { key: SortKey; label: string; className: string }[] = [
    { key: 'name', label: 'Nome', className: '' },
    { key: 'size', label: 'Tamanho', className: 'w-20 text-right' },
    { key: 'modifiedAt', label: 'Modificado', className: 'w-36' },
    { key: 'permissions', label: 'Direitos', className: 'w-24' },
    ...(showOwner ? [{ key: 'owner' as const, label: 'Dono', className: 'w-20' }] : [])
  ]

  return (
    <section
      ref={rootRef}
      className={cn(
        'flex h-full min-h-0 min-w-0 flex-col outline-none',
        active && 'ring-1 ring-inset ring-accent/40'
      )}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: focus target for F-key shortcuts
      tabIndex={0}
      onFocus={onActivate}
      onKeyDown={handleKeyDown}
      data-testid={`file-pane-${source.side}`}
      aria-label={source.side === 'local' ? 'Arquivos locais' : 'Arquivos remotos'}
    >
      <div className="flex items-center gap-1 border-b border-border px-2 py-1.5">
        {source.roots.length > 1 ? (
          <select
            className="h-7 rounded border border-border bg-surface px-1 font-mono text-xs"
            aria-label="Unidade"
            value={source.roots.find((r) => path.toUpperCase().startsWith(r.toUpperCase())) ?? ''}
            onChange={(e) => onPathChange(e.target.value)}
          >
            {source.roots.map((root) => (
              <option key={root} value={root}>
                {root}
              </option>
            ))}
          </select>
        ) : (
          <HardDrive className="mx-1 size-3.5 text-muted" aria-hidden />
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          aria-label="Pasta superior"
          disabled={isRootPath(path, source.sep)}
          onClick={() => onPathChange(parentPath(path, source.sep))}
        >
          <CornerLeftUp className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          aria-label="Pasta inicial"
          onClick={() => onPathChange(source.home)}
        >
          <Home className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          aria-label="Atualizar"
          onClick={refresh}
        >
          {query.isFetching ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <RefreshCw className="size-3.5" />
          )}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          aria-label="Nova pasta (F7)"
          onClick={() => mkdir()}
        >
          <FolderPlus className="size-3.5" />
        </Button>
        <input
          className="h-7 min-w-0 flex-1 rounded border border-border bg-surface px-2 font-mono text-xs"
          aria-label="Caminho"
          value={pathDraft}
          onChange={(e) => setPathDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && pathDraft.trim()) onPathChange(pathDraft.trim())
            if (e.key === 'Escape') setPathDraft(path)
          }}
          onBlur={() => setPathDraft(path)}
        />
      </div>

      <ContextMenu>
        <ContextMenuTrigger asChild>
          <ScrollArea className="min-h-0 flex-1">
            {/* biome-ignore lint/a11y/noStaticElementInteractions: drop zone */}
            <div
              className={cn(
                'min-h-full',
                dragOver && 'bg-accent/10 outline outline-1 outline-dashed outline-accent'
              )}
              onDragOver={(e) => {
                const fromOtherPane = e.dataTransfer.types.includes(FILE_DRAG_MIME)
                const fromOs = e.dataTransfer.types.includes('Files')
                if (!fromOtherPane && !fromOs) return
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragOver(false)
                const raw = e.dataTransfer.getData(FILE_DRAG_MIME)
                const payload = raw ? (JSON.parse(raw) as FileDragPayload) : null
                if (payload && payload.from === source.side) return
                const osPaths = payload
                  ? []
                  : Array.from(e.dataTransfer.files)
                      .map((file) => window.north.fs.getPathForFile(file))
                      .filter(Boolean)
                onDrop(payload, osPaths)
              }}
            >
              <table className="w-full table-fixed text-left text-xs">
                <thead className="sticky top-0 z-10 bg-surface text-[11px] text-muted">
                  <tr>
                    {columns.map((col) => (
                      <th key={col.key} className={cn('px-2 py-1.5 font-medium', col.className)}>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 hover:text-foreground"
                          onClick={() =>
                            setSort((s) => ({
                              key: col.key,
                              dir: s.key === col.key ? (s.dir === 1 ? -1 : 1) : 1
                            }))
                          }
                        >
                          {col.label}
                          {sort.key === col.key ? (
                            sort.dir === 1 ? (
                              <ArrowUp className="size-3" />
                            ) : (
                              <ArrowDown className="size-3" />
                            )
                          ) : null}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {!isRootPath(path, source.sep) ? (
                    <tr
                      className="cursor-default hover:bg-surface-elevated/50"
                      onDoubleClick={() => onPathChange(parentPath(path, source.sep))}
                    >
                      <td className="px-2 py-1" colSpan={columns.length}>
                        <div className="flex items-center gap-2 text-muted">
                          <CornerLeftUp className="size-3.5" />
                          ..
                        </div>
                      </td>
                    </tr>
                  ) : null}
                  {entries.map((entry) => {
                    const Icon =
                      entry.type === 'dir' ? Folder : entry.type === 'link' ? Link2 : File
                    const isSelected = selected.has(entry.path)
                    const hidden = entry.name.startsWith('.')
                    return (
                      <tr
                        key={entry.path}
                        data-path={entry.path}
                        data-testid={`file-browser-entry-${entry.name}`}
                        draggable
                        onDragStart={(e) => {
                          const dragged = isSelected ? selectedEntries : [entry]
                          if (!isSelected) setSelected(new Set([entry.path]))
                          const payload: FileDragPayload = {
                            from: source.side,
                            sessionId: source.sessionId,
                            entries: dragged
                          }
                          e.dataTransfer.setData(FILE_DRAG_MIME, JSON.stringify(payload))
                          e.dataTransfer.effectAllowed = 'copy'
                        }}
                        className={cn(
                          'cursor-default border-t border-border/40',
                          isSelected ? 'bg-accent/20' : 'hover:bg-surface-elevated/50',
                          hidden && 'text-muted'
                        )}
                        onClick={(e) => select(entry, e)}
                        onContextMenu={(e) => {
                          if (!isSelected) select(entry, e)
                        }}
                        onDoubleClick={() => open(entry)}
                      >
                        <td className="px-2 py-1">
                          <div className="flex min-w-0 items-center gap-2">
                            <Icon
                              className={cn(
                                'size-3.5 shrink-0',
                                entry.type === 'dir' ? 'text-accent' : 'text-muted'
                              )}
                            />
                            <span className="truncate">{entry.name}</span>
                          </div>
                        </td>
                        <td className="px-2 py-1 text-right font-mono text-muted">
                          {entry.type === 'dir' ? '' : formatSize(entry.size)}
                        </td>
                        <td className="truncate px-2 py-1 font-mono text-muted">
                          {entry.modifiedAt
                            ? new Date(entry.modifiedAt).toLocaleString(undefined, {
                                dateStyle: 'short',
                                timeStyle: 'short'
                              })
                            : ''}
                        </td>
                        <td className="px-2 py-1 font-mono text-muted">
                          {entry.permissions ?? ''}
                        </td>
                        {showOwner ? (
                          <td className="truncate px-2 py-1 font-mono text-muted">
                            {entry.owner ?? ''}
                          </td>
                        ) : null}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {!query.isFetching && entries.length === 0 ? (
                <p className="p-6 text-center text-xs text-muted" data-testid="file-browser-empty">
                  Pasta vazia — arraste arquivos para cá
                </p>
              ) : null}
            </div>
          </ScrollArea>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem
            disabled={selectedEntries.length === 0}
            onSelect={() => onCopy(selectedEntries)}
          >
            {copyLabel} <span className="ml-auto pl-4 font-mono text-[10px] text-muted">F5</span>
          </ContextMenuItem>
          <ContextMenuItem
            disabled={selectedEntries.length !== 1}
            onSelect={() => selectedEntries[0] && open(selectedEntries[0])}
          >
            Abrir
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            disabled={selectedEntries.length !== 1}
            onSelect={() => selectedEntries[0] && rename(selectedEntries[0])}
          >
            Renomear <span className="ml-auto pl-4 font-mono text-[10px] text-muted">F2</span>
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => mkdir()}>
            Nova pasta <span className="ml-auto pl-4 font-mono text-[10px] text-muted">F7</span>
          </ContextMenuItem>
          <ContextMenuItem onSelect={refresh}>Atualizar</ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            variant="destructive"
            disabled={selectedEntries.length === 0}
            onSelect={() => remove(selectedEntries)}
          >
            Excluir <span className="ml-auto pl-4 font-mono text-[10px] text-muted">Del</span>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <div className="border-t border-border px-2 py-1 font-mono text-[11px] text-muted">
        {formatSize(selBytes)} de {formatSize(totalBytes)} em {selectedEntries.length} de{' '}
        {entries.length}
        {totalFiles !== entries.length ? ` (${totalFiles} arquivos)` : ''}
      </div>
      <NameDialog
        request={nameRequest}
        onClose={() => {
          setNameRequest(null)
          rootRef.current?.focus()
        }}
      />
      <ConfirmDeleteDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open && !deleting) setPendingDelete(null)
        }}
        title={source.side === 'local' ? 'Mover para a lixeira?' : 'Excluir do servidor?'}
        description={deleteDescription}
        confirming={deleting}
        onConfirm={confirmRemove}
      />
    </section>
  )
}
