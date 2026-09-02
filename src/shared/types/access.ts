import { z } from 'zod'
import { IdSchema, IsoDateSchema } from './client'
import { ConnectionLinkSchema } from './connection'

export const AccessTypeSchema = z.enum(['database', 'login', 'other', 'api'])

export type AccessType = z.infer<typeof AccessTypeSchema>

export const ApiKeyValueSchema = z.object({
  key: z.string(),
  value: z.string(),
  enabled: z.boolean().default(true)
})
export type ApiKeyValue = z.infer<typeof ApiKeyValueSchema>

export const ApiAuthSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('none') }),
  z.object({ type: z.literal('bearer'), token: z.string() }),
  z.object({
    type: z.literal('basic'),
    username: z.string(),
    password: z.string()
  }),
  z.object({
    type: z.literal('apiKey'),
    key: z.string(),
    value: z.string(),
    in: z.enum(['header', 'query']).default('header')
  })
])
export type ApiAuth = z.infer<typeof ApiAuthSchema>

export const ApiConfigSchema = z.object({
  schemaVersion: z.literal(1),
  auth: ApiAuthSchema,
  defaultHeaders: z.array(ApiKeyValueSchema),
  timeoutMs: z.number().int().nonnegative(),
  followRedirects: z.boolean(),
  verifyTls: z.boolean()
})
export type ApiConfig = z.infer<typeof ApiConfigSchema>

export const emptyApiConfig = (): ApiConfig => ({
  schemaVersion: 1,
  auth: { type: 'none' },
  defaultHeaders: [],
  timeoutMs: 0,
  followRedirects: true,
  verifyTls: true
})

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
  apiConfig: ApiConfigSchema.nullable(),
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
  ssl: z.boolean().nullable().optional(),
  apiConfig: ApiConfigSchema.nullable().optional()
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
