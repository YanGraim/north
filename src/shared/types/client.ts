import { z } from 'zod'

export const IsoDateSchema = z.string().datetime({ offset: true }).or(z.string().min(1))

export const IdSchema = z.string().uuid()

export const ClientSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  notes: z.string().nullable(),
  color: z.string().nullable(),
  createdAt: IsoDateSchema,
  updatedAt: IsoDateSchema
})

export type Client = z.infer<typeof ClientSchema>

export const CreateClientInputSchema = z.object({
  name: z.string().min(1),
  notes: z.string().nullable().optional(),
  color: z.string().nullable().optional()
})

export type CreateClientInput = z.infer<typeof CreateClientInputSchema>

export const UpdateClientInputSchema = CreateClientInputSchema.partial()

export type UpdateClientInput = z.infer<typeof UpdateClientInputSchema>
