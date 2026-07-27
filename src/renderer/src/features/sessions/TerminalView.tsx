import { getXtermTheme, useResolvedTheme } from '@renderer/lib/xterm-theme'
import '@xterm/xterm/css/xterm.css'
import { coerceBytes } from '@shared/protocols'
import { FitAddon } from '@xterm/addon-fit'
import { Terminal } from '@xterm/xterm'
import { Folder, User } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

type TerminalViewProps = {
  sessionId: string
  visible: boolean
  title?: string
  username?: string | null
  host?: string | null
}

export function TerminalView({
  sessionId,
  visible,
  title,
  username,
  host
}: TerminalViewProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const visibleRef = useRef(visible)
  const [awaitingOutput, setAwaitingOutput] = useState(true)
  const resolvedTheme = useResolvedTheme()
  const themeRef = useRef(resolvedTheme)
  themeRef.current = resolvedTheme
  visibleRef.current = visible

  const identity =
    username && host ? `${username}@${host}` : host ? host : username ? username : null

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
      allowProposedApi: true
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(container)
    fit.fit()
    termRef.current = term
    fitRef.current = fit

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

  return (
    <div
      className="flex h-full w-full flex-col overflow-hidden bg-background"
      style={{ display: visible ? 'flex' : 'none' }}
      data-session-id={sessionId}
    >
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border bg-surface px-3">
        {identity ? (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-surface-elevated px-2 py-1 font-mono text-[11px] text-foreground">
            <User className="size-3 text-muted" aria-hidden />
            {identity}
          </span>
        ) : null}
        <span className="inline-flex items-center gap-1.5 rounded-md bg-surface-elevated px-2 py-1 font-mono text-[11px] text-foreground">
          <Folder className="size-3 text-muted" aria-hidden />
          {title ?? 'session'}
        </span>
        <span className="ml-auto text-[11px] text-muted">
          digite no terminal · Workspace para voltar
        </span>
      </div>
      <div className="relative min-h-0 flex-1 p-1">
        <div ref={containerRef} className="h-full min-h-[120px] w-full" />
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
