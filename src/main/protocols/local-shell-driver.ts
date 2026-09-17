import os from 'node:os'
import type {
  ProtocolSession,
  SessionDataPort,
  SessionPortMessage,
  SessionState,
  TerminalCapability
} from '@shared/protocols'
import { coerceBytes } from '@shared/protocols'
import * as pty from 'node-pty'
import { SessionPortOutlet } from './session-port-outlet'

function defaultShell(): string {
  if (process.platform === 'win32') {
    return process.env.COMSPEC || 'powershell.exe'
  }
  return process.env.SHELL || '/bin/zsh'
}

class LocalShellProtocolSession implements ProtocolSession {
  readonly id: string
  readonly kind = 'terminal' as const
  readonly protocol = 'local-shell'
  private _state: SessionState = 'connected'
  private port: SessionDataPort | null = null
  private readonly outlet = new SessionPortOutlet()
  private readonly ptyProcess: pty.IPty
  private disposed = false

  readonly terminal: TerminalCapability = {
    write: (data: Uint8Array): void => {
      if (this.disposed) return
      this.ptyProcess.write(Buffer.from(data).toString('utf-8'))
    },
    resize: (cols: number, rows: number): void => {
      if (this.disposed) return
      try {
        this.ptyProcess.resize(cols, rows)
      } catch {
        // pty may already be gone
      }
    }
  }

  constructor(id: string, ptyProcess: pty.IPty) {
    this.id = id
    this.ptyProcess = ptyProcess

    ptyProcess.onData((data) => {
      this.post({ type: 'data', data: Buffer.from(data, 'utf-8') })
    })
    ptyProcess.onExit(() => {
      void this.dispose()
    })
  }

  get state(): SessionState {
    return this._state
  }

  attachPort(port: SessionDataPort): void {
    this.port = port
    port.on('message', (event) => {
      const message = event.data as SessionPortMessage
      if (!message || typeof message !== 'object') return

      if (message.type === 'data') {
        const bytes = coerceBytes(message.data)
        if (bytes) this.terminal.write(bytes)
        return
      }

      if (message.type === 'resize') {
        this.terminal.resize(message.cols, message.rows)
      }
    })
    port.start()
    this.outlet.attach(port)
    this.post({ type: 'state', state: this._state })
  }

  async dispose(): Promise<void> {
    if (this.disposed) return
    this.disposed = true
    this._state = 'closed'
    this.post({ type: 'state', state: 'closed' })
    try {
      this.ptyProcess.kill()
    } catch {
      // already gone
    }
    try {
      this.port?.close()
    } catch {
      // ignore
    }
    this.port = null
    this.outlet.detach()
  }

  private post(message: SessionPortMessage): void {
    this.outlet.post(message)
  }
}

/**
 * Opens a local shell (no host, no credentials — connectionless, unlike SSH/Telnet/Serial).
 * Not a `ProtocolDriver`: `createSession` doesn't take a `Connection`, so it's invoked
 * directly by `ProtocolManager.openLocal()` rather than registered/dispatched by protocol name.
 */
export class LocalShellDriver {
  readonly kind = 'terminal' as const

  async createSession(sessionId: string): Promise<ProtocolSession> {
    const ptyProcess = pty.spawn(defaultShell(), [], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: os.homedir(),
      env: process.env as Record<string, string>
    })

    return new LocalShellProtocolSession(sessionId, ptyProcess)
  }
}
