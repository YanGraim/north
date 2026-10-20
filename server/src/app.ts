import { fileURLToPath } from 'node:url'
import Fastify, { type FastifyInstance } from 'fastify'
import { ZodError } from 'zod'
import { verifyAccessToken } from './auth/tokens'
import type { ServerConfig } from './config'
import type { Db } from './db'
import { ApiError, unauthorized } from './errors'
import { registerAdminRoutes } from './routes/admin'
import { registerAdminPanel } from './routes/admin-panel'
import { registerAuditRoutes } from './routes/audit'
import { registerAuthRoutes } from './routes/auth'
import { registerInventoryRoutes } from './routes/inventory'
import { registerSecretRoutes } from './routes/secrets'
import { findActiveUser, type User } from './store/users'

declare module 'fastify' {
  interface FastifyRequest {
    user: User
  }
}

export const SERVER_VERSION = '0.1.0'

/**
 * `server/admin/`: next to `src/` in the repo and to `dist/` in the image, so
 * the same relative URL works from this file and from the bundle.
 */
const ADMIN_DIR = fileURLToPath(new URL('../admin/', import.meta.url))

/** Routes reachable without a bearer token. */
const PUBLIC_ROUTES = new Set([
  '/api/v1/info',
  '/api/v1/auth/dev/login',
  '/api/v1/auth/refresh',
  '/api/v1/auth/logout',
  '/healthz'
])

export async function buildApp(deps: { db: Db; config: ServerConfig }): Promise<FastifyInstance> {
  const { db, config } = deps
  const app = Fastify({ logger: false })

  app.decorateRequest('user', null as unknown as User)

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ApiError) {
      return reply
        .status(error.status)
        .send({ error: { code: error.code, message: error.message } })
    }
    if (error instanceof ZodError) {
      const message = error.issues
        .map((issue) => `${issue.path.join('.') || 'body'}: ${issue.message}`)
        .join('; ')
      return reply.status(400).send({ error: { code: 'validation', message } })
    }
    const status = (error as { statusCode?: number }).statusCode
    if (status && status >= 400 && status < 500) {
      return reply
        .status(status)
        .send({ error: { code: 'validation', message: (error as Error).message } })
    }
    app.log.error(error)
    return reply.status(500).send({ error: { code: 'internal', message: 'Internal error' } })
  })

  app.setNotFoundHandler((_request, reply) =>
    reply.status(404).send({ error: { code: 'not_found', message: 'Route not found' } })
  )

  app.addHook('onRequest', async (request) => {
    const path = request.routeOptions.url ?? request.url.split('?')[0]
    if (PUBLIC_ROUTES.has(path) || !path.startsWith('/api/')) return
    const header = request.headers.authorization ?? ''
    const token = header.startsWith('Bearer ') ? header.slice(7) : null
    if (!token) throw unauthorized('Missing bearer token')
    let userId: string
    try {
      ;({ userId } = await verifyAccessToken(token, config.jwtSecret))
    } catch {
      throw unauthorized('Invalid or expired token')
    }
    // Checked on every call so disabling a user cuts access right away (ADR 0018 §9).
    const user = await findActiveUser(db, userId)
    if (!user) throw unauthorized('User disabled or removed')
    request.user = user
  })

  app.get('/healthz', async () => ({ ok: true }))

  app.get('/api/v1/info', async () => ({
    product: 'north-server',
    version: SERVER_VERSION,
    name: config.organizationName,
    auth: { modes: config.authModes }
  }))

  registerAuthRoutes(app, db, config)
  registerInventoryRoutes(app, db, config.masterKey)
  registerSecretRoutes(app, db, config.masterKey)
  registerAuditRoutes(app, db)
  registerAdminRoutes(app, db)
  registerAdminPanel(app, ADMIN_DIR)
  return app
}
