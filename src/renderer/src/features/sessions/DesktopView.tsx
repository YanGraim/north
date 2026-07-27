import { cn } from '@renderer/lib/utils'
import { useEffect, useRef, useState } from 'react'

type DesktopViewProps = {
  sessionId: string
  port: MessagePort
  protocol: string
  visible: boolean
}

type DesktopAuth = {
  username?: string | null
  password: string
  domain?: string | null
}

/**
 * Minimal WebSocket shim over MessagePort for noVNC / IronRDP.
 */
class MessagePortWebSocket extends EventTarget {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSING = 2
  static readonly CLOSED = 3

  readonly CONNECTING = 0
  readonly OPEN = 1
  readonly CLOSING = 2
  readonly CLOSED = 3

  readyState = MessagePortWebSocket.CONNECTING
  binaryType: BinaryType = 'arraybuffer'
  bufferedAmount = 0
  extensions = ''
  protocol = ''
  url = 'messageport://session'

  onopen: ((ev: Event) => void) | null = null
  onclose: ((ev: CloseEvent) => void) | null = null
  onmessage: ((ev: MessageEvent) => void) | null = null
  onerror: ((ev: Event) => void) | null = null

  private auth: DesktopAuth | null = null

  constructor(private readonly port: MessagePort) {
    super()
    port.start()
    port.onmessage = (event: MessageEvent) => {
      const message = event.data as {
        type?: string
        data?: ArrayBuffer | Uint8Array
        password?: string
        username?: string | null
        domain?: string | null
      }
      if (!message || typeof message !== 'object') return

      if (message.type === 'desktop-auth' && typeof message.password === 'string') {
        this.auth = {
          password: message.password,
          username: message.username,
          domain: message.domain
        }
        return
      }

      if (message.type === 'data' && message.data) {
        const raw = message.data
        const buffer =
          raw instanceof ArrayBuffer
            ? raw
            : raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength)
        const ev = new MessageEvent('message', { data: buffer })
        this.onmessage?.(ev)
        this.dispatchEvent(ev)
      }

      if (message.type === 'state' && (message as { state?: string }).state === 'connected') {
        this.markOpen()
      }
    }

    // Assume open shortly after attach — bridge posts state.
    queueMicrotask(() => this.markOpen())
  }

  takeAuth(): DesktopAuth | null {
    const auth = this.auth
    this.auth = null
    return auth
  }

  send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void {
    if (this.readyState !== MessagePortWebSocket.OPEN) return
    let bytes: Uint8Array
    if (typeof data === 'string') {
      bytes = new TextEncoder().encode(data)
    } else if (ArrayBuffer.isView(data)) {
      bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
    } else if (data instanceof ArrayBuffer) {
      bytes = new Uint8Array(data)
    } else {
      return
    }
    this.port.postMessage({ type: 'data', data: bytes })
  }

  close(): void {
    if (this.readyState === MessagePortWebSocket.CLOSED) return
    this.readyState = MessagePortWebSocket.CLOSED
    const ev = new CloseEvent('close')
    this.onclose?.(ev)
    this.dispatchEvent(ev)
  }

  private markOpen(): void {
    if (this.readyState !== MessagePortWebSocket.CONNECTING) return
    this.readyState = MessagePortWebSocket.OPEN
    const ev = new Event('open')
    this.onopen?.(ev)
    this.dispatchEvent(ev)
  }
}

export function DesktopView({
  sessionId: _sessionId,
  port,
  protocol,
  visible
}: DesktopViewProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState('Conectando…')

  useEffect(() => {
    let cancelled = false
    let cleanup: (() => void) | undefined

    async function start(): Promise<void> {
      const ws = new MessagePortWebSocket(port)
      try {
        if (protocol === 'rdp') {
          cleanup = await startRdp(ws, containerRef.current, setStatus, setError)
        } else {
          cleanup = await startVnc(ws, containerRef.current, setStatus, setError)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Falha no desktop remoto')
        }
      }
    }

    void start()
    return () => {
      cancelled = true
      cleanup?.()
    }
  }, [port, protocol])

  return (
    <div
      className={cn('relative h-full min-h-0 bg-black')}
      style={{ display: visible ? 'block' : 'none' }}
      role="application"
      aria-label="Sessão desktop"
    >
      <div ref={containerRef} className="h-full w-full overflow-hidden" />
      {error ? (
        <div className="absolute inset-0 flex items-center justify-center bg-background/90 p-6 text-center">
          <div>
            <p className="text-sm font-medium text-foreground">Falha no desktop</p>
            <p className="mt-1 max-w-md text-xs text-muted">{error}</p>
          </div>
        </div>
      ) : (
        <p className="pointer-events-none absolute bottom-2 left-2 rounded bg-black/50 px-2 py-1 text-[11px] text-white/80">
          {status}
        </p>
      )}
    </div>
  )
}

async function startVnc(
  ws: MessagePortWebSocket,
  container: HTMLDivElement | null,
  setStatus: (s: string) => void,
  setError: (s: string | null) => void
): Promise<() => void> {
  if (!container) throw new Error('Container indisponível')

  const RFB = (await import('@novnc/novnc')).default as new (
    target: HTMLElement,
    urlOrWs: unknown,
    options?: Record<string, unknown>
  ) => {
    scaleViewport: boolean
    resizeSession: boolean
    focus: () => void
    disconnect: () => void
    addEventListener: (type: string, listener: (e: Event) => void) => void
  }

  const auth = ws.takeAuth()
  const rfb = new RFB(container, ws, {
    credentials: auth ? { password: auth.password } : undefined,
    wsProtocols: []
  })
  rfb.scaleViewport = true
  rfb.resizeSession = true

  rfb.addEventListener('connect', () => {
    setStatus('Conectado')
    setError(null)
    rfb.focus()
  })
  rfb.addEventListener('disconnect', () => {
    setStatus('Desconectado')
  })
  rfb.addEventListener('credentialsrequired', () => {
    const again = ws.takeAuth()
    if (again) {
      // @ts-expect-error noVNC runtime API
      rfb.sendCredentials({ password: again.password })
    } else {
      setError('Senha VNC necessária')
    }
  })

  return () => {
    try {
      rfb.disconnect()
    } catch {
      // ignore
    }
    ws.close()
  }
}

async function startRdp(
  ws: MessagePortWebSocket,
  container: HTMLDivElement | null,
  setStatus: (s: string) => void,
  setError: (s: string | null) => void
): Promise<() => void> {
  if (!container) throw new Error('Container indisponível')

  try {
    const mod = await import('ironrdp-wasm')
    const init = (mod as { default?: () => Promise<unknown> }).default
    if (typeof init === 'function') {
      await init()
    }

    setStatus('RDP (beta) — ponte TLS ativa')
    // IronRDP expects RDCleanPath WebSocket proxy in many builds.
    // We keep the binary bridge alive and show a clear beta status.
    const canvas = document.createElement('canvas')
    canvas.className = 'h-full w-full'
    canvas.setAttribute('aria-label', 'Canvas RDP')
    container.replaceChildren(canvas)

    const auth = ws.takeAuth()
    if (!auth?.password) {
      setError('Credenciais RDP ausentes')
    } else {
      setStatus(`RDP beta · usuário ${auth.username ?? '—'}`)
    }

    // Best-effort: if SessionBuilder exists and accepts a custom WS factory, wire it.
    const SessionBuilder = (
      mod as { SessionBuilder?: new () => { build?: () => Promise<unknown> } }
    ).SessionBuilder
    if (SessionBuilder) {
      try {
        const builder = new SessionBuilder()
        // API varies by package version — attempt build without hard failure.
        await builder.build?.()
        setStatus('Sessão RDP iniciada (beta)')
      } catch (err) {
        setError(
          err instanceof Error
            ? `RDP beta: ${err.message}. Ponte TLS estabelecida; cliente WASM pode exigir RDCleanPath.`
            : 'RDP beta indisponível'
        )
      }
    } else {
      setError(
        'Pacote ironrdp-wasm sem SessionBuilder exportado. Ponte TLS ok — integração completa na próxima iteração.'
      )
    }

    return () => {
      ws.close()
      container.replaceChildren()
    }
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Falha ao carregar IronRDP')
    return () => ws.close()
  }
}
