import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { SessionIdentityBar } from '@renderer/features/sessions/SessionIdentityBar'
import { TerminalContextMenu } from '@renderer/features/sessions/TerminalContextMenu'
import { TerminalFindBar } from '@renderer/features/sessions/TerminalFindBar'
import { useClaudeUsage } from '@renderer/hooks/use-claude-usage'
import { copyToClipboard } from '@renderer/lib/clipboard'
import { environmentStatusColor, hasEnvironmentContext } from '@renderer/lib/environment-color'
import { attachTerminalInteraction } from '@renderer/lib/terminal/attach-interaction'
import {
  fitFollowing,
  writeFollowing,
  writelnFollowing
} from '@renderer/lib/terminal/follow-output'
import { cn } from '@renderer/lib/utils'
import { getXtermTheme, useResolvedTheme } from '@renderer/lib/xterm-theme'
import { useSessionsStore } from '@renderer/stores/sessions-store'
import { MONO_FONT_FAMILY_STACKS, useUiStore } from '@renderer/stores/ui-store'
import '@xterm/xterm/css/xterm.css'
import { coerceBytes } from '@shared/protocols'
import { FitAddon } from '@xterm/addon-fit'
import type { SearchAddon } from '@xterm/addon-search'
import { Terminal } from '@xterm/xterm'
import { GitBranch, StickyNote } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

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
  isLocalShell
}: TerminalViewProps): React.JSX.Element {
  const { data: claudeUsage } = useClaudeUsage(sessionId, Boolean(isLocalShell))
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const interactionRef = useRef<ReturnType<typeof attachTerminalInteraction> | null>(null)
  const findOpenRef = useRef(false)
  const visibleRef = useRef(visible)
  const [awaitingOutput, setAwaitingOutput] = useState(true)
  const [findOpen, setFindOpen] = useState(false)
  const [searchAddon, setSearchAddon] = useState<SearchAddon | null>(null)
  const [hasSelection, setHasSelection] = useState(false)
  const [linkUrl, setLinkUrl] = useState<string | null>(null)
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
  visibleRef.current = visible
  findOpenRef.current = findOpen

  useEffect(() => {
    document.body.style.removeProperty('pointer-events')

    const container = containerRef.current
    if (!container) return

    const term = new Terminal({
      cursorBlink: true,
      fontFamily: MONO_FONT_FAMILY_STACKS[useUiStore.getState().monoFontFamily],
      fontSize: useUiStore.getState().monoFontSize,
      lineHeight: 1.2,
      theme: getXtermTheme(themeRef.current, cursorAccentRef.current),
      allowProposedApi: true,
      rightClickSelectsWord: true,
      scrollback: 5000
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(container)
    fit.fit()
    termRef.current = term
    fitRef.current = fit

    const interaction = attachTerminalInteraction({
      term,
      container,
      getCopyOnSelect: () => useUiStore.getState().terminalCopyOnSelect,
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
    const fit = fitRef.current
    if (!term || !fit) return
    term.options.fontFamily = MONO_FONT_FAMILY_STACKS[monoFontFamily]
    term.options.fontSize = monoFontSize
    requestAnimationFrame(() => fit.fit())
  }, [monoFontFamily, monoFontSize])

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
  }, [visible, sessionId])

  useEffect(() => {
    if (!awaitingOutput || !visible) return
    const timer = window.setTimeout(() => setAwaitingOutput(false), 8000)
    return () => window.clearTimeout(timer)
  }, [awaitingOutput, visible])

  const closeFind = (): void => {
    setFindOpen(false)
    termRef.current?.focus()
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
      <div className="relative min-h-0 flex-1 p-1">
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
    </div>
  )
}
