import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { listGrants } from '../access'
import type { OidcVerifier } from '../auth/oidc'
import type { ServerConfig } from '../config'
import type { Db } from '../db'
import { unauthorized } from '../errors'
import { endSession, rotateSession, startSession } from '../store/sessions'
import { syncEntraTeams } from '../store/teams'
import { upsertUserByEmail, upsertUserByIdentity } from '../store/users'

const DevLoginSchema = z.object({
  email: z.string().email(),
  name: z.string().max(200).optional()
})

const OidcLoginSchema = z.object({
  idToken: z.string().min(1).max(20_000),
  nonce: z.string().min(16).max(200)
})

const RefreshSchema = z.object({ refreshToken: z.string().min(1).max(200) })

export function registerAuthRoutes(
  app: FastifyInstance,
  db: Db,
  config: ServerConfig,
  oidc: OidcVerifier | null
): void {
  // Entra ID: the client did authorization code + PKCE with Microsoft and hands
  // us the id_token; we check it and open our own session (ADR 0018 fase 0).
  if (oidc) {
    app.post('/api/v1/auth/oidc/login', async (request) => {
      const input = OidcLoginSchema.parse(request.body)
      const identity = await oidc.verify(input.idToken, input.nonce)
      const { adminGroups, allowNewUsers } = oidc.config
      const role =
        adminGroups.length > 0 && identity.groups
          ? identity.groups.some((g) => adminGroups.includes(g))
            ? 'admin'
            : 'member'
          : null
      const user = await upsertUserByIdentity(
        db,
        { ...identity, role },
        { allowNew: allowNewUsers }
      )
      if (!user) throw unauthorized('User disabled')
      // Teams linked to an Entra group follow the token; no groups claim = leave them alone.
      if (identity.groups) await syncEntraTeams(db, user.id, identity.groups)
      return { ...(await startSession(db, config, user)), user }
    })
  }

  // Dev/test sign-in by e-mail only — never with Entra in production (config refuses it).
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

  // Lets the desktop hide what the user cannot do; the server still checks every call.
  // Connection and access grants travel apart: older desktops only know the three tree levels.
  app.get('/api/v1/me/access', async (request) => {
    const grants = request.user.role === 'admin' ? [] : await listGrants(db, request.user.id)
    const teams = await db.query<{ id: string; name: string }>(
      `SELECT t.id, t.name FROM teams t
       INNER JOIN team_members tm ON tm.team_id = t.id
       WHERE tm.user_id = $1 ORDER BY lower(t.name)`,
      [request.user.id]
    )
    return {
      role: request.user.role,
      teams: teams.rows,
      grants: grants.filter((g) => g.scopeType !== 'connection' && g.scopeType !== 'access'),
      connectionGrants: grants
        .filter((g) => g.scopeType === 'connection')
        .map((g) => ({ connectionId: g.scopeId, role: g.role })),
      accessGrants: grants
        .filter((g) => g.scopeType === 'access')
        .map((g) => ({ accessId: g.scopeId, role: g.role }))
    }
  })
}
