import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup
} from '@renderer/components/ui/resizable'
import { toastError } from '@renderer/lib/toast'
import { useUiStore } from '@renderer/stores/ui-store'
import type { RemoteEntry, TransferConflict, TransferProgress } from '@shared/protocols'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ConflictDialog } from './file-browser/ConflictDialog'
import {
  type FileDragPayload,
  FilePane,
  type PaneSide,
  type PaneSource,
  paneQueryKey
} from './file-browser/FilePane'
import { joinPath } from './file-browser/paths'
import { TransferQueue } from './file-browser/TransferQueue'

type FileBrowserViewProps = {
  sessionId: string
  visible: boolean
}

function baseName(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? path
}

/** WinSCP-style commander: local disk on the left, the server on the right. */
export function FileBrowserView({ sessionId, visible }: FileBrowserViewProps): React.JSX.Element {
  const queryClient = useQueryClient()
  const savedLocalPath = useUiStore((s) => s.fileBrowserLocalPath)
  const setSavedLocalPath = useUiStore((s) => s.setFileBrowserLocalPath)
  const [activeSide, setActiveSide] = useState<PaneSide>('remote')
  const [localPath, setLocalPath] = useState('')
  const [remotePath, setRemotePath] = useState('')
  const [transfers, setTransfers] = useState<TransferProgress[]>([])
  const [conflictNames, setConflictNames] = useState<string[] | null>(null)
  const conflictResolver = useRef<((choice: TransferConflict | null) => void) | null>(null)

  /**
   * Checks the names against what the destination pane already lists and asks
   * once if any collide. Resolves null when the user cancels the copy.
   */
  function resolveConflicts(
    target: PaneSide,
    targetPath: string,
    names: string[]
  ): Promise<TransferConflict | null> {
    const listed = queryClient.getQueryData<RemoteEntry[]>(
      paneQueryKey(target, sessionId, targetPath)
    )
    const existing = new Set((listed ?? []).map((e) => e.name))
    const clashes = names.filter((name) => existing.has(name))
    if (clashes.length === 0) return Promise.resolve('overwrite')
    return new Promise((resolve) => {
      conflictResolver.current = resolve
      setConflictNames(clashes)
    })
  }

  const localInfo = useQuery({
    queryKey: ['file-browser', 'local-info'],
    queryFn: () => window.north.localFs.info(),
    staleTime: Number.POSITIVE_INFINITY
  })
  const remoteHome = useQuery({
    queryKey: ['file-browser', 'remote-home', sessionId],
    queryFn: () => window.north.fs.home(sessionId),
    enabled: visible,
    staleTime: Number.POSITIVE_INFINITY,
    retry: false
  })

  useEffect(() => {
    if (localPath || !localInfo.data) return
    setLocalPath(savedLocalPath ?? localInfo.data.home)
  }, [localInfo.data, localPath, savedLocalPath])

  useEffect(() => {
    if (remotePath) return
    if (remoteHome.data) setRemotePath(remoteHome.data)
    else if (remoteHome.isError) setRemotePath('/')
  }, [remoteHome.data, remoteHome.isError, remotePath])

  function changeLocalPath(path: string): void {
    setLocalPath(path)
    setSavedLocalPath(path)
  }

  useEffect(() => {
    return window.north.fs.onProgress((progress) => {
      if (progress.sessionId !== sessionId) return
      setTransfers((current) => {
        const idx = current.findIndex((t) => t.transferId === progress.transferId)
        if (idx === -1) return [...current, progress]
        const next = [...current]
        // The final "done" event carries no byte counts; keep the last ones.
        next[idx] = progress.done
          ? {
              ...current[idx],
              ...progress,
              bytesTransferred: current[idx].bytesTransferred,
              totalBytes: current[idx].totalBytes
            }
          : progress
        return next
      })
      if (progress.done) {
        const side: PaneSide = progress.direction === 'download' ? 'local' : 'remote'
        void queryClient.invalidateQueries({ queryKey: paneQueryKey(side, sessionId) })
        if (progress.error) toastError(new Error(progress.error))
      }
    })
  }, [sessionId, queryClient])

  async function download(entries: RemoteEntry[]): Promise<void> {
    const sep = localInfo.data?.separator ?? '/'
    const conflict = await resolveConflicts(
      'local',
      localPath,
      entries.map((e) => e.name)
    )
    if (!conflict) return
    for (const entry of entries) {
      try {
        await window.north.fs.download({
          sessionId,
          remotePath: entry.path,
          localPath: joinPath(localPath, entry.name, sep),
          isDir: entry.type === 'dir',
          conflict
        })
      } catch (error) {
        toastError(error, `Falha ao baixar ${entry.name}`)
      }
    }
  }

  async function upload(localPaths: string[]): Promise<void> {
    const conflict = await resolveConflicts('remote', remotePath, localPaths.map(baseName))
    if (!conflict) return
    for (const path of localPaths) {
      try {
        await window.north.fs.upload({
          sessionId,
          localPath: path,
          remotePath: joinPath(remotePath, baseName(path), '/'),
          conflict
        })
      } catch (error) {
        toastError(error, `Falha ao enviar ${baseName(path)}`)
      }
    }
  }

  function handleDrop(target: PaneSide, payload: FileDragPayload | null, osPaths: string[]): void {
    if (payload) {
      if (payload.sessionId !== sessionId) return
      if (target === 'local') void download(payload.entries)
      else void upload(payload.entries.map((e) => e.path))
      return
    }
    // Files dragged in from Finder/Explorer: only meaningful on the server side.
    if (target === 'remote' && osPaths.length > 0) void upload(osPaths)
  }

  const localSource = useMemo<PaneSource | null>(() => {
    if (!localInfo.data) return null
    return {
      side: 'local',
      sessionId,
      sep: localInfo.data.separator,
      home: localInfo.data.home,
      roots: localInfo.data.roots,
      list: (path) => window.north.localFs.list({ path }),
      mkdir: (path) => window.north.localFs.mkdir({ path }),
      rename: (from, to) => window.north.localFs.rename({ from, to }),
      remove: (path) => window.north.localFs.delete({ path }),
      openFile: (entry) => {
        window.north.localFs
          .open({ path: entry.path })
          .catch((error) => toastError(error, 'Não foi possível abrir o arquivo'))
      }
    }
  }, [localInfo.data, sessionId])

  const remoteSource: PaneSource = {
    side: 'remote',
    sessionId,
    sep: '/',
    home: remoteHome.data ?? '/',
    roots: ['/'],
    list: (path) => window.north.fs.list({ sessionId, path }),
    mkdir: (path) => window.north.fs.mkdir({ sessionId, path }),
    rename: (from, to) => window.north.fs.rename({ sessionId, from, to }),
    remove: (path) => window.north.fs.delete({ sessionId, path }),
    // Double-click on a remote file brings it to the local folder, like WinSCP's default copy.
    openFile: (entry) => void download([entry])
  }

  return (
    <section
      className="flex h-full min-h-0 flex-col bg-background"
      style={{ display: visible ? 'flex' : 'none' }}
      aria-label="Navegador de arquivos"
      data-testid="file-browser"
    >
      <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
        <ResizablePanel defaultSize="50%" minSize="20%">
          {localSource && localPath ? (
            <FilePane
              source={localSource}
              path={localPath}
              onPathChange={changeLocalPath}
              visible={visible}
              active={activeSide === 'local'}
              onActivate={() => setActiveSide('local')}
              onCopy={(entries) => void upload(entries.map((e) => e.path))}
              onDrop={(payload, osPaths) => handleDrop('local', payload, osPaths)}
              copyLabel="Enviar para o servidor"
            />
          ) : (
            <PaneLoading />
          )}
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize="50%" minSize="20%">
          {remotePath ? (
            <FilePane
              source={remoteSource}
              path={remotePath}
              onPathChange={setRemotePath}
              visible={visible}
              active={activeSide === 'remote'}
              onActivate={() => setActiveSide('remote')}
              onCopy={(entries) => void download(entries)}
              onDrop={(payload, osPaths) => handleDrop('remote', payload, osPaths)}
              copyLabel="Baixar para a pasta local"
            />
          ) : (
            <PaneLoading />
          )}
        </ResizablePanel>
      </ResizablePanelGroup>
      <ConflictDialog
        names={conflictNames}
        onResolve={(choice) => {
          conflictResolver.current?.(choice)
          conflictResolver.current = null
          setConflictNames(null)
        }}
      />
      <TransferQueue
        transfers={transfers}
        onCancel={(transferId) => void window.north.fs.cancel({ transferId })}
        onClearFinished={() => setTransfers((current) => current.filter((t) => !t.done))}
      />
    </section>
  )
}

function PaneLoading(): React.JSX.Element {
  return (
    <div className="flex h-full items-center justify-center text-muted">
      <Loader2 className="size-4 animate-spin" />
    </div>
  )
}
