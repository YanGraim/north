import { z } from 'zod'
import { IdSchema, IsoDateSchema } from './client'
import { ConnectionLinkSchema } from './connection'

export const AccessTypeSchema = z.enum(['database', 'login', 'other'])

export type AccessType = z.infer<typeof AccessTypeSchema>

export const DatabaseEngineSchema = z.enum([
  'postgres',
  'mysql',
  'mariadb',
  'redis',
  'mongodb',
  'mssql',
  'sqlite',
  'other'
])

export type DatabaseEngine = z.infer<typeof DatabaseEngineSchema>

export const AccessSchema = z.object({
  id: IdSchema,
  groupId: IdSchema,
  type: AccessTypeSchema,
  name: z.string().min(1),
  description: z.string().nullable(),
  notes: z.string().nullable(),
  username: z.string().nullable(),
  credentialRef: z.string().nullable(),
  url: z.string().nullable(),
  links: z.array(ConnectionLinkSchema),
  icon: z.string().nullable(),
  color: z.string().nullable(),
  isFavorite: z.boolean(),
  engine: DatabaseEngineSchema.nullable(),
  host: z.string().nullable(),
  port: z.number().int().positive().nullable(),
  database: z.string().nullable(),
  ssl: z.boolean().nullable(),
  createdAt: IsoDateSchema,
  updatedAt: IsoDateSchema
})

export type Access = z.infer<typeof AccessSchema>

export const CreateAccessInputSchema = z.object({
  groupId: IdSchema,
  type: AccessTypeSchema,
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  username: z.string().nullable().optional(),
  credentialRef: z.string().nullable().optional(),
  url: z.string().nullable().optional(),
  links: z.array(ConnectionLinkSchema).optional(),
  icon: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  isFavorite: z.boolean().optional(),
  engine: DatabaseEngineSchema.nullable().optional(),
  host: z.string().nullable().optional(),
  port: z.number().int().positive().nullable().optional(),
  database: z.string().nullable().optional(),
  ssl: z.boolean().nullable().optional()
})

export type CreateAccessInput = z.infer<typeof CreateAccessInputSchema>

export const UpdateAccessInputSchema = CreateAccessInputSchema.omit({
  groupId: true
})
  .partial()
  .extend({
    groupId: IdSchema.optional()
  })

export type UpdateAccessInput = z.infer<typeof UpdateAccessInputSchema>

export const ListAccessesFilterSchema = z.object({
  groupId: IdSchema.optional(),
  environmentId: IdSchema.optional(),
  clientId: IdSchema.optional(),
  isFavorite: z.boolean().optional(),
  tagId: IdSchema.optional(),
  type: AccessTypeSchema.optional()
})

export type ListAccessesFilter = z.infer<typeof ListAccessesFilterSchema>
