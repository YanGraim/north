import net from 'node:net'
import type { ConnectionHealthStatus } from '@shared/types'
import type { Repositories } from '../repositories'

const DEFAULT_INTERVAL_MS = 60_000
const CONNECT_TIMEOUT_MS = 5_000

export type ConnectionHealthChange = {
  connectionId: string
  status: ConnectionHealthStatus
}

export type CheckPortResult = { ok: boolean; latencyMs: number; error?: string }
export type CheckPortFn = (host: string, port: number) => Promise<CheckPortResult>

export type ConnectionMonitorDeps = {
  checkPort?: CheckPortFn
  /** Called on every status transition — main wires this to a desktop notification + IPC broadcast. */
  onChange?: (change: ConnectionHealthChange) => void
}

/**
 * Polls TCP reachability for every Connection with monitoring enabled.
 * Records a `connection_health_events` row only on a status *transition*
 * (up→down / down→up) — every poll updates `connection_monitors.last_checked_at`
 * silently otherwise. No metrics, no agent — just "does the port accept a
 * connection", the same way opening a session would reach it.
 */
export class ConnectionMonitorService {
  private timer: ReturnType<typeof setInterval> | null = null
  private ticking = false
  private readonly checkPort: CheckPortFn

  constructor(
    private readonly repos: Repositories,
    private readonly deps: ConnectionMonitorDeps = {}
  ) {
    this.checkPort = deps.checkPort ?? checkTcpPort
  }

  start(intervalMs = DEFAULT_INTERVAL_MS): void {
    if (this.timer) return
    this.timer = setInterval(() => void this.checkAllOnce(), intervalMs)
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  /** Runs one pass over every enabled monitor. Exposed directly for tests and manual triggers. */
  async checkAllOnce(): Promise<void> {
    if (this.ticking) return
    this.ticking = true
    try {
      const monitors = this.repos.connectionMonitors.listEnabled()
      for (const monitor of monitors) {
        await this.checkOne(monitor.connectionId, monitor.lastStatus)
      }
    } finally {
      this.ticking = false
    }
  }

  private async checkOne(
    connectionId: string,
    previousStatus: ConnectionHealthStatus | null
  ): Promise<void> {
    const connection = this.repos.connections.get(connectionId)
    if (!connection) return

    const result = await this.checkPort(connection.host, connection.port)
    const status: ConnectionHealthStatus = result.ok ? 'up' : 'down'

    this.repos.connectionMonitors.recordStatus(connectionId, status)

    if (status === previousStatus) return

    this.repos.connectionHealthEvents.create({
      connectionId,
      previousStatus,
      newStatus: status,
      latencyMs: result.ok ? result.latencyMs : null,
      errorMessage: result.ok ? null : (result.error ?? null)
    })

    this.deps.onChange?.({ connectionId, status })
  }
}

function checkTcpPort(
  host: string,
  port: number,
  timeoutMs = CONNECT_TIMEOUT_MS
): Promise<CheckPortResult> {
  return new Promise((resolve) => {
    const started = Date.now()
    const socket = new net.Socket()
    let settled = false
    const finish = (ok: boolean, error?: string): void => {
      if (settled) return
      settled = true
      socket.destroy()
      resolve({ ok, latencyMs: Date.now() - started, error })
    }
    socket.setTimeout(timeoutMs)
    socket.once('connect', () => finish(true))
    socket.once('timeout', () => finish(false, 'timeout'))
    socket.once('error', (err) => finish(false, err.message))
    socket.connect(port, host)
  })
}
