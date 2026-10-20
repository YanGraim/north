import { IdSchema } from '@shared/types'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import type { Db } from '../db'
import { notFound } from '../errors'
import { recordAudit } from '../store/audit'
import * as secrets from '../store/secrets'

const IdParams = z.object({ id: IdSchema })
const id = (request: FastifyRequest): string => IdParams.parse(request.params).id

const SecretBody = z.object({
  value: z
    .string()
    .min(1)
    .max(64 * 1024)
})

/** Why the desktop needs the plaintext; every read is audited (ADR 0018 §8). */
const RevealBody = z.object({ purpose: z.enum(['session', 'reveal', 'paste']) })

/**
 * Secrets go up as plaintext and come back only by id. The one way out is
 * `reveal`, and only for a secret some connection uses.
 */
export function registerSecretRoutes(app: FastifyInstance, db: Db, masterKey: Buffer | null): void {
  const v1 = '/api/v1'

  app.post(`${v1}/secrets`, async (req, reply) => {
    const { value } = SecretBody.parse(req.body)
    const secretId = await secrets.createSecret(db, masterKey, req.user.id, value)
    await recordAudit(db, req.user, 'secret.create', { type: 'secret', id: secretId })
    return reply.status(201).send({ id: secretId })
  })

  app.get(`${v1}/secrets/:id`, async (req) => {
    if (!(await secrets.secretExists(db, id(req)))) throw notFound('Secret')
    return { id: id(req) }
  })

  app.put(`${v1}/secrets/:id`, async (req, reply) => {
    const { value } = SecretBody.parse(req.body)
    if (!(await secrets.replaceSecret(db, masterKey, id(req), value))) throw notFound('Secret')
    await recordAudit(db, req.user, 'secret.write', { type: 'secret', id: id(req) })
    return reply.status(204).send()
  })

  app.delete(`${v1}/secrets/:id`, async (req, reply) => {
    if (!(await secrets.deleteSecret(db, id(req)))) throw notFound('Secret')
    await recordAudit(db, req.user, 'secret.delete', { type: 'secret', id: id(req) })
    return reply.status(204).send()
  })

  app.post(`${v1}/secrets/:id/reveal`, async (req) => {
    const { purpose } = RevealBody.parse(req.body)
    const found = await secrets.readConnectionSecret(db, masterKey, id(req))
    if (!found) throw notFound('Secret')
    await recordAudit(
      db,
      req.user,
      'secret.read',
      { type: 'connection', id: found.connection.id, name: found.connection.name },
      { purpose, secretId: id(req) }
    )
    return { value: found.value }
  })
}
