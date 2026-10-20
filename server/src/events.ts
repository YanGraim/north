import websocket from '@fastify/websocket'
import type { FastifyInstance } from 'fastify'
import { verifyAccessToken } from './auth/tokens'
import type { Db } from './db'
import { findActiveUser } from './store/users'

/**
 * Push channel (ADR 0018 §6, fase 5). Messages say *what kind* of thing
 * changed, never the data: each desktop refetches through the API, which
 * already filters by the user's access.
 *
 * In-memory: one server instance. Several instances behind a load balancer
 * would relay through Postgres LISTEN/NOTIFY.
 */
export type ServerEvent =
  | { type: 'ready' }
  | {
      type: 'inventory.changed'
      entity: 'client' | 'environment' | 'group' | 'connection' | 'tag'
    }
  | { type: 'access.changed' }
  | { type: 'session.revoked'; reason: 'disabled' }

/** Close codes: the desktop signs out on these instead of reconnecting. */
export const CLOSE_UNAUTHORIZED = 4401
export const CLOSE_REVOKED = 4403

type Socket = { send(data: string): void; close(code?: number, reason?: string): void }

export class EventHub {
  private readonly byUser = new Map<string, Set<Socket>>()

  add(userId: string, socket: Socket): () => void {
    let set = this.byUser.get(userId)
    if (!set) {
      set = new Set()
      this.byUser.set(userId, set)
    }
    set.add(socket)
    return () => {
      set.delete(socket)
      if (set.size === 0) this.byUser.delete(userId)
    }
  }

  broadcast(event: ServerEvent): void {
    for (const set of this.byUser.values()) for (const s of set) s.send(JSON.stringify(event))
  }

  toUser(userId: string, event: ServerEvent): void {
    for (const s of this.byUser.get(userId) ?? []) s.send(JSON.stringify(event))
  }

  revoke(userId: string): void {
    for (const s of [...(this.byUser.get(userId) ?? [])]) {
      s.send(JSON.stringify({ type: 'session.revoked', reason: 'disabled' } satisfies ServerEvent))
      s.close(CLOSE_REVOKED, 'revoked')
    }
  }
}

const ENTITY: Record<string, Extract<ServerEvent, { type: 'inventory.changed' }>['entity']> = {
  clients: 'client',
  environments: 'environment',
  groups: 'group',
  connections: 'connection',
  tags: 'tag'
}

const AUTH_TIMEOUT_MS = 5000

export async function registerEvents(
  app: FastifyInstance,
  db: Db,
  hub: EventHub,
  jwtSecret: string
): Promise<void> {
  await app.register(websocket)

  // The token goes in the first message, not the URL, so it never lands in access logs.
  app.get('/api/v1/events', { websocket: true }, (socket) => {
    let release: (() => void) | null = null
    const timer = setTimeout(
      () => socket.close(CLOSE_UNAUTHORIZED, 'auth timeout'),
      AUTH_TIMEOUT_MS
    )
    socket.on('message', async (raw: Buffer) => {
      if (release) return
      try {
        const msg = JSON.parse(raw.toString()) as { type?: string; token?: string }
        if (msg.type !== 'auth' || typeof msg.token !== 'string') throw new Error('auth first')
        const { userId } = await verifyAccessToken(msg.token, jwtSecret)
        if (!(await findActiveUser(db, userId))) throw new Error('inactive')
        clearTimeout(timer)
        release = hub.add(userId, socket)
        socket.send(JSON.stringify({ type: 'ready' } satisfies ServerEvent))
      } catch {
        clearTimeout(timer)
        socket.close(CLOSE_UNAUTHORIZED, 'unauthorized')
      }
    })
    socket.on('close', () => {
      clearTimeout(timer)
      release?.()
    })
  })

  // Every successful write to the shared tree is announced; favorites are personal.
  app.addHook('onResponse', async (request, reply) => {
    if (request.method === 'GET' || reply.statusCode >= 300) return
    const path = request.routeOptions.url ?? ''
    const match = /^\/api\/v1\/(clients|environments|groups|connections|tags)(\/|$)/.exec(path)
    if (!match || path.endsWith('/favorite')) return
    hub.broadcast({ type: 'inventory.changed', entity: ENTITY[match[1]] })
  })
}
