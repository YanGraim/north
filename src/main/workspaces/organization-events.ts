import { type OrganizationClient, OrganizationSignedOutError } from './organization-client'

/** What main does with a push from the North Server (ADR 0018 §6, fase 5). */
export type OrganizationEventHandlers = {
  onInventoryChanged(entity: string): void
  onAccessChanged(): void
  /** The admin disabled this person: end the sessions and sign out. */
  onRevoked(): void
  /** The refresh token no longer works. */
  onSignedOut(): void
}

const CLOSE_UNAUTHORIZED = 4401
const CLOSE_REVOKED = 4403
const MAX_RETRY_MS = 30_000

/**
 * Keeps one events channel open per signed-in organization. The token goes
 * in the first message; a 4401 refreshes it, a 4403 means revoked, anything
 * else reconnects with backoff (network drop, server restart).
 */
export class OrganizationEvents {
  private socket: WebSocket | null = null
  private stopped = false
  private failures = 0
  private retry: ReturnType<typeof setTimeout> | null = null
  private refreshNext = false
  connected = false

  constructor(
    private readonly client: OrganizationClient,
    private readonly handlers: OrganizationEventHandlers,
    private readonly options: { retryMs?: number } = {}
  ) {}

  /** Resolves once the channel is ready, or after the first failed attempt. */
  start(): Promise<void> {
    this.stopped = false
    return new Promise((resolve) => this.connect(resolve))
  }

  stop(): void {
    this.stopped = true
    if (this.retry) clearTimeout(this.retry)
    this.retry = null
    this.connected = false
    this.socket?.close()
    this.socket = null
  }

  /** Test hook: simulate the network dropping the channel. */
  dropForTest(): void {
    this.socket?.close()
  }

  private async connect(settled: () => void = () => undefined): Promise<void> {
    if (this.stopped) return settled()
    let token: string
    try {
      token = await this.client.accessTokenForEvents(this.refreshNext)
      this.refreshNext = false
    } catch (error) {
      if (error instanceof OrganizationSignedOutError) {
        this.stop()
        this.handlers.onSignedOut()
        return settled()
      }
      this.scheduleRetry()
      return settled()
    }
    if (this.stopped) return settled()

    const url = `${this.client.baseUrl.replace(/^http/, 'ws')}/api/v1/events`
    const socket = new WebSocket(url)
    this.socket = socket
    socket.addEventListener('open', () => socket.send(JSON.stringify({ type: 'auth', token })))
    socket.addEventListener('message', (event) => {
      let msg: { type?: string; entity?: string }
      try {
        msg = JSON.parse(String(event.data))
      } catch {
        return
      }
      if (msg.type === 'ready') {
        this.connected = true
        this.failures = 0
        settled()
      } else if (msg.type === 'inventory.changed') {
        this.handlers.onInventoryChanged(msg.entity ?? 'unknown')
      } else if (msg.type === 'access.changed') {
        this.handlers.onAccessChanged()
      }
    })
    socket.addEventListener('close', (event) => {
      if (this.socket !== socket) return
      this.socket = null
      this.connected = false
      settled()
      if (this.stopped) return
      if (event.code === CLOSE_REVOKED) {
        this.stop()
        this.handlers.onRevoked()
        return
      }
      if (event.code === CLOSE_UNAUTHORIZED) this.refreshNext = true
      this.scheduleRetry()
    })
  }

  private scheduleRetry(): void {
    if (this.stopped) return
    const base = this.options.retryMs ?? 1000
    const delay = Math.min(MAX_RETRY_MS, base * 2 ** Math.min(this.failures, 10))
    this.failures++
    this.retry = setTimeout(() => {
      this.retry = null
      void this.connect()
    }, delay)
  }
}
