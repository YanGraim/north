import { SessionIdentityBar } from '@renderer/features/sessions/SessionIdentityBar'
import { TerminalContextMenu } from '@renderer/features/sessions/TerminalContextMenu'
import { TerminalFindBar } from '@renderer/features/sessions/TerminalFindBar'
import { copyToClipboard } from '@renderer/lib/clipboard'
import { attachTerminalInteraction } from '@renderer/lib/terminal/attach-interaction'
import { getXtermTheme, useResolvedTheme } from '@renderer/lib/xterm-theme'
import { useUiStore } from '@renderer/stores/ui-store'
import '@xterm/xterm/css/xterm.css'
import { coerceBytes } from '@shared/protocols'
import { FitAddon } from '@xterm/addon-fit'
import type { SearchAddon } from '@xterm/addon-search'
import { Terminal } from '@xterm/xterm'
import { useEffect, useRef, useState } from 'react'

type TerminalViewProps = {
  sessionId: string
  visible: boolean
  title?: string
  username?: string | null
  host?: string | null
  environmentName?: string | null
  environmentColor?: string | null
}

export function TerminalView({
  sessionId,
  visible,
  title,
  username,
  host,
  environmentName,
  environmentColor
}: TerminalViewProps): React.JSX.Element {
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
  visibleRef.current = visible
  findOpenRef.current = findOpen

  useEffect(() => {
    document.body.style.removeProperty('pointer-events')

    const container = containerRef.current
    if (!container) return

    const term = new Terminal({
      cursorBlink: true,
      fontFamily: '"IBM Plex Mono", "SF Mono", ui-monospace, monospace',
      fontSize: 13,
      lineHeight: 1.2,
      theme: getXtermTheme(themeRef.current),
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
          fitRef.current.fit()
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
          term.write(bytes)
        }
        return
      }

      if (message.type === 'error') {
        term.writeln(`\r\n\x1b[31m${message.message}\x1b[0m`)
        return
      }

      if (message.type === 'state' && message.state === 'closed') {
        term.writeln('\r\n\x1b[33mSessão encerrada.\x1b[0m')
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
      term.options.theme = getXtermTheme(resolvedTheme)
    }
  }, [resolvedTheme])

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
        fit.fit()
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
    >
      <SessionIdentityBar
        username={username}
        host={host}
        folderLabel={title ?? 'session'}
        environmentName={environmentName}
        environmentColor={environmentColor}
      />
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
