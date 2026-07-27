import { z } from 'zod'
import { IdSchema, IsoDateSchema } from './client'

export const ConnectionHistoryEntrySchema = z.object({
  id: IdSchema,
  connectionId: IdSchema,
  connectedAt: IsoDateSchema,
  durationMs: z.number().int().nonnegative().nullable(),
  success: z.boolean(),
  errorMessage: z.string().nullable()
})

export type ConnectionHistoryEntry = z.infer<typeof ConnectionHistoryEntrySchema>

export const RecordConnectionInputSchema = z.object({
  connectionId: IdSchema,
  connectedAt: IsoDateSchema.optional(),
  durationMs: z.number().int().nonnegative().nullable().optional(),
  success: z.boolean(),
  errorMessage: z.string().nullable().optional()
})

export type RecordConnectionInput = z.infer<typeof RecordConnectionInputSchema>

export const ListHistoryFilterSchema = z.object({
  connectionId: IdSchema.optional(),
  limit: z.number().int().positive().max(500).optional()
})

export type ListHistoryFilter = z.infer<typeof ListHistoryFilterSchema>
