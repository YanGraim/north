import { z } from 'zod'
import { IdSchema, IsoDateSchema } from './client'

export const ConnectionHealthStatusSchema = z.enum(['up', 'down'])
export type ConnectionHealthStatus = z.infer<typeof ConnectionHealthStatusSchema>

/** 1:1 monitoring state per connection — opt-in, off by default. */
export const ConnectionMonitorSchema = z.object({
  connectionId: IdSchema,
  enabled: z.boolean(),
  lastStatus: ConnectionHealthStatusSchema.nullable(),
  lastCheckedAt: IsoDateSchema.nullable()
})
export type ConnectionMonitor = z.infer<typeof ConnectionMonitorSchema>

/** Recorded only on a status *transition* (up→down / down→up), not every poll. */
export const ConnectionHealthEventSchema = z.object({
  id: IdSchema,
  connectionId: IdSchema,
  previousStatus: ConnectionHealthStatusSchema.nullable(),
  newStatus: ConnectionHealthStatusSchema,
  occurredAt: IsoDateSchema,
  latencyMs: z.number().int().nonnegative().nullable(),
  errorMessage: z.string().nullable()
})
export type ConnectionHealthEvent = z.infer<typeof ConnectionHealthEventSchema>
