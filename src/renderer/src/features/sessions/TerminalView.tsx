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
import { Button } from '@renderer/components/ui/button'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup
} from '@renderer/components/ui/resizable'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { SessionIdentityBar } from '@renderer/features/sessions/SessionIdentityBar'
import { TerminalContextMenu } from '@renderer/features/sessions/TerminalContextMenu'
import { TerminalCwdPanel } from '@renderer/features/sessions/TerminalCwdPanel'
import { TerminalFindBar } from '@renderer/features/sessions/TerminalFindBar'
import { useClaudeUsage } from '@renderer/hooks/use-claude-usage'
import { useConnection } from '@renderer/hooks/use-connections'
import { useCanRevealConnectionPassword } from '@renderer/hooks/use-permissions'
import { useResolvedTheme } from '@renderer/hooks/use-resolved-theme'
import { copyToClipboard } from '@renderer/lib/clipboard'
import { environmentStatusColor, hasEnvironmentContext } from '@renderer/lib/environment-color'
import { resolveMonoFontStack } from '@renderer/lib/mono-font'
import { queryKeys } from '@renderer/lib/query-keys'
import { attachTerminalInteraction } from '@renderer/lib/terminal/attach-interaction'
import {
  fitFollowing,
  writeFollowing,
  writelnFollowing
} from '@renderer/lib/terminal/follow-output'
import { applyTerminalLigatures } from '@renderer/lib/terminal/ligatures'
import { terminalRightClickSelectsWord } from '@renderer/lib/terminal/middle-button'
import { toastError, toastSuccess, toastWarning } from '@renderer/lib/toast'
import { cn } from '@renderer/lib/utils'
import { getXtermTheme } from '@renderer/lib/xterm-theme'
import { useSessionsStore } from '@renderer/stores/sessions-store'
import { useUiStore } from '@renderer/stores/ui-store'
import '@xterm/xterm/css/xterm.css'
import { normalizeLogFilePath } from '@shared/lib/log-file'
import { nextOsc7Cwd } from '@shared/lib/osc7-cwd'
import {
  type ClassifyPathResult,
  planLogFileFromSelection,
  planStartupDirectoryFromSelection
} from '@shared/lib/selection-path'
import { coerceBytes } from '@shared/protocols'
import type { Connection, LogFollowErrorCode } from '@shared/types'
import { type QueryClient, useQueryClient } from '@tanstack/react-query'
import { FitAddon } from '@xterm/addon-fit'
import type { SearchAddon } from '@xterm/addon-search'
import { Terminal } from '@xterm/xterm'
import { FolderTree, GitBranch, StickyNote } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { PanelImperativeHandle } from 'react-resizable-panels'

const SELECTION_TOAST = {
  invalid: 'connection.terminalSelection.invalidPath',
  missing: 'connection.terminalSelection.missing',
  unavailable: 'connection.terminalSelection.unavailable',
  other: 'connection.terminalSelection.notDirectory',
  'not-file': 'connection.terminalSelection.notFile',
  duplicate: 'connection.terminalSelection.duplicate',
  limit: 'connection.terminalSelection.limit'
} as const

type SelectionToastReason = keyof typeof SELECTION_TOAST

type PendingDirectory = {
  stored: string
  command: string
  current: string
}

type DirectoryActionResult =
  | { type: 'toast'; reason: SelectionToastReason }
  | { type: 'cd'; command: string; toast: 'saved' | 'same' }
  | { type: 'confirm'; stored: string; command: string; current: string }
  | { type: 'save-failed' }

type LogActionResult =
  | { type: 'toast'; reason: SelectionToastReason }
  | { type: 'saved' }
  | { type: 'save-failed' }
  | { type: 'follow-failed'; code: LogFollowErrorCode }
  | { type: 'follow-crashed' }

type FollowSelectionResult =
  | { type: 'invalid' }
  | { type: 'failed'; code: LogFollowErrorCode }
  | { type: 'started' }

function writeSessionCommand(sessionId: string, command: string): void {
  window.north.sessions.write(sessionId, Array.from(new TextEncoder().encode(command)))
}

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

async function loadSshSelection(
  sessionId: string,
  connectionId: string,
  raw: string
): Promise<
  | { ok: false; reason: 'invalid' | 'unavailable' }
  | { ok: true; connection: Connection; classified: ClassifyPathResult }
> {
  const normalized = normalizeLogFilePath(raw)
  if (!normalized.ok) return { ok: false, reason: 'invalid' }
  const connection = await window.north.connections.get(connectionId)
  if (connection?.protocol !== 'ssh') return { ok: false, reason: 'unavailable' }
  const classified = await window.north.sessions.classifyPath({
    sessionId,
    path: normalized.value
  })
  return {
    ok: true,
    connection,
    classified: {
      ...classified,
      path: classified.path.length > 0 ? classified.path : normalized.value
    }
  }
}

async function runDirectoryAction(
  sessionId: string,
  connectionId: string,
  raw: string,
  queryClient: QueryClient
): Promise<DirectoryActionResult> {
  const loaded = await loadSshSelection(sessionId, connectionId, raw)
  if (!loaded.ok) return { type: 'toast', reason: loaded.reason }
  const plan = planStartupDirectoryFromSelection({
    selection: loaded.classified.path,
    kind: loaded.classified.kind,
    absolute: loaded.classified.absolute,
    current: loaded.connection.startupDirectory
  })
  if (!plan.ok) return { type: 'toast', reason: plan.reason }
  if (plan.unchanged) return { type: 'cd', command: plan.command, toast: 'same' }
  const current = loaded.connection.startupDirectory
  if (current && current.trim() !== '') {
    return { type: 'confirm', stored: plan.stored, command: plan.command, current }
  }
  try {
    await persistStartupDirectory(queryClient, connectionId, plan.stored)
  } catch {
    return { type: 'save-failed' }
  }
  return { type: 'cd', command: plan.command, toast: 'saved' }
}

async function runLogAction(
  sessionId: string,
  connectionId: string,
  raw: string,
  queryClient: QueryClient
): Promise<LogActionResult> {
  const loaded = await loadSshSelection(sessionId, connectionId, raw)
  if (!loaded.ok) return { type: 'toast', reason: loaded.reason }
  const plan = planLogFileFromSelection({
    selection: loaded.classified.path,
    kind: loaded.classified.kind,
    existing: loaded.connection.logFiles,
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

async function runFollowSelection(
  connectionId: string,
  raw: string
): Promise<FollowSelectionResult> {
  const normalized = normalizeLogFilePath(raw)
  if (!normalized.ok) return { type: 'invalid' }
  const started = await window.north.logFollows.start({
    connectionId,
    path: normalized.value
  })
  if (!started.ok) {
    if (started.code === 'INVALID_PATH') return { type: 'invalid' }
    return { type: 'failed', code: started.code }
  }
  return { type: 'started' }
}

type TerminalViewProps = {
  sessionId: string
  visible: boolean
  title?: string
  username?: string | null
  host?: string | null
  environmentName?: string | null
  environmentColor?: string | null
  /** Agent workspace context — repo/branch/task chips above the terminal. */
  agentRepoName?: string | null
  agentBranch?: string | null
  agentTaskNote?: string | null
  /** True for local-shell/agent-workspace sessions — gates the Claude usage poll. */
  isLocalShell?: boolean
  /** Connection this session belongs to — enables "Colar senha salva" in the context menu. */
  connectionId?: string | null
  /** Session protocol. The cwd badge exists only for a saved SSH terminal. */
  protocol?: string | null
}

export function TerminalView({
  sessionId,
  visible,
  title,
  username,
  host,
  environmentName,
  environmentColor,
  agentRepoName,
  agentBranch,
  agentTaskNote,
  isLocalShell,
  connectionId,
  protocol
}: TerminalViewProps): React.JSX.Element {
  const { data: claudeUsage } = useClaudeUsage(sessionId, Boolean(isLocalShell))
  const canPasteSecret = useCanRevealConnectionPassword(connectionId)
  const { data: connection } = useConnection(connectionId ?? undefined)
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const ligaturesRef = useRef<ReturnType<typeof applyTerminalLigatures>>(null)
  const interactionRef = useRef<ReturnType<typeof attachTerminalInteraction> | null>(null)
  const findOpenRef = useRef(false)
  const visibleRef = useRef(visible)
  const selectionLock = useRef(false)
  const directoryConfirmRef = useRef<PendingDirectory | null>(null)
  const confirmingRef = useRef(false)
  const [awaitingOutput, setAwaitingOutput] = useState(true)
  const [directoryConfirm, setDirectoryConfirm] = useState<PendingDirectory | null>(null)
  const [confirmingDirectory, setConfirmingDirectory] = useState(false)
  const [findOpen, setFindOpen] = useState(false)
  const [searchAddon, setSearchAddon] = useState<SearchAddon | null>(null)
  const [hasSelection, setHasSelection] = useState(false)
  const [linkUrl, setLinkUrl] = useState<string | null>(null)
  const [filesOpen, setFilesOpen] = useState(false)
  const [cwd, setCwd] = useState<string | null>(null)
  const [cwdEpoch, setCwdEpoch] = useState(0)
  const termPanelRef = useRef<PanelImperativeHandle | null>(null)
  const showCwdFiles = Boolean(connectionId) && protocol === 'ssh'
  const resolvedTheme = useResolvedTheme()
  const themeRef = useRef(resolvedTheme)
  themeRef.current = resolvedTheme
  const cursorAccent =
    environmentName && hasEnvironmentContext(environmentName)
      ? environmentStatusColor(environmentName, environmentColor)
      : null
  const cursorAccentRef = useRef(cursorAccent)
  cursorAccentRef.current = cursorAccent
  const monoFontFamily = useUiStore((s) => s.monoFontFamily)
  const monoFontSize = useUiStore((s) => s.monoFontSize)
  const monoLigatures = useUiStore((s) => s.monoLigatures)
  const terminalRightButtonCopies = useUiStore((s) => s.terminalRightButtonCopies)
  visibleRef.current = visible
  findOpenRef.current = findOpen

  useEffect(() => {
    document.body.style.removeProperty('pointer-events')

    const container = containerRef.current
    if (!container) return

    const ui = useUiStore.getState()
    const term = new Terminal({
      cursorBlink: true,
      fontFamily: resolveMonoFontStack(ui.monoFontFamily, ui.monoLigatures),
      fontSize: ui.monoFontSize,
      lineHeight: 1.2,
      theme: getXtermTheme(themeRef.current, cursorAccentRef.current),
      allowProposedApi: true,
      rightClickSelectsWord: terminalRightClickSelectsWord(ui.terminalRightButtonCopies),
      scrollback: 5000
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(container)
    ligaturesRef.current = applyTerminalLigatures(term, ui.monoLigatures, null)
    fit.fit()
    termRef.current = term
    fitRef.current = fit
    const oscHandler = term.parser.registerOscHandler(7, (data) => {
      setCwd((current) => nextOsc7Cwd(current, data))
      setCwdEpoch((epoch) => epoch + 1)
      return true
    })

    const interaction = attachTerminalInteraction({
      term,
      container,
      getCopyOnSelect: () => useUiStore.getState().terminalCopyOnSelect,
      getRightButtonCopies: () => useUiStore.getState().terminalRightButtonCopies,
      isFindOpen: () => findOpenRef.current,
      onOpenFind: () => setFindOpen(true),
      onCloseFind: () => setFindOpen(false),
      onLinkChange: setLinkUrl,
      onSelectionChange: setHasSelection
    })
    interactionRef.current = interaction
    setSearchAddon(interaction.searchAddon)
    setFindOpen(false)
    setHasSelection(false)
    setLinkUrl(null)

    const sendResize = (): void => {
      const cols = Math.max(term.cols || 80, 2)
      const rows = Math.max(term.rows || 24, 1)
      window.north.sessions.resize(sessionId, cols, rows)
    }

    const scheduleFit = (): void => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!fitRef.current || !termRef.current || !containerRef.current) return
          const { clientWidth, clientHeight } = containerRef.current
          if (clientWidth < 2 || clientHeight < 2) return
          fitFollowing(termRef.current, () => fitRef.current?.fit())
          sendResize()
        })
      })
    }

    scheduleFit()
    const fitTimers = [
      window.setTimeout(scheduleFit, 50),
      window.setTimeout(scheduleFit, 150),
      window.setTimeout(scheduleFit, 400)
    ]

    const onData = term.onData((data) => {
      const encoded = new TextEncoder().encode(data)
      window.north.sessions.write(sessionId, Array.from(encoded))
    })

    const unsubStdout = window.north.sessions.onStdout(({ sessionId: id, message }) => {
      if (id !== sessionId) return

      if (message.type === 'data') {
        const bytes = coerceBytes(message.data)
        if (bytes) {
          setAwaitingOutput(false)
          writeFollowing(term, bytes)
        }
        return
      }

      if (message.type === 'error') {
        writelnFollowing(term, `\r\n\x1b[31m${message.message}\x1b[0m`)
        return
      }

      if (message.type === 'state' && message.state === 'closed') {
        writelnFollowing(term, '\r\n\x1b[33mSessão encerrada.\x1b[0m')
        window.setTimeout(() => {
          const tab = useSessionsStore.getState().tabs.find((t) => t.sessionId === sessionId)
          if (tab) void useSessionsStore.getState().closeTab(tab.id)
        }, 700)
      }
    })

    // Subscribe first, then ask main to flush buffered handshake/banner bytes.
    window.north.sessions.ready(sessionId)

    const observer = new ResizeObserver(() => {
      if (!visibleRef.current) return
      scheduleFit()
    })
    observer.observe(container)
    const parent = container.parentElement
    if (parent) observer.observe(parent)

    const onPointerDown = (): void => {
      document.body.style.removeProperty('pointer-events')
      term.focus()
    }
    container.addEventListener('mousedown', onPointerDown)

    const focusTimer = window.setTimeout(() => {
      term.focus()
    }, 0)

    return () => {
      for (const timer of fitTimers) window.clearTimeout(timer)
      window.clearTimeout(focusTimer)
      container.removeEventListener('mousedown', onPointerDown)
      observer.disconnect()
      onData.dispose()
      interaction.dispose()
      interactionRef.current = null
      unsubStdout()
      oscHandler.dispose()
      ligaturesRef.current = null
      term.dispose()
      termRef.current = null
      fitRef.current = null
    }
  }, [sessionId])

  useEffect(() => {
    const term = termRef.current
    if (term) {
      term.options.theme = getXtermTheme(resolvedTheme, cursorAccent)
    }
  }, [resolvedTheme, cursorAccent])

  useEffect(() => {
    const term = termRef.current
    if (!term) return
    term.options.rightClickSelectsWord = terminalRightClickSelectsWord(terminalRightButtonCopies)
  }, [terminalRightButtonCopies])

  useEffect(() => {
    const term = termRef.current
    const fit = fitRef.current
    if (!term || !fit) return
    term.options.fontFamily = resolveMonoFontStack(monoFontFamily, monoLigatures)
    term.options.fontSize = monoFontSize
    ligaturesRef.current = applyTerminalLigatures(term, monoLigatures, ligaturesRef.current)
    requestAnimationFrame(() => {
      if (termRef.current !== term || fitRef.current !== fit) return
      fit.fit()
    })
  }, [monoFontFamily, monoFontSize, monoLigatures])

  // The cwd panel changes the terminal width without changing `visible`.
  // biome-ignore lint/correctness/useExhaustiveDependencies: refit when that panel opens
  useEffect(() => {
    if (!visible) return
    document.body.style.removeProperty('pointer-events')
    const term = termRef.current
    const fit = fitRef.current
    if (!term || !fit) return

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const container = containerRef.current
        if (!container || container.clientWidth < 2 || container.clientHeight < 2) return
        fitFollowing(term, () => fit.fit())
        window.north.sessions.resize(
          sessionId,
          Math.max(term.cols || 80, 2),
          Math.max(term.rows || 24, 1)
        )
        term.focus()
      })
    })
  }, [visible, sessionId, filesOpen])

  useEffect(() => {
    if (!showCwdFiles) return
    const frame = requestAnimationFrame(() => {
      try {
        termPanelRef.current?.resize(filesOpen ? '64%' : '100%')
      } catch {
        // The group may not have a measurement yet.
      }
    })
    return () => cancelAnimationFrame(frame)
  }, [filesOpen, showCwdFiles])

  useEffect(() => {
    if (!awaitingOutput || !visible) return
    const timer = window.setTimeout(() => setAwaitingOutput(false), 8000)
    return () => window.clearTimeout(timer)
  }, [awaitingOutput, visible])

  useEffect(() => {
    if (visible || confirmingRef.current) return
    directoryConfirmRef.current = null
    setDirectoryConfirm(null)
  }, [visible])

  const closeFind = (): void => {
    setFindOpen(false)
    termRef.current?.focus()
  }

  const toastSelection = (reason: SelectionToastReason): void => {
    toastWarning(t(SELECTION_TOAST[reason]))
  }

  const finishDirectory = (result: DirectoryActionResult): void => {
    if (result.type === 'toast') {
      toastSelection(result.reason)
      return
    }
    if (result.type === 'save-failed') {
      toastError(new Error(t('connection.terminalSelection.saveFailed')))
      return
    }
    if (result.type === 'confirm') {
      const pending = {
        stored: result.stored,
        command: result.command,
        current: result.current
      }
      document.body.style.removeProperty('pointer-events')
      directoryConfirmRef.current = pending
      setDirectoryConfirm(pending)
      requestAnimationFrame(() => {
        document.body.style.removeProperty('pointer-events')
      })
      return
    }
    writeSessionCommand(sessionId, result.command)
    toastSuccess(
      t(
        result.toast === 'saved'
          ? 'connection.terminalSelection.savedDirectory'
          : 'connection.terminalSelection.sameDirectory'
      )
    )
  }

  const finishLog = (result: LogActionResult): void => {
    if (result.type === 'toast') {
      toastSelection(result.reason)
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

  const finishFollow = (result: FollowSelectionResult): void => {
    if (result.type === 'invalid') {
      toastSelection('invalid')
      return
    }
    if (result.type === 'failed') {
      toastError(new Error(t(`connection.logFollow.errors.${result.code}`)))
    }
  }

  const runSelection = (action: 'directory' | 'log' | 'follow'): void => {
    if (!connectionId || selectionLock.current || directoryConfirmRef.current) return
    const raw = termRef.current?.getSelection() ?? ''
    if (raw.trim() === '') return
    selectionLock.current = true
    void (async () => {
      try {
        if (action === 'directory') {
          finishDirectory(await runDirectoryAction(sessionId, connectionId, raw, queryClient))
          return
        }
        if (action === 'log') {
          finishLog(await runLogAction(sessionId, connectionId, raw, queryClient))
          return
        }
        finishFollow(await runFollowSelection(connectionId, raw))
      } catch {
        toastSelection('unavailable')
      } finally {
        selectionLock.current = false
      }
    })()
  }

  const dismissDirectoryConfirm = (): void => {
    if (confirmingRef.current) return
    directoryConfirmRef.current = null
    setDirectoryConfirm(null)
    termRef.current?.focus()
  }

  const confirmDirectory = (): void => {
    const pending = directoryConfirmRef.current
    if (!pending || !connectionId || confirmingRef.current) return
    confirmingRef.current = true
    setConfirmingDirectory(true)
    void (async () => {
      try {
        await persistStartupDirectory(queryClient, connectionId, pending.stored)
        writeSessionCommand(sessionId, pending.command)
        toastSuccess(t('connection.terminalSelection.savedDirectory'))
        directoryConfirmRef.current = null
        setDirectoryConfirm(null)
        termRef.current?.focus()
      } catch {
        toastError(new Error(t('connection.terminalSelection.saveFailed')))
      } finally {
        confirmingRef.current = false
        setConfirmingDirectory(false)
      }
    })()
  }

  return (
    <div
      className="flex h-full w-full flex-col overflow-hidden bg-background"
      style={{ display: visible ? 'flex' : 'none' }}
      data-session-id={sessionId}
      data-testid="terminal-view"
    >
      <SessionIdentityBar
        username={username}
        host={host}
        folderLabel={agentRepoName || environmentName?.trim() || title || 'session'}
        environmentName={environmentName}
        environmentColor={environmentColor}
        afterEnvironment={
          showCwdFiles ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 px-2 text-[11px] font-normal"
              aria-pressed={filesOpen}
              data-testid="terminal-cwd-toggle"
              onClick={() => setFilesOpen((open) => !open)}
            >
              <FolderTree className="size-3.5" aria-hidden />
              {t('connection.terminalCwd.badge')}
            </Button>
          ) : null
        }
      >
        {agentBranch ? (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-surface-elevated px-2 py-1 font-mono text-[11px] text-foreground">
            <GitBranch className="size-3 text-muted" aria-hidden />
            {agentBranch}
          </span>
        ) : null}
        {agentTaskNote ? (
          <span className="inline-flex max-w-xs items-center gap-1.5 truncate rounded-md bg-surface-elevated px-2 py-1 text-[11px] text-foreground">
            <StickyNote className="size-3 shrink-0 text-muted" aria-hidden />
            <span className="truncate">{agentTaskNote}</span>
          </span>
        ) : null}
        {claudeUsage ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex items-center gap-1.5 rounded-md bg-surface-elevated px-2 py-1 font-mono text-[11px] text-foreground">
                <span
                  className={cn(
                    'size-2 shrink-0 rounded-full',
                    claudeUsage.percentOfWindow >= 90
                      ? 'bg-red-500'
                      : claudeUsage.percentOfWindow >= 70
                        ? 'bg-yellow-500'
                        : 'bg-emerald-500'
                  )}
                  aria-hidden
                />
                {claudeUsage.percentOfWindow}%
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom" align="end" className="font-mono text-[11px]">
              <div className="space-y-1">
                <p className="font-medium text-foreground">
                  Contexto: {claudeUsage.totalTokens.toLocaleString('pt-BR')} /{' '}
                  {claudeUsage.contextWindow.toLocaleString('pt-BR')} tok (
                  {claudeUsage.percentOfWindow}%)
                </p>
                <ul className="space-y-0.5 text-muted">
                  <li>Entrada: {claudeUsage.inputTokens.toLocaleString('pt-BR')} tok</li>
                  <li>Cache lido: {claudeUsage.cacheReadTokens.toLocaleString('pt-BR')} tok</li>
                  <li>
                    Cache criado: {claudeUsage.cacheCreationTokens.toLocaleString('pt-BR')} tok
                  </li>
                  <li>
                    Saída (última resposta): {claudeUsage.outputTokens.toLocaleString('pt-BR')} tok
                  </li>
                </ul>
                <p className="pt-0.5 text-muted">
                  Tokens são exatos, lidos do transcript local do Claude Code. A % assume a janela
                  de 1M do Sonnet 5 (padrão do modelo) — se sua conta não tiver esse limite, a %
                  real é menor que a mostrada.
                </p>
              </div>
            </TooltipContent>
          </Tooltip>
        ) : null}
      </SessionIdentityBar>
      <div className="min-h-0 flex-1 p-1">
        <ResizablePanelGroup orientation="horizontal" className="h-full min-h-0">
          <ResizablePanel
            defaultSize="100%"
            minSize="30%"
            panelRef={termPanelRef}
            className="min-h-0 min-w-0"
          >
            <div className="relative h-full min-h-0">
              <TerminalContextMenu
                hasSelection={hasSelection}
                linkUrl={linkUrl}
                onCopy={() => void interactionRef.current?.copySelection()}
                onCut={() => void interactionRef.current?.cutSelection()}
                onPaste={() => void interactionRef.current?.paste()}
                onSelectAll={() => interactionRef.current?.selectAll()}
                onCopyLink={() => {
                  if (linkUrl) void copyToClipboard(linkUrl, 'Link')
                }}
                onClearSelection={() => interactionRef.current?.clearSelection()}
                onPasteSecret={
                  connectionId && canPasteSecret
                    ? () => {
                        void (async () => {
                          try {
                            const secret =
                              await window.north.vault.revealConnectionSecret(connectionId)
                            if (!secret) {
                              toastError(
                                new Error('Nenhuma senha salva para esta conexão'),
                                'Nenhuma senha salva para esta conexão'
                              )
                              return
                            }
                            interactionRef.current?.pasteText(secret)
                          } catch (error) {
                            toastError(error, 'Não foi possível colar a senha')
                          }
                        })()
                      }
                    : undefined
                }
                sshActions={
                  connectionId && connection?.protocol === 'ssh'
                    ? {
                        onSetStartupDirectory: () => runSelection('directory'),
                        onAddLogFile: () => runSelection('log'),
                        onFollowLog: () => runSelection('follow')
                      }
                    : undefined
                }
              >
                <div ref={containerRef} className="h-full min-h-[120px] w-full" />
              </TerminalContextMenu>
              <TerminalFindBar open={findOpen} searchAddon={searchAddon} onClose={closeFind} />
              {awaitingOutput ? (
                <div
                  className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/80 p-4 text-center"
                  role="status"
                  aria-live="polite"
                >
                  <p className="text-xs text-muted">Aguardando saída do terminal…</p>
                </div>
              ) : null}
            </div>
          </ResizablePanel>
          {showCwdFiles && filesOpen && connectionId ? <ResizableHandle withHandle /> : null}
          {showCwdFiles && filesOpen && connectionId ? (
            <ResizablePanel defaultSize="36%" minSize="22%" className="min-h-0 min-w-0">
              <div
                className="h-full min-h-0 overflow-hidden border-l border-border"
                data-testid="terminal-cwd-panel"
              >
                <TerminalCwdPanel
                  sessionId={sessionId}
                  connectionId={connectionId}
                  path={cwd}
                  cwdEpoch={cwdEpoch}
                  visible={visible}
                />
              </div>
            </ResizablePanel>
          ) : null}
        </ResizablePanelGroup>
      </div>
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
    </div>
  )
}
