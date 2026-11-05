import { IdSchema } from '@shared/types'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { listGrants } from '../access'
import type { Db } from '../db'
import { forbidden, notFound, orNotFound } from '../errors'
import type { EventHub } from '../events'
import { recordAudit } from '../store/audit'
import { deleteGrant, listPrincipalGrants, type Principal, setGrant } from '../store/grants'
import {
  addTeamMember,
  createTeam,
  deleteTeam,
  listTeams,
  removeTeamMember,
  updateTeam
} from '../store/teams'
import { createUser, listUsers, updateUser } from '../store/users'

const ScopeType = z.enum(['client', 'environment', 'group', 'connection'])
const GrantKey = z
  .object({
    userId: IdSchema.optional(),
    teamId: IdSchema.optional(),
    scopeType: ScopeType,
    scopeId: IdSchema
  })
  .refine((g) => Boolean(g.userId) !== Boolean(g.teamId), {
    message: 'Give either userId or teamId'
  })
const GrantBody = z
  .object({
    userId: IdSchema.optional(),
    teamId: IdSchema.optional(),
    scopeType: ScopeType,
    scopeId: IdSchema,
    role: z.enum(['editor', 'viewer'])
  })
  .refine((g) => Boolean(g.userId) !== Boolean(g.teamId), {
    message: 'Give either userId or teamId'
  })
const GrantsQuery = z.object({ scopeType: ScopeType.optional(), scopeId: IdSchema.optional() })
const NewUser = z.object({ email: z.string().email(), name: z.string().max(200).optional() })
const UserPatch = z
  .object({
    role: z.enum(['admin', 'member']).optional(),
    disabled: z.boolean().optional(),
    name: z.string().min(1).max(200).optional()
  })
  .strict()
const TeamBody = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().max(500).optional(),
  entraGroupId: z.string().trim().max(100).nullable().optional()
})
const TeamPatch = TeamBody.partial().strict()
const MemberBody = z.object({ userId: IdSchema })

function requireAdmin(req: FastifyRequest): void {
  if (req.user.role !== 'admin') throw forbidden()
}

const principalOf = (g: { userId?: string; teamId?: string }): Principal =>
  g.teamId ? { kind: 'team', id: g.teamId } : { kind: 'user', id: g.userId as string }

/** Audit target for a grant change: the person's e-mail or the team's name. */
async function principalTarget(db: Db, principal: Principal) {
  const { rows } = await db.query<{ label: string }>(
    principal.kind === 'user'
      ? 'SELECT email AS label FROM users WHERE id = $1'
      : 'SELECT name AS label FROM teams WHERE id = $1',
    [principal.id]
  )
  return { type: principal.kind, id: principal.id, name: rows[0]?.label ?? null }
}

/** Users, teams and who can reach each project. Admin only, every change audited. */
export function registerAdminRoutes(app: FastifyInstance, db: Db, hub: EventHub): void {
  const v1 = '/api/v1/admin'

  /** Everyone a grant reaches must refetch what they can see. */
  async function notify(principal: Principal): Promise<void> {
    if (principal.kind === 'user') {
      hub.toUser(principal.id, { type: 'access.changed' })
      return
    }
    const { rows } = await db.query<{ user_id: string }>(
      'SELECT user_id FROM team_members WHERE team_id = $1',
      [principal.id]
    )
    for (const r of rows) hub.toUser(r.user_id, { type: 'access.changed' })
  }

  app.get(`${v1}/users`, async (req) => {
    requireAdmin(req)
    const [users, grants, teams] = await Promise.all([
      listUsers(db),
      listPrincipalGrants(db),
      listTeams(db)
    ])
    return users.map((user) => ({
      ...user,
      grants: grants
        .filter((g) => g.userId === user.id)
        .map(({ scopeType, scopeId, role }) => ({ scopeType, scopeId, role })),
      teamIds: teams.filter((t) => t.members.some((m) => m.userId === user.id)).map((t) => t.id)
    }))
  })

  app.post(`${v1}/users`, async (req, reply) => {
    requireAdmin(req)
    const input = NewUser.parse(req.body)
    const user = await createUser(db, input.email, input.name ?? '')
    await recordAudit(db, req.user, 'user.create', { type: 'user', id: user.id, name: user.email })
    return reply.status(201).send({ ...user, grants: [], teamIds: [] })
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
    return listPrincipalGrants(db, scopeType && scopeId ? { scopeType, scopeId } : undefined)
  })

  app.put(`${v1}/grants`, async (req, reply) => {
    requireAdmin(req)
    const input = GrantBody.parse(req.body)
    const principal = principalOf(input)
    await setGrant(db, principal, input.scopeType, input.scopeId, input.role)
    await recordAudit(db, req.user, 'grant.set', await principalTarget(db, principal), {
      scopeType: input.scopeType,
      scopeId: input.scopeId,
      role: input.role
    })
    await notify(principal)
    return reply.status(204).send()
  })

  app.delete(`${v1}/grants`, async (req, reply) => {
    requireAdmin(req)
    const input = GrantKey.parse(req.body)
    const principal = principalOf(input)
    if (!(await deleteGrant(db, principal, input.scopeId))) throw notFound('Grant')
    await recordAudit(db, req.user, 'grant.delete', await principalTarget(db, principal), {
      scopeType: input.scopeType,
      scopeId: input.scopeId
    })
    await notify(principal)
    return reply.status(204).send()
  })

  // teams
  app.get(`${v1}/teams`, async (req) => {
    requireAdmin(req)
    const [teams, grants] = await Promise.all([listTeams(db), listPrincipalGrants(db)])
    return teams.map((team) => ({
      ...team,
      grants: grants
        .filter((g) => g.teamId === team.id)
        .map(({ scopeType, scopeId, role }) => ({ scopeType, scopeId, role }))
    }))
  })

  app.post(`${v1}/teams`, async (req, reply) => {
    requireAdmin(req)
    const team = await createTeam(db, TeamBody.parse(req.body))
    await recordAudit(db, req.user, 'team.create', { type: 'team', id: team.id, name: team.name })
    return reply.status(201).send({ ...team, grants: [] })
  })

  app.patch(`${v1}/teams/:id`, async (req) => {
    requireAdmin(req)
    const { id } = z.object({ id: IdSchema }).parse(req.params)
    const input = TeamPatch.parse(req.body)
    const team = orNotFound(await updateTeam(db, id, input), 'Team')
    await recordAudit(db, req.user, 'team.update', { type: 'team', id, name: team.name }, input)
    return team
  })

  app.delete(`${v1}/teams/:id`, async (req, reply) => {
    requireAdmin(req)
    const { id } = z.object({ id: IdSchema }).parse(req.params)
    const target = await principalTarget(db, { kind: 'team', id })
    const members = orNotFound(await deleteTeam(db, id), 'Team')
    await recordAudit(db, req.user, 'team.delete', target)
    for (const userId of members) hub.toUser(userId, { type: 'access.changed' })
    return reply.status(204).send()
  })

  app.put(`${v1}/teams/:id/members`, async (req, reply) => {
    requireAdmin(req)
    const { id } = z.object({ id: IdSchema }).parse(req.params)
    const { userId } = MemberBody.parse(req.body)
    await addTeamMember(db, id, userId)
    const user = await principalTarget(db, { kind: 'user', id: userId })
    await recordAudit(
      db,
      req.user,
      'team.member.add',
      await principalTarget(db, { kind: 'team', id }),
      {
        userId,
        email: user.name
      }
    )
    hub.toUser(userId, { type: 'access.changed' })
    return reply.status(204).send()
  })

  app.delete(`${v1}/teams/:id/members/:userId`, async (req, reply) => {
    requireAdmin(req)
    const { id, userId } = z.object({ id: IdSchema, userId: IdSchema }).parse(req.params)
    if (!(await removeTeamMember(db, id, userId))) throw notFound('Member')
    const user = await principalTarget(db, { kind: 'user', id: userId })
    await recordAudit(
      db,
      req.user,
      'team.member.remove',
      await principalTarget(db, { kind: 'team', id }),
      { userId, email: user.name }
    )
    hub.toUser(userId, { type: 'access.changed' })
    return reply.status(204).send()
  })
}
