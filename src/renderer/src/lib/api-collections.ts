import { parsePostmanCollection } from '@shared/lib/postman-collection'
import type { ApiCollection, CreateApiCollectionInput } from '@shared/types'

const RESTART_MESSAGE = 'Reinicie o North para atualizar a ponte com o processo principal.'

function requireApiFn<K extends keyof Window['north']['api']>(name: K): Window['north']['api'][K] {
  const method = window.north?.api?.[name]
  if (typeof method !== 'function') {
    throw new Error(RESTART_MESSAGE)
  }
  return method
}

async function findLegacyAccessId(clientId: string | null): Promise<string | null> {
  if (typeof window.north.accesses?.list !== 'function') return null
  const accesses = await window.north.accesses.list({
    type: 'api',
    ...(clientId ? { clientId } : {})
  })
  return accesses[0]?.id ?? null
}

export async function createApiCollection(input: CreateApiCollectionInput): Promise<ApiCollection> {
  const collectionCreate = requireApiFn('collectionCreate')
  try {
    return await collectionCreate(input)
  } catch (error) {
    const accessId = await findLegacyAccessId(input.clientId)
    if (!accessId) throw error
    return await collectionCreate({
      ...input,
      accessId
    } as CreateApiCollectionInput)
  }
}

export async function importPostmanCollection(
  document: unknown,
  clientId: string | null
): Promise<ApiCollection> {
  const collectionImport = window.north.api?.collectionImport
  if (typeof collectionImport === 'function') {
    const result = await collectionImport({ clientId, document })
    if (result.canceled || !result.collection) {
      throw new Error('Importação cancelada')
    }
    return result.collection
  }

  const parsed = parsePostmanCollection(document)
  const collection = await createApiCollection({
    clientId,
    name: parsed.name,
    description: parsed.description
  })
  const folderCreate = requireApiFn('folderCreate')
  const requestCreate = requireApiFn('requestCreate')
  const folderIds = new Map<string, string>()
  for (const folder of parsed.folders) {
    const created = await folderCreate({
      collectionId: collection.id,
      parentFolderId: folder.parentTempId ? (folderIds.get(folder.parentTempId) ?? null) : null,
      name: folder.name
    })
    folderIds.set(folder.tempId, created.id)
  }
  for (const request of parsed.requests) {
    await requestCreate({
      collectionId: collection.id,
      folderId: request.folderTempId ? (folderIds.get(request.folderTempId) ?? null) : null,
      name: request.name,
      method: request.method,
      url: request.url,
      definition: request.definition
    })
  }
  return collection
}
