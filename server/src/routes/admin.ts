import { IdSchema } from '@shared/types'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { listGrants } from '../access'
import type { Db } from '../db'
import { forbidden, notFound, orNotFound } from '../errors'
import type { EventHub } from '../events'
import { recordAudit } from '../store/audit'
import { deleteGrant, listUserGrants, setGrant } from '../store/grants'
import { createUser, listUsers, updateUser } from '../store/users'

const ScopeType = z.enum(['client', 'environment', 'group'])
const GrantKey = z.object({ userId: IdSchema, scopeType: ScopeType, scopeId: IdSchema })
const GrantBody = GrantKey.extend({ role: z.enum(['editor', 'viewer']) })
const GrantsQuery = z.object({ scopeType: ScopeType.optional(), scopeId: IdSchema.optional() })
const NewUser = z.object({ email: z.string().email(), name: z.string().max(200).optional() })
const UserPatch = z
  .object({
    role: z.enum(['admin', 'member']).optional(),
    disabled: z.boolean().optional(),
    name: z.string().min(1).max(200).optional()
  })
  .strict()

function requireAdmin(req: FastifyRequest): void {
  if (req.user.role !== 'admin') throw forbidden()
}

/** Audit target for a grant change, named by the person's e-mail. */
async function userTarget(db: Db, id: string) {
  const { rows } = await db.query<{ email: string }>('SELECT email FROM users WHERE id = $1', [id])
  return { type: 'user', id, name: rows[0]?.email ?? null }
}

/** Users and who can reach each project. Admin only, every change audited. */
export function registerAdminRoutes(app: FastifyInstance, db: Db, hub: EventHub): void {
  const v1 = '/api/v1/admin'

  app.get(`${v1}/users`, async (req) => {
    requireAdmin(req)
    const [users, grants] = await Promise.all([listUsers(db), listUserGrants(db)])
    return users.map((user) => ({
      ...user,
      grants: grants
        .filter((g) => g.userId === user.id)
        .map(({ scopeType, scopeId, role }) => ({ scopeType, scopeId, role }))
    }))
  })

  app.post(`${v1}/users`, async (req, reply) => {
    requireAdmin(req)
    const input = NewUser.parse(req.body)
    const user = await createUser(db, input.email, input.name ?? '')
    await recordAudit(db, req.user, 'user.create', { type: 'user', id: user.id, name: user.email })
    return reply.status(201).send({ ...user, grants: [] })
  })

  app.patch(`${v1}/users/:id`, async (req) => {
    requireAdmin(req)
    const { id } = z.object({ id: IdSchema }).parse(req.params)
    const input = UserPatch.parse(req.body)
    const user = orNotFound(await updateUser(db, id, input), 'User')
    if (user.disabled) hub.revoke(id)
    else hub.toUser(id, { type: 'access.changed' })
    await recordAudit(db, req.user, 'user.update', { type: 'user', id, name: user.email }, input)
    return { ...user, grants: await listGrants(db, id) }
  })

  app.get(`${v1}/grants`, async (req) => {
    requireAdmin(req)
    const { scopeType, scopeId } = GrantsQuery.parse(req.query)
    return listUserGrants(db, scopeType && scopeId ? { scopeType, scopeId } : undefined)
  })

  app.put(`${v1}/grants`, async (req, reply) => {
    requireAdmin(req)
    const input = GrantBody.parse(req.body)
    await setGrant(db, input.userId, input.scopeType, input.scopeId, input.role)
    await recordAudit(db, req.user, 'grant.set', await userTarget(db, input.userId), {
      scopeType: input.scopeType,
      scopeId: input.scopeId,
      role: input.role
    })
    hub.toUser(input.userId, { type: 'access.changed' })
    return reply.status(204).send()
  })

  app.delete(`${v1}/grants`, async (req, reply) => {
    requireAdmin(req)
    const input = GrantKey.parse(req.body)
    if (!(await deleteGrant(db, input.userId, input.scopeId))) throw notFound('Grant')
    await recordAudit(db, req.user, 'grant.delete', await userTarget(db, input.userId), {
      scopeType: input.scopeType,
      scopeId: input.scopeId
    })
    hub.toUser(input.userId, { type: 'access.changed' })
    return reply.status(204).send()
  })
}
