import { z } from 'zod'
import { ApiAuthSchema, ApiKeyValueSchema } from './access'
import { IdSchema, IsoDateSchema } from './client'

export const ApiHttpMethodSchema = z.enum([
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD',
  'OPTIONS'
])
export type ApiHttpMethod = z.infer<typeof ApiHttpMethodSchema>

export const ApiBodySchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('none') }),
  z.object({ type: z.literal('json'), text: z.string() }),
  z.object({ type: z.literal('text'), text: z.string() }),
  z.object({
    type: z.literal('form-urlencoded'),
    fields: z.array(ApiKeyValueSchema)
  }),
  z.object({
    type: z.literal('multipart'),
    fields: z.array(ApiKeyValueSchema)
  })
])
export type ApiBody = z.infer<typeof ApiBodySchema>

export const ApiRequestDefinitionSchema = z.object({
  schemaVersion: z.literal(1),
  queryParams: z.array(ApiKeyValueSchema),
  headers: z.array(ApiKeyValueSchema),
  body: ApiBodySchema,
  auth: ApiAuthSchema.nullable()
})
export type ApiRequestDefinition = z.infer<typeof ApiRequestDefinitionSchema>

export const emptyApiRequestDefinition = (): ApiRequestDefinition => ({
  schemaVersion: 1,
  queryParams: [],
  headers: [],
  body: { type: 'none' },
  auth: null
})

export const ApiCollectionSchema = z.object({
  id: IdSchema,
  clientId: IdSchema.nullable(),
  name: z.string().min(1),
  description: z.string().nullable(),
  sortOrder: z.number().int(),
  createdAt: IsoDateSchema,
  updatedAt: IsoDateSchema
})
export type ApiCollection = z.infer<typeof ApiCollectionSchema>

const CreateApiCollectionFieldsSchema = z.object({
  clientId: IdSchema.nullable(),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  sortOrder: z.number().int().optional()
})

export const CreateApiCollectionInputSchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== 'object') return raw
  const input = { ...(raw as Record<string, unknown>) }
  if (input.clientId === undefined) {
    delete input.accessId
    input.clientId = null
  }
  return input
}, CreateApiCollectionFieldsSchema)
export type CreateApiCollectionInput = z.infer<typeof CreateApiCollectionFieldsSchema>

export const UpdateApiCollectionInputSchema = CreateApiCollectionFieldsSchema.omit({
  clientId: true
}).partial()
export type UpdateApiCollectionInput = z.infer<typeof UpdateApiCollectionInputSchema>

export const ApiCollectionListFilterSchema = z
  .object({
    clientId: IdSchema.nullable().optional()
  })
  .optional()
export type ApiCollectionListFilter = z.infer<typeof ApiCollectionListFilterSchema>

export const ApiCollectionImportInputSchema = z.object({
  clientId: IdSchema.nullable(),
  document: z.unknown().optional()
})
export type ApiCollectionImportInput = z.infer<typeof ApiCollectionImportInputSchema>

export const ApiCollectionImportResultSchema = z.object({
  canceled: z.boolean(),
  collection: ApiCollectionSchema.nullable()
})
export type ApiCollectionImportResult = z.infer<typeof ApiCollectionImportResultSchema>

export const ApiCollectionExportResultSchema = z.object({
  canceled: z.boolean(),
  filePath: z.string().nullable()
})
export type ApiCollectionExportResult = z.infer<typeof ApiCollectionExportResultSchema>

export const ApiFolderSchema = z.object({
  id: IdSchema,
  collectionId: IdSchema,
  parentFolderId: IdSchema.nullable(),
  name: z.string().min(1),
  sortOrder: z.number().int(),
  createdAt: IsoDateSchema,
  updatedAt: IsoDateSchema
})
export type ApiFolder = z.infer<typeof ApiFolderSchema>

export const CreateApiFolderInputSchema = z.object({
  collectionId: IdSchema,
  parentFolderId: IdSchema.nullable().optional(),
  name: z.string().min(1),
  sortOrder: z.number().int().optional()
})
export type CreateApiFolderInput = z.infer<typeof CreateApiFolderInputSchema>

export const UpdateApiFolderInputSchema = z.object({
  name: z.string().min(1).optional(),
  parentFolderId: IdSchema.nullable().optional(),
  sortOrder: z.number().int().optional()
})
export type UpdateApiFolderInput = z.infer<typeof UpdateApiFolderInputSchema>

export const ApiRequestSchema = z.object({
  id: IdSchema,
  collectionId: IdSchema,
  folderId: IdSchema.nullable(),
  name: z.string().min(1),
  method: ApiHttpMethodSchema,
  url: z.string(),
  definition: ApiRequestDefinitionSchema,
  sortOrder: z.number().int(),
  createdAt: IsoDateSchema,
  updatedAt: IsoDateSchema
})
export type ApiRequest = z.infer<typeof ApiRequestSchema>

export const CreateApiRequestInputSchema = z.object({
  collectionId: IdSchema,
  folderId: IdSchema.nullable().optional(),
  name: z.string().min(1),
  method: ApiHttpMethodSchema.optional(),
  url: z.string().optional(),
  definition: ApiRequestDefinitionSchema.optional(),
  sortOrder: z.number().int().optional()
})
export type CreateApiRequestInput = z.infer<typeof CreateApiRequestInputSchema>

export const UpdateApiRequestInputSchema = z.object({
  collectionId: IdSchema.optional(),
  folderId: IdSchema.nullable().optional(),
  name: z.string().min(1).optional(),
  method: ApiHttpMethodSchema.optional(),
  url: z.string().optional(),
  definition: ApiRequestDefinitionSchema.optional(),
  sortOrder: z.number().int().optional()
})
export type UpdateApiRequestInput = z.infer<typeof UpdateApiRequestInputSchema>

export const MoveApiRequestInputSchema = z.object({
  requestId: IdSchema,
  collectionId: IdSchema,
  folderId: IdSchema.nullable(),
  sortOrder: z.number().int().optional()
})
export type MoveApiRequestInput = z.infer<typeof MoveApiRequestInputSchema>

export const ApiVariableSchema = z.object({
  id: IdSchema,
  accessId: IdSchema,
  key: z.string().min(1),
  value: z.string().nullable(),
  isSecret: z.boolean(),
  credentialRef: z.string().nullable(),
  description: z.string().nullable(),
  createdAt: IsoDateSchema,
  updatedAt: IsoDateSchema
})
export type ApiVariable = z.infer<typeof ApiVariableSchema>

/** Renderer-safe variable: secrets never include plaintext. */
export const ApiVariablePublicSchema = z.object({
  id: IdSchema,
  accessId: IdSchema,
  key: z.string().min(1),
  value: z.string().nullable(),
  isSecret: z.boolean(),
  hasSecret: z.boolean(),
  description: z.string().nullable(),
  createdAt: IsoDateSchema,
  updatedAt: IsoDateSchema
})
export type ApiVariablePublic = z.infer<typeof ApiVariablePublicSchema>

export const SetApiVariableInputSchema = z.object({
  accessId: IdSchema,
  key: z.string().min(1),
  value: z.string().nullable().optional(),
  isSecret: z.boolean().optional(),
  description: z.string().nullable().optional()
})
export type SetApiVariableInput = z.infer<typeof SetApiVariableInputSchema>

export const ApiRequestHistoryEntrySchema = z.object({
  id: IdSchema,
  accessId: IdSchema,
  requestId: IdSchema.nullable(),
  method: ApiHttpMethodSchema,
  url: z.string(),
  statusCode: z.number().int().nullable(),
  durationMs: z.number().int().nullable(),
  sizeBytes: z.number().int().nullable(),
  errorKind: z.string().nullable(),
  errorMessage: z.string().nullable(),
  executedAt: IsoDateSchema
})
export type ApiRequestHistoryEntry = z.infer<typeof ApiRequestHistoryEntrySchema>

export const InsertApiRequestHistoryInputSchema = z.object({
  accessId: IdSchema,
  requestId: IdSchema.nullable().optional(),
  method: ApiHttpMethodSchema,
  url: z.string(),
  statusCode: z.number().int().nullable().optional(),
  durationMs: z.number().int().nullable().optional(),
  sizeBytes: z.number().int().nullable().optional(),
  errorKind: z.string().nullable().optional(),
  errorMessage: z.string().nullable().optional()
})
export type InsertApiRequestHistoryInput = z.infer<typeof InsertApiRequestHistoryInputSchema>
