import { z } from 'zod'

export const LogFollowErrorCodeSchema = z.enum([
  'HOST_KEY_REJECTED',
  'AUTH_FAILED',
  'TAIL_MISSING',
  'TAIL_EXITED',
  'PATH_UNRESOLVED',
  'CONNECTION_LOST',
  'LIMIT',
  'NOT_FOUND',
  'NOT_SSH',
  'INVALID_PATH'
])

export type LogFollowErrorCode = z.infer<typeof LogFollowErrorCodeSchema>

export const LogFollowStateSchema = z.enum([
  'connecting',
  'awaiting-host-key',
  'live',
  'error',
  'closed'
])

export type LogFollowState = z.infer<typeof LogFollowStateSchema>

export const LogFollowSnapshotSchema = z.object({
  id: z.string().uuid(),
  connectionId: z.string().uuid(),
  logFileId: z.string().uuid().nullable(),
  ephemeral: z.boolean(),
  connectionName: z.string(),
  label: z.string().nullable(),
  path: z.string(),
  placement: z.enum(['dock', 'window']),
  state: LogFollowStateSchema,
  errorCode: LogFollowErrorCodeSchema.nullable(),
  runId: z.number().int().nonnegative(),
  focusNonce: z.number().int().nonnegative()
})

export type LogFollowSnapshot = z.infer<typeof LogFollowSnapshotSchema>

const LogFollowStartByIdSchema = z.strictObject({
  connectionId: z.string().uuid(),
  logFileId: z.string().uuid()
})

const LogFollowStartByPathSchema = z.strictObject({
  connectionId: z.string().uuid(),
  path: z.string()
})

/** Saved file id, or a path that is not written onto the connection. Not both. */
export const LogFollowStartInputSchema = z.union([
  LogFollowStartByIdSchema,
  LogFollowStartByPathSchema
])

export type LogFollowStartInput = z.infer<typeof LogFollowStartInputSchema>

export const LogFollowStartResultSchema = z.discriminatedUnion('ok', [
  z.object({
    ok: z.literal(true),
    snapshot: LogFollowSnapshotSchema,
    alreadyOpen: z.boolean()
  }),
  z.object({
    ok: z.literal(false),
    code: LogFollowErrorCodeSchema
  })
])

export type LogFollowStartResult = z.infer<typeof LogFollowStartResultSchema>

/** One chunk of tail output. `seq` increases by one per chunk for a follow. */
export type LogFollowChunk = {
  followId: string
  seq: number
  data: number[]
}

/** Bytes already seen, so a viewer can paint history and then only newer chunks. */
export type LogFollowReplay = {
  seq: number
  data: number[]
}

export const LogFollowPortMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('data'),
    data: z.array(z.number().int().min(0).max(255))
  }),
  z.object({ type: z.literal('state'), state: LogFollowStateSchema }),
  z.object({ type: z.literal('error'), code: LogFollowErrorCodeSchema }),
  z.object({ type: z.literal('reset') })
])

export type LogFollowPortMessage = z.infer<typeof LogFollowPortMessageSchema>
