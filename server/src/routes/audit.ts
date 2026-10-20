import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { Db } from '../db'
import { forbidden } from '../errors'
import { listAudit } from '../store/audit'

const AuditQuery = z.object({ limit: z.coerce.number().int().min(1).max(500).default(100) })

export function registerAuditRoutes(app: FastifyInstance, db: Db): void {
  app.get('/api/v1/audit', async (req) => {
    if (req.user.role !== 'admin') throw forbidden()
    return listAudit(db, AuditQuery.parse(req.query).limit)
  })
}
