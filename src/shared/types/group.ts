import { z } from 'zod'
import { IdSchema, IsoDateSchema } from './client'

export const GroupSchema = z.object({
  id: IdSchema,
  environmentId: IdSchema,
  name: z.string().min(1),
  notes: z.string().nullable(),
  sortOrder: z.number().int(),
  createdAt: IsoDateSchema,
  updatedAt: IsoDateSchema
})

export type Group = z.infer<typeof GroupSchema>

export const CreateGroupInputSchema = z.object({
  environmentId: IdSchema,
  name: z.string().min(1),
  notes: z.string().nullable().optional(),
  sortOrder: z.number().int().optional()
})

export type CreateGroupInput = z.infer<typeof CreateGroupInputSchema>

export const UpdateGroupInputSchema = z.object({
  name: z.string().min(1).optional(),
  notes: z.string().nullable().optional(),
  sortOrder: z.number().int().optional()
})

export type UpdateGroupInput = z.infer<typeof UpdateGroupInputSchema>
