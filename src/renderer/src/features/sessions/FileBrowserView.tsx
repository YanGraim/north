import { Button } from '@renderer/components/ui/button'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { toastError, toastSuccess } from '@renderer/lib/toast'
import { cn } from '@renderer/lib/utils'
import type { RemoteEntry, TransferProgress } from '@shared/protocols'
import {
  ArrowUp,
  Download,
  File,
  Folder,
  FolderPlus,
  Loader2,
  Pencil,
  RefreshCw,
  Trash2,
  Upload
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

type FileBrowserViewProps = {
  sessionId: string
  visible: boolean
}

function joinRemote(base: string, name: string): string {
  if (base === '/' || base === '') return `/${name}`
  return `${base.replace(/\/$/, '')}/${name}`
}

function parentPath(path: string): string {
  if (path === '/' || path === '') return '/'
  const trimmed = path.replace(/\/$/, '')
  const idx = trimmed.lastIndexOf('/')
  if (idx <= 0) return '/'
  return trimmed.slice(0, idx)
}

function formatSize(size: number): string {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

export function FileBrowserView({ sessionId, visible }: FileBrowserViewProps): React.JSX.Element {
  const [cwd, setCwd] = useState('/')
  const [entries, setEntries] = useState<RemoteEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const progressToasts = useRef(new Map<string, string | number>())

  const crumbs = useMemo(() => {
    if (cwd === '/') return [{ label: '/', path: '/' }]
    const parts = cwd.split('/').filter(Boolean)
    const items = [{ label: '/', path: '/' }]
    let acc = ''
    for (const part of parts) {
      acc += `/${part}`
      items.push({ label: part, path: acc })
    }
    return items
  }, [cwd])

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true)
    try {
      const list = await window.north.fs.list({ sessionId, path: cwd })
      setEntries(
        [...list].sort((a, b) => {
          if (a.type === 'dir' && b.type !== 'dir') return -1
          if (a.type !== 'dir' && b.type === 'dir') return 1
          return a.name.localeCompare(b.name)
        })
      )
    } catch (error) {
      toastError(error, 'Falha ao listar diretório')
    } finally {
      setLoading(false)
    }
  }, [cwd, sessionId])

  useEffect(() => {
    if (!visible) return
    void refresh()
  }, [visible, refresh])

  useEffect(() => {
    return window.north.fs.onProgress((progress: TransferProgress) => {
      if (progress.sessionId !== sessionId) return
      const existing = progressToasts.current.get(progress.transferId)
      const label = progress.direction === 'download' ? 'Download' : 'Upload'
      const remote = progress.remotePath.split('/').pop() ?? progress.remotePath

      if (progress.done) {
        if (existing != null) toast.dismiss(existing)
        progressToasts.current.delete(progress.transferId)
        if (progress.error) {
          toastError(new Error(progress.error))
        } else {
          toastSuccess(`${label} concluído: ${remote}`)
          void refresh()
        }
        return
      }

      const pct =
        progress.totalBytes && progress.totalBytes > 0
          ? Math.min(100, Math.round((progress.bytesTransferred / progress.totalBytes) * 100))
          : null
      const message = pct != null ? `${label} ${remote} — ${pct}%` : `${label} ${remote}…`
      if (existing != null) {
        toast.loading(message, { id: existing })
      } else {
        const id = toast.loading(message, { duration: Number.POSITIVE_INFINITY })
        progressToasts.current.set(progress.transferId, id)
      }
    })
  }, [sessionId, refresh])

  async function handleUploadFiles(files: FileList | File[]): Promise<void> {
    const list = Array.from(files)
    for (const file of list) {
      const path = window.north.fs.getPathForFile(file)
      if (!path) {
        toastError(new Error(`Não foi possível obter o caminho de “${file.name}”`))
        continue
      }
      try {
        await window.north.fs.upload({
          sessionId,
          localPath: path,
          remotePath: joinRemote(cwd, file.name)
        })
      } catch (error) {
        toastError(error, 'Falha no upload')
      }
    }
  }

  async function handleDownload(entry: RemoteEntry): Promise<void> {
    try {
      await window.north.fs.download({ sessionId, remotePath: entry.path })
    } catch (error) {
      if (error instanceof Error && error.message === 'Download cancelado') return
      toastError(error, 'Falha no download')
    }
  }

  async function handleMkdir(): Promise<void> {
    const name = window.prompt('Nome da pasta')
    if (!name?.trim()) return
    try {
      await window.north.fs.mkdir({ sessionId, path: joinRemote(cwd, name.trim()) })
      await refresh()
    } catch (error) {
      toastError(error, 'Falha ao criar pasta')
    }
  }

  async function handleRename(entry: RemoteEntry): Promise<void> {
    const name = window.prompt('Novo nome', entry.name)
    if (!name?.trim() || name.trim() === entry.name) return
    try {
      await window.north.fs.rename({
        sessionId,
        from: entry.path,
        to: joinRemote(cwd, name.trim())
      })
      await refresh()
    } catch (error) {
      toastError(error, 'Falha ao renomear')
    }
  }

  async function handleDelete(entry: RemoteEntry): Promise<void> {
    if (!window.confirm(`Excluir “${entry.name}”?`)) return
    try {
      await window.north.fs.delete({ sessionId, path: entry.path })
      setSelected(null)
      await refresh()
    } catch (error) {
      toastError(error, 'Falha ao excluir')
    }
  }

  return (
    <section
      className={cn('flex h-full min-h-0 flex-col bg-background')}
      style={{ display: visible ? 'flex' : 'none' }}
      aria-label="Navegador de arquivos"
      data-testid="file-browser"
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        if (e.dataTransfer.files.length > 0) {
          void handleUploadFiles(e.dataTransfer.files)
        }
      }}
    >
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          aria-label="Pasta superior"
          disabled={cwd === '/'}
          onClick={() => setCwd(parentPath(cwd))}
        >
          <ArrowUp className="size-3.5" />
        </Button>
        <nav
          className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto text-xs"
          aria-label="Caminho"
        >
          {crumbs.map((crumb, index) => (
            <button
              key={crumb.path}
              type="button"
              className="shrink-0 text-muted hover:text-foreground"
              onClick={() => setCwd(crumb.path)}
            >
              {index > 1 ? <span className="mr-1 text-muted">/</span> : null}
              {crumb.label}
            </button>
          ))}
        </nav>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          aria-label="Atualizar"
          onClick={() => void refresh()}
        >
          {loading ? (
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
          aria-label="Nova pasta"
          onClick={() => void handleMkdir()}
        >
          <FolderPlus className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          aria-label="Enviar arquivo"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="size-3.5" />
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          multiple
          onChange={(e) => {
            if (e.target.files) void handleUploadFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div
          className={cn(
            'min-h-full',
            dragOver && 'bg-accent/10 outline outline-1 outline-dashed outline-accent'
          )}
        >
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-surface text-[11px] uppercase tracking-wider text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Nome</th>
                <th className="w-24 px-3 py-2 font-medium">Tamanho</th>
                <th className="w-40 px-3 py-2 font-medium">Modificado</th>
                <th className="w-28 px-3 py-2 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const Icon = entry.type === 'dir' ? Folder : File
                return (
                  <tr
                    key={entry.path}
                    data-testid={`file-browser-entry-${entry.name}`}
                    className={cn(
                      'border-t border-border/60 hover:bg-surface-elevated/50',
                      selected === entry.path && 'bg-surface-elevated'
                    )}
                    onClick={() => setSelected(entry.path)}
                    onDoubleClick={() => {
                      if (entry.type === 'dir') setCwd(entry.path)
                      else void handleDownload(entry)
                    }}
                  >
                    <td className="px-3 py-1.5">
                      <div className="flex items-center gap-2">
                        <Icon className="size-3.5 shrink-0 text-muted" />
                        <span className="truncate">{entry.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-1.5 font-mono text-xs text-muted">
                      {entry.type === 'dir' ? '—' : formatSize(entry.size)}
                    </td>
                    <td className="px-3 py-1.5 font-mono text-xs text-muted">
                      {entry.modifiedAt ? new Date(entry.modifiedAt).toLocaleString('pt-BR') : '—'}
                    </td>
                    <td className="px-3 py-1.5">
                      <div className="flex items-center gap-0.5">
                        {entry.type !== 'dir' ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            aria-label={`Baixar ${entry.name}`}
                            onClick={(e) => {
                              e.stopPropagation()
                              void handleDownload(entry)
                            }}
                          >
                            <Download className="size-3.5" />
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          aria-label={`Renomear ${entry.name}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            void handleRename(entry)
                          }}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7 text-red-400"
                          aria-label={`Excluir ${entry.name}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            void handleDelete(entry)
                          }}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {!loading && entries.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted" data-testid="file-browser-empty">
              Pasta vazia — arraste arquivos para enviar
            </p>
          ) : null}
        </div>
      </ScrollArea>
    </section>
  )
}
