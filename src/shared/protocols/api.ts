import { z } from 'zod'
import { ApiHttpMethodSchema, ApiRequestDefinitionSchema } from '../types/api'

export const API_MAX_RESPONSE_BYTES = 1_000_000

export const ApiErrorKindSchema = z.enum([
  'invalid-url',
  'dns',
  'tls',
  'timeout',
  'network',
  'aborted'
])
export type ApiErrorKind = z.infer<typeof ApiErrorKindSchema>

export const ApiHeaderSchema = z.object({
  key: z.string(),
  value: z.string()
})
export type ApiHeader = z.infer<typeof ApiHeaderSchema>

export const ApiSendInputSchema = z.object({
  sessionId: z.string().uuid().optional(),
  requestId: z.string().uuid(),
  method: ApiHttpMethodSchema,
  url: z.string(),
  definition: ApiRequestDefinitionSchema,
  environmentAccessId: z.string().uuid(),
  persistedRequestId: z.string().uuid().nullable().optional(),
  collectionId: z.string().uuid().optional()
})
export type ApiSendInput = z.infer<typeof ApiSendInputSchema>

export const ApiSendResultSchema = z.object({
  requestId: z.string().uuid(),
  status: z.number().int().nullable(),
  statusText: z.string(),
  headers: z.array(ApiHeaderSchema),
  bodyText: z.string(),
  truncated: z.boolean(),
  durationMs: z.number().nonnegative(),
  sizeBytes: z.number().int().nonnegative(),
  errorKind: ApiErrorKindSchema.nullable(),
  errorMessage: z.string().nullable(),
  echoed: z.object({
    method: ApiHttpMethodSchema,
    url: z.string(),
    headers: z.array(ApiHeaderSchema)
  })
})
export type ApiSendResult = z.infer<typeof ApiSendResultSchema>

export const ApiCancelInputSchema = z.object({
  sessionId: z.string().uuid().optional(),
  requestId: z.string().uuid()
})
export type ApiCancelInput = z.infer<typeof ApiCancelInputSchema>

export const ApiHistoryListInputSchema = z.object({
  accessId: z.string().uuid(),
  limit: z.number().int().positive().max(200).optional()
})
export type ApiHistoryListInput = z.infer<typeof ApiHistoryListInputSchema>
