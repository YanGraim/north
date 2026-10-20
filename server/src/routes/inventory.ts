import {
  CreateClientInputSchema,
  CreateConnectionInputSchema,
  CreateEnvironmentInputSchema,
  CreateGroupInputSchema,
  CreateTagInputSchema,
  IdSchema,
  UpdateClientInputSchema,
  UpdateConnectionInputSchema,
  UpdateEnvironmentInputSchema,
  UpdateGroupInputSchema,
  UpdateTagInputSchema
} from '@shared/types'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import type { Db } from '../db'
import { notFound, orNotFound } from '../errors'
import * as store from '../store/inventory'

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

async function noContent(deleted: boolean, what: string, reply: FastifyReply): Promise<void> {
  if (!deleted) throw notFound(what)
  await reply.status(204).send()
}

export function registerInventoryRoutes(app: FastifyInstance, db: Db): void {
  const v1 = '/api/v1'

  // clients
  app.get(`${v1}/clients`, () => store.listClients(db))
  app.post(`${v1}/clients`, async (req, reply) =>
    reply.status(201).send(await store.createClient(db, CreateClientInputSchema.parse(req.body)))
  )
  app.get(`${v1}/clients/:id`, async (req) =>
    orNotFound(await store.getClient(db, id(req)), 'Client')
  )
  app.patch(`${v1}/clients/:id`, async (req) =>
    orNotFound(
      await store.updateClient(db, id(req), UpdateClientInputSchema.parse(req.body)),
      'Client'
    )
  )
  app.delete(`${v1}/clients/:id`, async (req, reply) =>
    noContent(await store.deleteClient(db, id(req)), 'Client', reply)
  )

  // environments
  app.get(`${v1}/environments`, (req) =>
    store.listEnvironments(
      db,
      z.object({ clientId: IdSchema.optional() }).parse(req.query).clientId
    )
  )
  app.post(`${v1}/environments`, async (req, reply) =>
    reply
      .status(201)
      .send(await store.createEnvironment(db, CreateEnvironmentInputSchema.parse(req.body)))
  )
  app.get(`${v1}/environments/:id`, async (req) =>
    orNotFound(await store.getEnvironment(db, id(req)), 'Environment')
  )
  app.patch(`${v1}/environments/:id`, async (req) =>
    orNotFound(
      await store.updateEnvironment(db, id(req), UpdateEnvironmentInputSchema.parse(req.body)),
      'Environment'
    )
  )
  app.delete(`${v1}/environments/:id`, async (req, reply) =>
    noContent(await store.deleteEnvironment(db, id(req)), 'Environment', reply)
  )

  // groups
  app.get(`${v1}/groups`, (req) =>
    store.listGroups(
      db,
      z.object({ environmentId: IdSchema.optional() }).parse(req.query).environmentId
    )
  )
  app.post(`${v1}/groups`, async (req, reply) =>
    reply.status(201).send(await store.createGroup(db, CreateGroupInputSchema.parse(req.body)))
  )
  app.get(`${v1}/groups/:id`, async (req) => orNotFound(await store.getGroup(db, id(req)), 'Group'))
  app.patch(`${v1}/groups/:id`, async (req) =>
    orNotFound(
      await store.updateGroup(db, id(req), UpdateGroupInputSchema.parse(req.body)),
      'Group'
    )
  )
  app.delete(`${v1}/groups/:id`, async (req, reply) =>
    noContent(await store.deleteGroup(db, id(req)), 'Group', reply)
  )

  // connections
  app.get(`${v1}/connections`, (req) =>
    store.listConnections(db, req.user.id, ConnectionsQuery.parse(req.query))
  )
  app.post(`${v1}/connections`, async (req, reply) =>
    reply
      .status(201)
      .send(
        await store.createConnection(db, req.user.id, CreateConnectionInputSchema.parse(req.body))
      )
  )
  app.get(`${v1}/connections/:id`, async (req) =>
    orNotFound(await store.getConnection(db, req.user.id, id(req)), 'Connection')
  )
  app.patch(`${v1}/connections/:id`, async (req) =>
    orNotFound(
      await store.updateConnection(
        db,
        req.user.id,
        id(req),
        UpdateConnectionInputSchema.parse(req.body)
      ),
      'Connection'
    )
  )
  app.delete(`${v1}/connections/:id`, async (req, reply) =>
    noContent(await store.deleteConnection(db, id(req)), 'Connection', reply)
  )
  app.post(`${v1}/connections/:id/favorite`, async (req) =>
    orNotFound(await store.toggleFavorite(db, req.user.id, id(req)), 'Connection')
  )
  app.post(`${v1}/connections/:id/duplicate`, async (req, reply) =>
    reply
      .status(201)
      .send(orNotFound(await store.duplicateConnection(db, req.user.id, id(req)), 'Connection'))
  )
  app.get(`${v1}/connections/:id/tags`, async (req) => {
    orNotFound(await store.getConnection(db, req.user.id, id(req)), 'Connection')
    return store.listTagsForConnection(db, id(req))
  })
  app.put(`${v1}/connections/:id/tags`, async (req) =>
    store.setTagsForConnection(db, id(req), SetTagsSchema.parse(req.body).tagIds)
  )

  // tags
  app.get(`${v1}/tags`, () => store.listTags(db))
  app.post(`${v1}/tags`, async (req, reply) =>
    reply.status(201).send(await store.createTag(db, CreateTagInputSchema.parse(req.body)))
  )
  app.patch(`${v1}/tags/:id`, async (req) =>
    orNotFound(await store.updateTag(db, id(req), UpdateTagInputSchema.parse(req.body)), 'Tag')
  )
  app.delete(`${v1}/tags/:id`, async (req, reply) =>
    noContent(await store.deleteTag(db, id(req)), 'Tag', reply)
  )
}
