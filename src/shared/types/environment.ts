import { z } from 'zod'
import { IdSchema, IsoDateSchema } from './client'

export const EnvironmentSchema = z.object({
  id: IdSchema,
  clientId: IdSchema,
  name: z.string().min(1),
  notes: z.string().nullable(),
  color: z.string().nullable(),
  sortOrder: z.number().int(),
  createdAt: IsoDateSchema,
  updatedAt: IsoDateSchema
})

export type Environment = z.infer<typeof EnvironmentSchema>

export const CreateEnvironmentInputSchema = z.object({
  clientId: IdSchema,
  name: z.string().min(1),
  notes: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  sortOrder: z.number().int().optional()
})

export type CreateEnvironmentInput = z.infer<typeof CreateEnvironmentInputSchema>

export const UpdateEnvironmentInputSchema = z.object({
  name: z.string().min(1).optional(),
  notes: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  sortOrder: z.number().int().optional()
})

export type UpdateEnvironmentInput = z.infer<typeof UpdateEnvironmentInputSchema>
