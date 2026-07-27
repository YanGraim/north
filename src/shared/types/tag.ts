import { z } from 'zod'
import { IdSchema } from './client'

export const TagSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  color: z.string().nullable()
})

export type Tag = z.infer<typeof TagSchema>

export const CreateTagInputSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  color: z.string().nullable().optional()
})

export type CreateTagInput = z.infer<typeof CreateTagInputSchema>

export const UpdateTagInputSchema = CreateTagInputSchema.partial()

export type UpdateTagInput = z.infer<typeof UpdateTagInputSchema>

export const SetConnectionTagsInputSchema = z.object({
  connectionId: IdSchema,
  tagIds: z.array(IdSchema)
})

export type SetConnectionTagsInput = z.infer<typeof SetConnectionTagsInputSchema>

export const SetAccessTagsInputSchema = z.object({
  accessId: IdSchema,
  tagIds: z.array(IdSchema)
})

export type SetAccessTagsInput = z.infer<typeof SetAccessTagsInputSchema>
