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
import { useConnection } from '@renderer/hooks/use-connections'
import { queryKeys } from '@renderer/lib/query-keys'
import { toastError, toastSuccess, toastWarning } from '@renderer/lib/toast'
import { normalizeLogFilePath } from '@shared/lib/log-file'
import { planLogFileFromSelection, planStartupDirectoryFromPane } from '@shared/lib/selection-path'
import type { RemoteEntry, TransferConflict, TransferProgress } from '@shared/protocols'
import type { Connection, LogFollowErrorCode } from '@shared/types'
import { type QueryClient, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ConflictDialog } from './file-browser/ConflictDialog'
import { FilePane, type PaneSource, paneQueryKey } from './file-browser/FilePane'
import { TransferQueue } from './file-browser/TransferQueue'
import { listTerminalCwd } from './terminal-cwd-list'

type TerminalCwdPanelProps = {
  sessionId: string
  connectionId: string
  path: string | null
  /** Increments on every OSC 7, including one that keeps the same folder. */
  cwdEpoch: number
  visible: boolean
}

type PendingDirectory = { stored: string; current: string }

const LOG_TOAST = {
  invalid: 'connection.terminalSelection.invalidPath',
  missing: 'connection.terminalSelection.missing',
  unavailable: 'connection.terminalSelection.unavailable',
  'not-file': 'connection.terminalSelection.notFile',
  duplicate: 'connection.terminalSelection.duplicate',
  limit: 'connection.terminalSelection.limit'
} as const

async function invalidateConnection(queryClient: QueryClient, connectionId: string): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: queryKeys.connections.all })
  await queryClient.invalidateQueries({ queryKey: queryKeys.connections.detail(connectionId) })
}

export function TerminalCwdPanel({
  sessionId,
  connectionId,
  path,
  cwdEpoch,
  visible
}: TerminalCwdPanelProps): React.JSX.Element {
  const { t } = useTranslation()
  const copyRef = useRef(t)
  copyRef.current = t
  const queryClient = useQueryClient()
  const connection = useConnection(connectionId)
  const pathRef = useRef(path)
  pathRef.current = path
  const [pendingCd, setPendingCd] = useState(false)
  const [seenEpoch, setSeenEpoch] = useState(cwdEpoch)
  const epochRef = useRef(cwdEpoch)
  epochRef.current = cwdEpoch
  if (seenEpoch !== cwdEpoch) {
    setSeenEpoch(cwdEpoch)
    setPendingCd(false)
  }
  const [transfers, setTransfers] = useState<TransferProgress[]>([])
  const [conflictNames, setConflictNames] = useState<string[] | null>(null)
  const [directoryConfirm, setDirectoryConfirm] = useState<PendingDirectory | null>(null)
  const [confirmingDirectory, setConfirmingDirectory] = useState(false)
  const conflictResolver = useRef<((choice: TransferConflict | null) => void) | null>(null)
  const directoryConfirmRef = useRef<PendingDirectory | null>(null)
  const actionLock = useRef(false)
  const confirmingRef = useRef(false)
  const sourceRef = useRef<PaneSource | null>(null)

  const home = useQuery({
    queryKey: ['terminal-shell-home', sessionId],
    queryFn: () => window.north.sessions.home({ sessionId }),
    enabled: visible && path !== null,
    staleTime: 30_000,
    retry: false
  })
  const homePath = home.data?.ok ? home.data.path : ''

  useEffect(() => {
    return () => {
      void window.north.sessions.cancelDirectoryChange({ sessionId })
    }
  }, [sessionId])

  useEffect(() => {
    return window.north.fs.onProgress((progress) => {
      if (progress.sessionId !== sessionId) return
      setTransfers((current) => {
        const idx = current.findIndex((item) => item.transferId === progress.transferId)
        if (idx === -1) return [...current, progress]
        const next = current.slice()
        next[idx] = progress
        return next
      })
      if (progress.done && !progress.cancelled && !progress.error) {
        void queryClient.invalidateQueries({ queryKey: paneQueryKey('remote', sessionId) })
      }
    })
  }, [sessionId, queryClient])

  function navigate(next: string): void {
    const epochAtRequest = epochRef.current
    void (async () => {
      const result = await window.north.sessions.changeDirectory({ sessionId, path: next })
      if (!result.ok) {
        setPendingCd(false)
        if (result.reason === 'invalid') toastWarning(t('connection.terminalCwd.pathRejected'))
        return
      }
      setPendingCd(result.pending && epochRef.current === epochAtRequest)
    })()
  }

  function askConflict(names: string[]): Promise<TransferConflict | null> {
    return new Promise((resolve) => {
      conflictResolver.current = resolve
      setConflictNames(names)
    })
  }

  async function downloadEntries(entries: RemoteEntry[]): Promise<void> {
    let token: string | undefined
    let conflict: TransferConflict | undefined
    for (const entry of entries) {
      for (;;) {
        const result = await window.north.sessions.download({
          sessionId,
          remotePath: entry.path,
          isDir: entry.type === 'dir',
          conflict,
          destinationToken: token
        })
        if (!result.ok && result.reason === 'conflict' && result.names && result.destinationToken) {
          token = result.destinationToken
          const choice = await askConflict(result.names)
          if (!choice) return
          conflict = choice
          continue
        }
        if (!result.ok) {
          if (result.reason !== 'cancelled')
            toastError(new Error(t('connection.terminalCwd.mutateFailed')))
          return
        }
        token = result.destinationToken
        break
      }
    }
  }

  async function upload(localPaths?: string[]): Promise<void> {
    let token: string | undefined
    let conflict: TransferConflict | undefined
    for (;;) {
      const result = await window.north.sessions.upload({
        sessionId,
        localPaths: token ? undefined : localPaths,
        conflict,
        destinationToken: token
      })
      if (!result.ok && result.reason === 'conflict' && result.names && result.destinationToken) {
        token = result.destinationToken
        const choice = await askConflict(result.names)
        if (!choice) return
        conflict = choice
        continue
      }
      if (!result.ok) {
        if (result.reason !== 'cancelled')
          toastError(new Error(t('connection.terminalCwd.mutateFailed')))
        return
      }
      return
    }
  }

  if (!sourceRef.current || sourceRef.current.sessionId !== sessionId) {
    sourceRef.current = {
      side: 'remote',
      sessionId,
      sep: '/',
      home: '/',
      roots: ['/'],
      list: (requested) => listTerminalCwd(sessionId, requested, pathRef.current),
      probe: async (requested) => {
        const result = await window.north.sessions.listDirectory({ sessionId, path: requested })
        if (!result.ok) throw new Error('list-failed')
        return result.entries
      },
      mkdir: async (target) => {
        const result = await window.north.sessions.mkdir({ sessionId, path: target })
        if (!result.ok) throw new Error(copyRef.current('connection.terminalCwd.mutateFailed'))
      },
      rename: async (from, to) => {
        const result = await window.north.sessions.rename({ sessionId, from, to })
        if (!result.ok) throw new Error(copyRef.current('connection.terminalCwd.mutateFailed'))
      },
      remove: async (target) => {
        const result = await window.north.sessions.delete({ sessionId, path: target })
        if (!result.ok) throw new Error(copyRef.current('connection.terminalCwd.mutateFailed'))
      },
      openFile: (entry) => {
        void downloadEntries([entry])
      }
    }
  }
  const source = sourceRef.current
  source.home = homePath

  const ssh = connection.data?.protocol === 'ssh' ? connection.data : null

  function requestStartupDirectory(listedPath: string): void {
    if (actionLock.current || directoryConfirmRef.current || !ssh) return
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
    if (plan.needsConfirm && ssh.startupDirectory && ssh.startupDirectory.trim() !== '') {
      const pending = { stored: plan.stored, current: ssh.startupDirectory }
      directoryConfirmRef.current = pending
      setDirectoryConfirm(pending)
      return
    }
    actionLock.current = true
    void (async () => {
      try {
        await window.north.connections.update(connectionId, { startupDirectory: plan.stored })
        await invalidateConnection(queryClient, connectionId)
        toastSuccess(t('connection.terminalSelection.savedDirectory'))
      } catch {
        toastError(new Error(t('connection.terminalSelection.saveFailed')))
      } finally {
        actionLock.current = false
      }
    })()
  }

  function requestAddToMonitoring(entry: RemoteEntry): void {
    if (actionLock.current || !ssh || entry.type !== 'file') return
    actionLock.current = true
    void (async () => {
      try {
        await finishLog(ssh, entry.path)
      } catch {
        toastWarning(t(LOG_TOAST.unavailable))
      } finally {
        actionLock.current = false
      }
    })()
  }

  async function finishLog(current: Connection, entryPath: string): Promise<void> {
    const plan = planLogFileFromSelection({
      selection: entryPath,
      kind: 'file',
      existing: current.logFiles,
      id: crypto.randomUUID()
    })
    if (!plan.ok) {
      toastWarning(t(LOG_TOAST[plan.reason]))
      return
    }
    try {
      await window.north.connections.update(connectionId, { logFiles: plan.files })
      await invalidateConnection(queryClient, connectionId)
    } catch {
      toastError(new Error(t('connection.terminalSelection.saveFailed')))
      return
    }
    try {
      const started = await window.north.logFollows.start({ connectionId, logFileId: plan.id })
      if (!started.ok) {
        toastError(new Error(t(`connection.logFollow.errors.${started.code}`)))
        return
      }
    } catch {
      toastError(new Error(t('connection.terminalSelection.followFailed')))
      return
    }
    toastSuccess(t('connection.terminalSelection.logAdded'))
  }

  function requestFollowLive(entry: RemoteEntry): void {
    if (actionLock.current || entry.type !== 'file') return
    actionLock.current = true
    void (async () => {
      try {
        const normalized = normalizeLogFilePath(entry.path)
        if (!normalized.ok) {
          toastWarning(t('connection.terminalSelection.invalidPath'))
          return
        }
        const started = await window.north.logFollows.start({
          connectionId,
          path: normalized.value
        })
        if (!started.ok) {
          const code: LogFollowErrorCode = started.code
          if (code === 'INVALID_PATH') toastWarning(t('connection.terminalSelection.invalidPath'))
          else toastError(new Error(t(`connection.logFollow.errors.${code}`)))
        }
      } catch {
        toastWarning(t('connection.terminalSelection.unavailable'))
      } finally {
        actionLock.current = false
      }
    })()
  }

  function confirmDirectory(): void {
    const pending = directoryConfirmRef.current
    if (!pending || confirmingRef.current || actionLock.current) return
    confirmingRef.current = true
    actionLock.current = true
    setConfirmingDirectory(true)
    void (async () => {
      try {
        await window.north.connections.update(connectionId, { startupDirectory: pending.stored })
        await invalidateConnection(queryClient, connectionId)
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

  if (!path) {
    return (
      <div
        className="flex h-full items-center justify-center p-4"
        data-testid="terminal-cwd-waiting"
        role="status"
      >
        <p className="text-center text-xs text-muted">{t('connection.terminalCwd.waiting')}</p>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {pendingCd ? (
        <p
          className="border-b border-border px-3 py-1.5 text-center text-[11px] text-muted"
          data-testid="terminal-cwd-pending"
          role="status"
        >
          {t('connection.terminalCwd.pendingCd')}
        </p>
      ) : null}
      <div className="min-h-0 flex-1">
        <FilePane
          shell
          source={source}
          path={path}
          onPathChange={navigate}
          visible={visible}
          active={false}
          onActivate={() => undefined}
          onCopy={(entries) => void downloadEntries(entries)}
          onDrop={(_payload, osPaths) => {
            if (osPaths.length > 0) void upload(osPaths)
          }}
          onUpload={() => void upload()}
          copyLabel="Baixar para a pasta local"
          sshActions={
            ssh
              ? {
                  onSetStartupDirectory: requestStartupDirectory,
                  onAddToMonitoring: requestAddToMonitoring,
                  onFollowLive: requestFollowLive
                }
              : undefined
          }
        />
      </div>
      <TransferQueue
        transfers={transfers}
        onCancel={(transferId) => void window.north.fs.cancel({ transferId })}
        onClearFinished={() => setTransfers((current) => current.filter((item) => !item.done))}
      />
      <ConflictDialog
        names={conflictNames}
        onResolve={(choice) => {
          conflictResolver.current?.(choice)
          conflictResolver.current = null
          setConflictNames(null)
        }}
      />
      <AlertDialog
        open={directoryConfirm !== null}
        onOpenChange={(open) => {
          if (!open && !confirmingRef.current) {
            directoryConfirmRef.current = null
            setDirectoryConfirm(null)
          }
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
    </div>
  )
}
