import {
  CreateAccessInputSchema,
  CreateClientInputSchema,
  CreateConnectionInputSchema,
  CreateEnvironmentInputSchema,
  CreateGroupInputSchema,
  CreateTagInputSchema,
  IdSchema,
  ListAccessesFilterSchema,
  UpdateAccessInputSchema,
  UpdateClientInputSchema,
  UpdateConnectionInputSchema,
  UpdateEnvironmentInputSchema,
  UpdateGroupInputSchema,
  UpdateTagInputSchema
} from '@shared/types'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { loadAccess } from '../access'
import type { Db } from '../db'
import { forbidden, notFound, orNotFound } from '../errors'
import * as accesses from '../store/accesses'
import { recordAudit } from '../store/audit'
import * as store from '../store/inventory'
import { copySecret } from '../store/secrets'
import * as vpns from '../store/vpns'

const IdParams = z.object({ id: IdSchema })
const id = (request: FastifyRequest): string => IdParams.parse(request.params).id

const ConnectionsQuery = z.object({
  groupId: IdSchema.optional(),
  environmentId: IdSchema.optional(),
  clientId: IdSchema.optional(),
  tagId: IdSchema.optional(),
  isFavorite: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional()
})

const SetTagsSchema = z.object({ tagIds: z.array(IdSchema) })

/** Clients and environments may name the organization VPN their sessions bring up. */
const VpnLinkBody = z.object({ vpnId: IdSchema.nullable().optional() })

const AccessesQuery = z.object({
  groupId: IdSchema.optional(),
  environmentId: IdSchema.optional(),
  clientId: IdSchema.optional(),
  tagId: IdSchema.optional(),
  type: ListAccessesFilterSchema.shape.type,
  isFavorite: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional()
})

async function noContent(deleted: boolean, what: string, reply: FastifyReply): Promise<void> {
  if (!deleted) throw notFound(what)
  await reply.status(204).send()
}

export function registerInventoryRoutes(
  app: FastifyInstance,
  db: Db,
  masterKey: Buffer | null
): void {
  const v1 = '/api/v1'
  const access = (req: FastifyRequest) => loadAccess(db, req.user)

  /** The connection the user can use, or 404, plus a write check when asked. */
  async function connectionFor(req: FastifyRequest, need: 'read' | 'write') {
    const view = await access(req)
    const conn = orNotFound(await store.getConnection(db, req.user.id, id(req)), 'Connection')
    view.requireConnection(conn.id, need)
    return { view, conn }
  }

  async function accessFor(req: FastifyRequest, need: 'read' | 'write') {
    const view = await access(req)
    const item = orNotFound(await accesses.getAccess(db, req.user.id, id(req)), 'Access')
    view.requireAccess(item.id, need)
    return { view, item }
  }

  // clients
  app.get(`${v1}/clients`, async (req) => {
    const view = await access(req)
    return (await store.listClients(db)).filter((c) => view.canRead('client', c.id))
  })
  app.post(`${v1}/clients`, async (req, reply) => {
    const input = { ...CreateClientInputSchema.parse(req.body), ...VpnLinkBody.parse(req.body) }
    if (!(await access(req)).isAdmin) throw forbidden('Only admins can add clients')
    return reply.status(201).send(await store.createClient(db, input))
  })
  app.get(`${v1}/clients/:id`, async (req) => {
    ;(await access(req)).require('client', id(req), 'read')
    return orNotFound(await store.getClient(db, id(req)), 'Client')
  })
  app.patch(`${v1}/clients/:id`, async (req) => {
    ;(await access(req)).require('client', id(req), 'write')
    return orNotFound(
      await store.updateClient(db, id(req), {
        ...UpdateClientInputSchema.parse(req.body),
        ...VpnLinkBody.parse(req.body)
      }),
      'Client'
    )
  })
  app.delete(`${v1}/clients/:id`, async (req, reply) => {
    ;(await access(req)).require('client', id(req), 'write')
    return noContent(await store.deleteClient(db, id(req)), 'Client', reply)
  })

  // environments
  app.get(`${v1}/environments`, async (req) => {
    const view = await access(req)
    const { clientId } = z.object({ clientId: IdSchema.optional() }).parse(req.query)
    return (await store.listEnvironments(db, clientId)).filter((e) =>
      view.canRead('environment', e.id)
    )
  })
  app.post(`${v1}/environments`, async (req, reply) => {
    const input = {
      ...CreateEnvironmentInputSchema.parse(req.body),
      ...VpnLinkBody.parse(req.body)
    }
    ;(await access(req)).require('client', input.clientId, 'write')
    return reply.status(201).send(await store.createEnvironment(db, input))
  })
  app.get(`${v1}/environments/:id`, async (req) => {
    ;(await access(req)).require('environment', id(req), 'read')
    return orNotFound(await store.getEnvironment(db, id(req)), 'Environment')
  })
  app.patch(`${v1}/environments/:id`, async (req) => {
    ;(await access(req)).require('environment', id(req), 'write')
    return orNotFound(
      await store.updateEnvironment(db, id(req), {
        ...UpdateEnvironmentInputSchema.parse(req.body),
        ...VpnLinkBody.parse(req.body)
      }),
      'Environment'
    )
  })
  app.delete(`${v1}/environments/:id`, async (req, reply) => {
    ;(await access(req)).require('environment', id(req), 'write')
    return noContent(await store.deleteEnvironment(db, id(req)), 'Environment', reply)
  })

  // groups
  app.get(`${v1}/groups`, async (req) => {
    const view = await access(req)
    const { environmentId } = z.object({ environmentId: IdSchema.optional() }).parse(req.query)
    return (await store.listGroups(db, environmentId)).filter((g) => view.canRead('group', g.id))
  })
  app.post(`${v1}/groups`, async (req, reply) => {
    const input = CreateGroupInputSchema.parse(req.body)
    ;(await access(req)).require('environment', input.environmentId, 'write')
    return reply.status(201).send(await store.createGroup(db, input))
  })
  app.get(`${v1}/groups/:id`, async (req) => {
    ;(await access(req)).require('group', id(req), 'read')
    return orNotFound(await store.getGroup(db, id(req)), 'Group')
  })
  app.patch(`${v1}/groups/:id`, async (req) => {
    ;(await access(req)).require('group', id(req), 'write')
    return orNotFound(
      await store.updateGroup(db, id(req), UpdateGroupInputSchema.parse(req.body)),
      'Group'
    )
  })
  app.delete(`${v1}/groups/:id`, async (req, reply) => {
    ;(await access(req)).require('group', id(req), 'write')
    return noContent(await store.deleteGroup(db, id(req)), 'Group', reply)
  })

  // connections
  app.get(`${v1}/connections`, async (req) => {
    const view = await access(req)
    const rows = await store.listConnections(db, req.user.id, ConnectionsQuery.parse(req.query))
    return rows.filter((c) => view.canRead('connection', c.id))
  })
  app.post(`${v1}/connections`, async (req, reply) => {
    const input = CreateConnectionInputSchema.parse(req.body)
    ;(await access(req)).require('group', input.groupId, 'write')
    return reply.status(201).send(await store.createConnection(db, req.user.id, input))
  })
  app.get(`${v1}/connections/:id`, async (req) => (await connectionFor(req, 'read')).conn)
  app.patch(`${v1}/connections/:id`, async (req) => {
    const { view } = await connectionFor(req, 'write')
    const input = UpdateConnectionInputSchema.parse(req.body)
    if (input.groupId) view.require('group', input.groupId, 'write')
    return orNotFound(await store.updateConnection(db, req.user.id, id(req), input), 'Connection')
  })
  app.delete(`${v1}/connections/:id`, async (req, reply) => {
    await connectionFor(req, 'write')
    return noContent(await store.deleteConnection(db, id(req)), 'Connection', reply)
  })
  // Favorites are personal, so viewers may toggle them.
  app.post(`${v1}/connections/:id/favorite`, async (req) => {
    await connectionFor(req, 'read')
    return orNotFound(await store.toggleFavorite(db, req.user.id, id(req)), 'Connection')
  })
  app.post(`${v1}/connections/:id/duplicate`, async (req, reply) => {
    // The copy is a new connection in the same group, so it needs the group.
    const { view, conn } = await connectionFor(req, 'write')
    view.require('group', conn.groupId, 'write')
    return reply.status(201).send(
      orNotFound(
        await store.duplicateConnection(db, req.user.id, id(req), async (ref) => {
          const copy = await copySecret(db, masterKey, req.user.id, ref)
          if (copy) {
            await recordAudit(
              db,
              req.user,
              'secret.create',
              { type: 'secret', id: copy },
              {
                copiedFrom: ref
              }
            )
          }
          return copy
        }),
        'Connection'
      )
    )
  })
  app.get(`${v1}/connections/:id/tags`, async (req) => {
    await connectionFor(req, 'read')
    return store.listTagsForConnection(db, id(req))
  })
  app.put(`${v1}/connections/:id/tags`, async (req) => {
    await connectionFor(req, 'write')
    return store.setTagsForConnection(db, id(req), SetTagsSchema.parse(req.body).tagIds)
  })

  // accesses (database, login/web portal, other): same rules as connections
  app.get(`${v1}/accesses`, async (req) => {
    const view = await access(req)
    const rows = await accesses.listAccesses(db, req.user.id, AccessesQuery.parse(req.query))
    return rows.filter((a) => view.canRead('access', a.id))
  })
  app.post(`${v1}/accesses`, async (req, reply) => {
    const input = CreateAccessInputSchema.parse(req.body)
    ;(await access(req)).require('group', input.groupId, 'write')
    return reply.status(201).send(await accesses.createAccess(db, req.user.id, input))
  })
  app.get(`${v1}/accesses/:id`, async (req) => (await accessFor(req, 'read')).item)
  app.patch(`${v1}/accesses/:id`, async (req) => {
    const { view } = await accessFor(req, 'write')
    const input = UpdateAccessInputSchema.parse(req.body)
    if (input.groupId) view.require('group', input.groupId, 'write')
    return orNotFound(await accesses.updateAccess(db, req.user.id, id(req), input), 'Access')
  })
  app.delete(`${v1}/accesses/:id`, async (req, reply) => {
    await accessFor(req, 'write')
    return noContent(await accesses.deleteAccess(db, id(req)), 'Access', reply)
  })
  app.post(`${v1}/accesses/:id/favorite`, async (req) => {
    await accessFor(req, 'read')
    return orNotFound(await accesses.toggleAccessFavorite(db, req.user.id, id(req)), 'Access')
  })
  app.get(`${v1}/accesses/:id/tags`, async (req) => {
    await accessFor(req, 'read')
    return accesses.listTagsForAccess(db, id(req))
  })
  app.put(`${v1}/accesses/:id/tags`, async (req) => {
    await accessFor(req, 'write')
    return accesses.setTagsForAccess(db, id(req), SetTagsSchema.parse(req.body).tagIds)
  })

  // VPN templates: gateway settings only, never a login. Everyone sees the VPNs
  // of what they can open; editors may publish one, only admins change or remove it.
  app.get(`${v1}/vpns`, async (req) => {
    const view = await access(req)
    const all = await vpns.listVpns(db)
    if (view.isAdmin) return all
    const visible = new Set(
      (await vpns.vpnUses(db)).filter((u) => view.canRead(u.type, u.id)).map((u) => u.vpnId)
    )
    return all.filter((v) => visible.has(v.id))
  })
  app.get(`${v1}/vpns/:id`, async (req) => {
    const view = await access(req)
    const vpn = orNotFound(await vpns.getVpn(db, id(req)), 'VPN')
    if (
      !view.isAdmin &&
      !(await vpns.vpnUses(db)).some((u) => u.vpnId === vpn.id && view.canRead(u.type, u.id))
    ) {
      throw notFound('VPN')
    }
    return vpn
  })
  app.post(`${v1}/vpns`, async (req, reply) => {
    const input = vpns.CreateVpnTemplateSchema.parse(req.body)
    if (!(await access(req)).editsSomething) throw forbidden('You can only view this organization')
    const vpn = await vpns.createVpn(db, req.user.id, input)
    await recordAudit(db, req.user, 'vpn.create', { type: 'vpn', id: vpn.id, name: vpn.name })
    return reply.status(201).send(vpn)
  })
  app.patch(`${v1}/vpns/:id`, async (req) => {
    if (req.user.role !== 'admin') throw forbidden()
    const input = vpns.UpdateVpnTemplateSchema.parse(req.body)
    const vpn = orNotFound(await vpns.updateVpn(db, id(req), input), 'VPN')
    await recordAudit(db, req.user, 'vpn.update', { type: 'vpn', id: vpn.id, name: vpn.name })
    return vpn
  })
  app.delete(`${v1}/vpns/:id`, async (req, reply) => {
    if (req.user.role !== 'admin') throw forbidden()
    const vpn = orNotFound(await vpns.getVpn(db, id(req)), 'VPN')
    await vpns.deleteVpn(db, vpn.id)
    await recordAudit(db, req.user, 'vpn.delete', { type: 'vpn', id: vpn.id, name: vpn.name })
    return reply.status(204).send()
  })

  // tags: shared labels; any editor adds one, only admins rename or remove them
  app.get(`${v1}/tags`, () => store.listTags(db))
  app.post(`${v1}/tags`, async (req, reply) => {
    if (!(await access(req)).editsSomething) throw forbidden('You can only view this organization')
    return reply.status(201).send(await store.createTag(db, CreateTagInputSchema.parse(req.body)))
  })
  app.patch(`${v1}/tags/:id`, async (req) => {
    if (req.user.role !== 'admin') throw forbidden()
    return orNotFound(
      await store.updateTag(db, id(req), UpdateTagInputSchema.parse(req.body)),
      'Tag'
    )
  })
  app.delete(`${v1}/tags/:id`, async (req, reply) => {
    if (req.user.role !== 'admin') throw forbidden()
    return noContent(await store.deleteTag(db, id(req)), 'Tag', reply)
  })
}
