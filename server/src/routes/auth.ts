import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { ServerConfig } from '../config'
import type { Db } from '../db'
import { unauthorized } from '../errors'
import { endSession, rotateSession, startSession } from '../store/sessions'
import { upsertUserByEmail } from '../store/users'

const DevLoginSchema = z.object({
  email: z.string().email(),
  name: z.string().max(200).optional()
})

const RefreshSchema = z.object({ refreshToken: z.string().min(1).max(200) })

export function registerAuthRoutes(app: FastifyInstance, db: Db, config: ServerConfig): void {
  // Dev/test sign-in by e-mail only. Entra ID (OIDC + PKCE) replaces it in phase 0.
  if (config.authModes.includes('dev')) {
    app.post('/api/v1/auth/dev/login', async (request) => {
      const input = DevLoginSchema.parse(request.body)
      const user = await upsertUserByEmail(db, input.email, input.name ?? '')
      if (!user) throw unauthorized('User disabled')
      return { ...(await startSession(db, config, user)), user }
    })
  }

  app.post('/api/v1/auth/refresh', async (request) => {
    const { refreshToken } = RefreshSchema.parse(request.body)
    return rotateSession(db, config, refreshToken)
  })

  app.post('/api/v1/auth/logout', async (request, reply) => {
    const { refreshToken } = RefreshSchema.parse(request.body)
    await endSession(db, refreshToken)
    return reply.status(204).send()
  })

  app.get('/api/v1/me', async (request) => request.user)
}
