import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@renderer/components/ui/alert-dialog'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup
} from '@renderer/components/ui/resizable'
import { useConnection } from '@renderer/hooks/use-connections'
import { queryKeys } from '@renderer/lib/query-keys'
import { toastError, toastSuccess, toastWarning } from '@renderer/lib/toast'
import { useUiStore } from '@renderer/stores/ui-store'
import { normalizeLogFilePath } from '@shared/lib/log-file'
import { planLogFileFromSelection, planStartupDirectoryFromPane } from '@shared/lib/selection-path'
import {
  canonicalPosixDir,
  normalizeStartupDirectory,
  resolveStartupDirectory
} from '@shared/lib/startup-directory'
import type { RemoteEntry, TransferConflict, TransferProgress } from '@shared/protocols'
import type { Connection, LogFollowErrorCode } from '@shared/types'
import { type QueryClient, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
  /** Set for a connection's file browser. SSH startup directory is read from this connection. */
  connectionId?: string | null
}

function baseName(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? path
}

const PANE_LOG_TOAST = {
  invalid: 'connection.terminalSelection.invalidPath',
  missing: 'connection.terminalSelection.missing',
  unavailable: 'connection.terminalSelection.unavailable',
  'not-file': 'connection.terminalSelection.notFile',
  duplicate: 'connection.terminalSelection.duplicate',
  limit: 'connection.terminalSelection.limit'
} as const

type PaneLogToastReason = keyof typeof PANE_LOG_TOAST

type PendingPaneDirectory = {
  stored: string
  current: string
}

type PaneLogResult =
  | { type: 'toast'; reason: PaneLogToastReason }
  | { type: 'saved' }
  | { type: 'save-failed' }
  | { type: 'follow-failed'; code: LogFollowErrorCode }
  | { type: 'follow-crashed' }

type PaneFollowResult =
  | { type: 'invalid' }
  | { type: 'failed'; code: LogFollowErrorCode }
  | { type: 'started' }
  | { type: 'crashed' }

async function invalidateConnection(queryClient: QueryClient, connectionId: string): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: queryKeys.connections.all })
  await queryClient.invalidateQueries({ queryKey: queryKeys.connections.detail(connectionId) })
}

async function persistStartupDirectory(
  queryClient: QueryClient,
  connectionId: string,
  stored: string
): Promise<void> {
  await window.north.connections.update(connectionId, { startupDirectory: stored })
  try {
    await invalidateConnection(queryClient, connectionId)
  } catch {
    // The row is saved. The next query refresh picks it up.
  }
}

async function persistLogFileAndFollow(
  queryClient: QueryClient,
  connectionId: string,
  entryPath: string,
  existing: Connection['logFiles']
): Promise<PaneLogResult> {
  const plan = planLogFileFromSelection({
    selection: entryPath,
    kind: 'file',
    existing,
    id: crypto.randomUUID()
  })
  if (!plan.ok) return { type: 'toast', reason: plan.reason }
  try {
    await window.north.connections.update(connectionId, { logFiles: plan.files })
    try {
      await invalidateConnection(queryClient, connectionId)
    } catch {
      // The row is saved. The next query refresh picks it up.
    }
  } catch {
    return { type: 'save-failed' }
  }
  try {
    const started = await window.north.logFollows.start({ connectionId, logFileId: plan.id })
    if (!started.ok) return { type: 'follow-failed', code: started.code }
  } catch {
    return { type: 'follow-crashed' }
  }
  return { type: 'saved' }
}

async function startLiveFollow(connectionId: string, entryPath: string): Promise<PaneFollowResult> {
  const normalized = normalizeLogFilePath(entryPath)
  if (!normalized.ok) return { type: 'invalid' }
  try {
    const started = await window.north.logFollows.start({
      connectionId,
      path: normalized.value
    })
    if (!started.ok) {
      if (started.code === 'INVALID_PATH') return { type: 'invalid' }
      return { type: 'failed', code: started.code }
    }
  } catch {
    return { type: 'crashed' }
  }
  return { type: 'started' }
}

/** WinSCP-style commander: local disk on the left, the server on the right. */
export function FileBrowserView({
  sessionId,
  visible,
  connectionId
}: FileBrowserViewProps): React.JSX.Element {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const savedLocalPath = useUiStore((s) => s.fileBrowserLocalPath)
  const setSavedLocalPath = useUiStore((s) => s.setFileBrowserLocalPath)
  const [activeSide, setActiveSide] = useState<PaneSide>('remote')
  const [localPath, setLocalPath] = useState('')
  const [remotePath, setRemotePath] = useState('')
  const [transfers, setTransfers] = useState<TransferProgress[]>([])
  const [conflictNames, setConflictNames] = useState<string[] | null>(null)
  const [directoryConfirm, setDirectoryConfirm] = useState<PendingPaneDirectory | null>(null)
  const [confirmingDirectory, setConfirmingDirectory] = useState(false)
  const conflictResolver = useRef<((choice: TransferConflict | null) => void) | null>(null)
  const directoryConfirmRef = useRef<PendingPaneDirectory | null>(null)
  const actionLock = useRef(false)
  const confirmingRef = useRef(false)

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
  const connection = useConnection(connectionId ?? undefined)
  const initialRemoteApplied = useRef<string | null>(null)

  useEffect(() => {
    if (localPath || !localInfo.data) return
    setLocalPath(savedLocalPath ?? localInfo.data.home)
  }, [localInfo.data, localPath, savedLocalPath])

  useEffect(() => {
    if (initialRemoteApplied.current === sessionId) return
    const connectionReady = !connectionId || connection.isSuccess || connection.isError
    if (!connectionReady) return
    if (!remoteHome.isFetched && !remoteHome.isError) return

    const stored =
      connection.data?.protocol === 'ssh' ? (connection.data.startupDirectory ?? null) : null
    const normalized = normalizeStartupDirectory(stored)
    const home = remoteHome.data ?? '/'
    const startup = normalized.ok ? normalized.value : null
    initialRemoteApplied.current = sessionId

    if (!startup) {
      setRemotePath(home)
      return
    }

    const target = remoteHome.data
      ? resolveStartupDirectory(startup, remoteHome.data)
      : startup.startsWith('/')
        ? startup
        : null
    if (!target) {
      toastWarning(t('connection.session.startupDirectoryUnavailable', { path: startup }))
      setRemotePath(home)
      return
    }
    if (remoteHome.data && canonicalPosixDir(target) === canonicalPosixDir(remoteHome.data)) {
      setRemotePath(home)
      return
    }

    void window.north.fs.list({ sessionId, path: target }).then(
      () => setRemotePath(target),
      () => {
        toastWarning(t('connection.session.startupDirectoryUnavailable', { path: startup }))
        setRemotePath(home)
      }
    )
  }, [
    connection.data,
    connection.isError,
    connection.isSuccess,
    connectionId,
    remoteHome.data,
    remoteHome.isError,
    remoteHome.isFetched,
    sessionId,
    t
  ])

  useEffect(() => {
    if (visible || confirmingRef.current) return
    directoryConfirmRef.current = null
    setDirectoryConfirm(null)
  }, [visible])

  function readSshConnection(): Connection | null {
    if (!connectionId) return null
    const cached = queryClient.getQueryData<Connection | null>(
      queryKeys.connections.detail(connectionId)
    )
    const current = cached ?? connection.data ?? null
    return current?.protocol === 'ssh' ? current : null
  }

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

  const sshPane = Boolean(connectionId && connection.data?.protocol === 'ssh')

  function toastLogReason(reason: PaneLogToastReason): void {
    toastWarning(t(PANE_LOG_TOAST[reason]))
  }

  function finishLog(result: PaneLogResult): void {
    if (result.type === 'toast') {
      toastLogReason(result.reason)
      return
    }
    if (result.type === 'save-failed') {
      toastError(new Error(t('connection.terminalSelection.saveFailed')))
      return
    }
    if (result.type === 'follow-failed') {
      toastError(new Error(t(`connection.logFollow.errors.${result.code}`)))
      return
    }
    if (result.type === 'follow-crashed') {
      toastError(new Error(t('connection.terminalSelection.followFailed')))
      return
    }
    toastSuccess(t('connection.terminalSelection.logAdded'))
  }

  function finishFollow(result: PaneFollowResult): void {
    if (result.type === 'invalid') {
      toastWarning(t('connection.terminalSelection.invalidPath'))
      return
    }
    if (result.type === 'failed') {
      toastError(new Error(t(`connection.logFollow.errors.${result.code}`)))
      return
    }
    if (result.type === 'crashed') {
      toastWarning(t('connection.terminalSelection.unavailable'))
    }
  }

  function requestStartupDirectory(listedPath: string): void {
    if (!connectionId || actionLock.current || directoryConfirmRef.current) return
    const ssh = readSshConnection()
    if (!ssh) return
    const plan = planStartupDirectoryFromPane({
      path: listedPath,
      current: ssh.startupDirectory
    })
    if (!plan.ok) {
      toastWarning(t('connection.terminalSelection.invalidPath'))
      return
    }
    if (plan.unchanged) {
      toastSuccess(t('connection.terminalSelection.sameDirectory'))
      return
    }
    if (plan.needsConfirm) {
      const current = ssh.startupDirectory
      if (current && current.trim() !== '') {
        const pending = { stored: plan.stored, current }
        directoryConfirmRef.current = pending
        setDirectoryConfirm(pending)
        return
      }
    }
    const id = connectionId
    actionLock.current = true
    void (async () => {
      try {
        await persistStartupDirectory(queryClient, id, plan.stored)
        toastSuccess(t('connection.terminalSelection.savedDirectory'))
      } catch {
        toastError(new Error(t('connection.terminalSelection.saveFailed')))
      } finally {
        actionLock.current = false
      }
    })()
  }

  function requestAddToMonitoring(entry: RemoteEntry): void {
    if (!connectionId || actionLock.current || directoryConfirmRef.current) return
    const ssh = readSshConnection()
    if (!ssh || entry.type !== 'file') return
    const id = connectionId
    actionLock.current = true
    void (async () => {
      try {
        finishLog(await persistLogFileAndFollow(queryClient, id, entry.path, ssh.logFiles))
      } catch {
        toastLogReason('unavailable')
      } finally {
        actionLock.current = false
      }
    })()
  }

  function requestFollowLive(entry: RemoteEntry): void {
    if (!connectionId || actionLock.current || directoryConfirmRef.current) return
    if (entry.type !== 'file') return
    const id = connectionId
    actionLock.current = true
    void (async () => {
      try {
        finishFollow(await startLiveFollow(id, entry.path))
      } catch {
        toastWarning(t('connection.terminalSelection.unavailable'))
      } finally {
        actionLock.current = false
      }
    })()
  }

  function dismissDirectoryConfirm(): void {
    if (confirmingRef.current) return
    directoryConfirmRef.current = null
    setDirectoryConfirm(null)
  }

  function confirmDirectory(): void {
    const pending = directoryConfirmRef.current
    if (!pending || !connectionId || confirmingRef.current || actionLock.current) return
    const id = connectionId
    confirmingRef.current = true
    actionLock.current = true
    setConfirmingDirectory(true)
    void (async () => {
      try {
        await persistStartupDirectory(queryClient, id, pending.stored)
        toastSuccess(t('connection.terminalSelection.savedDirectory'))
        directoryConfirmRef.current = null
        setDirectoryConfirm(null)
      } catch {
        toastError(new Error(t('connection.terminalSelection.saveFailed')))
      } finally {
        confirmingRef.current = false
        actionLock.current = false
        setConfirmingDirectory(false)
      }
    })()
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
              sshActions={
                sshPane
                  ? {
                      onSetStartupDirectory: requestStartupDirectory,
                      onAddToMonitoring: requestAddToMonitoring,
                      onFollowLive: requestFollowLive
                    }
                  : undefined
              }
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
      <AlertDialog
        open={directoryConfirm !== null}
        onOpenChange={(open) => {
          if (!open) dismissDirectoryConfirm()
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('connection.terminalSelection.confirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted">
                <p>{t('connection.terminalSelection.confirmCurrent')}</p>
                <p className="break-all font-mono text-xs text-foreground">
                  {directoryConfirm?.current}
                </p>
                <p>{t('connection.terminalSelection.confirmNext')}</p>
                <p className="break-all font-mono text-xs text-foreground">
                  {directoryConfirm?.stored}
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={confirmingDirectory}>
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={confirmingDirectory}
              onClick={(event) => {
                event.preventDefault()
                confirmDirectory()
              }}
            >
              {t('connection.terminalSelection.replace')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
