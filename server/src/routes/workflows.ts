import {
  CreateEnvironmentUpdateInputSchema,
  CreateGroupVariableInputSchema,
  CreateWorkflowInputSchema,
  IdSchema,
  UpdateGroupVariableInputSchema,
  UpdateWorkflowInputSchema
} from '@shared/types'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { type AccessView, loadAccess } from '../access'
import type { Db } from '../db'
import { ApiError, notFound, orNotFound } from '../errors'
import * as store from '../store/workflows'

const IdParams = z.object({ id: IdSchema })
const id = (request: FastifyRequest): string => IdParams.parse(request.params).id
const GroupQuery = z.object({ groupId: IdSchema })
const UpdatesQuery = z.object({
  environmentId: IdSchema.optional(),
  limit: z.coerce.number().int().positive().max(500).default(100)
})

/**
 * Workflows, group variables and environment updates (REC-024). They follow
 * their group: whoever has the group (or something above it) sees and runs
 * its workflows, editors change them. Being only on the way to a single
 * connection does not show the group's workflows.
 */
export function registerWorkflowRoutes(app: FastifyInstance, db: Db): void {
  const v1 = '/api/v1'
  const access = (req: FastifyRequest) => loadAccess(db, req.user)

  function requireGroup(view: AccessView, groupId: string, need: 'read' | 'write'): void {
    if (!view.canUse('group', groupId)) throw notFound('Group')
    if (need === 'write') view.require('group', groupId, 'write')
  }

  async function workflowFor(req: FastifyRequest, need: 'read' | 'write') {
    const view = await access(req)
    const workflow = orNotFound(await store.getWorkflow(db, id(req)), 'Workflow')
    if (!view.canUse('group', workflow.groupId)) throw notFound('Workflow')
    if (need === 'write') view.require('group', workflow.groupId, 'write')
    return { view, workflow }
  }

  async function variableFor(req: FastifyRequest) {
    const view = await access(req)
    const variable = orNotFound(await store.getVariable(db, id(req)), 'Variable')
    if (!view.canUse('group', variable.groupId)) throw notFound('Variable')
    view.require('group', variable.groupId, 'write')
    return variable
  }

  const noContent = async (deleted: boolean, what: string, reply: FastifyReply) => {
    if (!deleted) throw notFound(what)
    await reply.status(204).send()
  }

  app.get(`${v1}/workflows`, async (req) => {
    const { groupId } = GroupQuery.parse(req.query)
    requireGroup(await access(req), groupId, 'read')
    return store.listWorkflows(db, groupId)
  })
  app.post(`${v1}/workflows`, async (req, reply) => {
    const input = CreateWorkflowInputSchema.parse(req.body)
    requireGroup(await access(req), input.groupId, 'write')
    return reply.status(201).send(await store.createWorkflow(db, input))
  })
  app.get(`${v1}/workflows/:id`, async (req) => (await workflowFor(req, 'read')).workflow)
  app.patch(`${v1}/workflows/:id`, async (req) => {
    const { view } = await workflowFor(req, 'write')
    const input = UpdateWorkflowInputSchema.parse(req.body)
    if (input.groupId) requireGroup(view, input.groupId, 'write')
    return orNotFound(await store.updateWorkflow(db, id(req), input), 'Workflow')
  })
  app.delete(`${v1}/workflows/:id`, async (req, reply) => {
    await workflowFor(req, 'write')
    return noContent(await store.deleteWorkflow(db, id(req)), 'Workflow', reply)
  })

  app.get(`${v1}/group-variables`, async (req) => {
    const { groupId } = GroupQuery.parse(req.query)
    requireGroup(await access(req), groupId, 'read')
    return store.listVariables(db, groupId)
  })
  app.post(`${v1}/group-variables`, async (req, reply) => {
    const input = CreateGroupVariableInputSchema.parse(req.body)
    requireGroup(await access(req), input.groupId, 'write')
    return reply.status(201).send(await store.createVariable(db, input))
  })
  app.patch(`${v1}/group-variables/:id`, async (req) => {
    await variableFor(req)
    const input = UpdateGroupVariableInputSchema.parse(req.body)
    return orNotFound(await store.updateVariable(db, id(req), input), 'Variable')
  })
  app.delete(`${v1}/group-variables/:id`, async (req, reply) => {
    await variableFor(req)
    return noContent(await store.deleteVariable(db, id(req)), 'Variable', reply)
  })

  // Updates are shown to whoever can see the connection that was updated.
  app.get(`${v1}/environment-updates`, async (req) => {
    const view = await access(req)
    const query = UpdatesQuery.parse(req.query)
    if (query.environmentId && !view.canRead('environment', query.environmentId)) {
      throw notFound('Environment')
    }
    // Read a little more than asked, so hidden rows do not shorten the list much.
    const rows = await store.listUpdates(db, {
      environmentId: query.environmentId,
      limit: view.isAdmin ? query.limit : query.limit * 3
    })
    return rows.filter((u) => view.canRead('connection', u.connectionId)).slice(0, query.limit)
  })
  // Whoever may run the workflow records what it changed, signed with their user.
  app.post(`${v1}/environment-updates`, async (req, reply) => {
    const view = await access(req)
    const input = CreateEnvironmentUpdateInputSchema.parse(req.body)
    const workflow = orNotFound(await store.getWorkflow(db, input.workflowId), 'Workflow')
    if (!view.canUse('group', workflow.groupId)) throw notFound('Workflow')
    view.requireConnection(input.connectionId, 'read')
    const { rows } = await db.query<{ environment_id: string }>(
      'SELECT g.environment_id FROM connections c INNER JOIN groups g ON g.id = c.group_id WHERE c.id = $1',
      [input.connectionId]
    )
    if (rows[0]?.environment_id !== input.environmentId) {
      throw new ApiError('validation', 'The connection is not in this environment')
    }
    return reply.status(201).send(await store.createUpdate(db, req.user.id, input))
  })
}
